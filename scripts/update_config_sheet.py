import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


SPREADSHEET_ID = "1jTsZixaANJd8Ijs3f66LwbXSBC9UcRoALLolEvxiz40"
RANGE_NAME = "CONFIG_MODUL!A1:B5"
DEPLOYMENT_LIMIT = 20
KEEP_RECENT_DEPLOYMENTS = 12
INJECTOR_POLL_ATTEMPTS = 12
INJECTOR_POLL_DELAY_SECONDS = 2


def load_access_token():
    token_path = os.path.join(os.path.expanduser("~"), ".clasprc.json")
    with open(token_path, "r", encoding="utf-8") as handle:
        clasprc = json.load(handle)
    return clasprc["tokens"]["default"]["access_token"]


def request_json(method, url, token, payload=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if payload is not None:
        req.add_header("Content-Type", "application/json")
        body = json.dumps(payload).encode("utf-8")
    else:
        body = None

    with urllib.request.urlopen(req, data=body) as response:
        return json.loads(response.read().decode("utf-8"))


def list_versioned_deployments(path):
    result = subprocess.run(
        ["clasp", "deployments"],
        cwd=path,
        capture_output=True,
        text=True,
        shell=True,
        check=True,
    )
    deployments = []
    pattern = re.compile(r"^- ([A-Za-z0-9_-]+) @(\d+)(?: - (.*))?$")
    for raw_line in result.stdout.splitlines():
        line = raw_line.strip()
        match = pattern.match(line)
        if not match:
            continue
        deployments.append(
            {
                "id": match.group(1),
                "version": int(match.group(2)),
                "description": match.group(3) or "",
            }
        )
    return deployments


def ensure_deploy_capacity(path, keep_recent=KEEP_RECENT_DEPLOYMENTS):
    deployments = list_versioned_deployments(path)
    if len(deployments) < DEPLOYMENT_LIMIT:
        return

    deployments.sort(key=lambda item: item["version"])
    removable = deployments[: max(0, len(deployments) - keep_recent + 1)]
    for item in removable:
        subprocess.run(
            ["clasp", "undeploy", item["id"]],
            cwd=path,
            capture_output=True,
            text=True,
            shell=True,
            check=True,
        )


def extract_preserved_home_url(sheet_values):
    for row in sheet_values:
        if len(row) >= 2 and str(row[0]).strip().upper() == "HOME_PORTAL":
            return str(row[1]).strip()
    return ""


def build_payload(gate_url, area_url, report_url, preserved_home_url):
    return {
        "range": RANGE_NAME,
        "majorDimension": "ROWS",
        "values": [
            ["NAMA_MODUL", "LINK_MODUL"],
            ["GATE_PABRIK", gate_url],
            ["AREA_KERJA", area_url],
            ["REPORT", report_url],
            ["HOME_PORTAL", preserved_home_url],
        ],
    }


def verify_sheet(token):
    verify_url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/"
        f"{SPREADSHEET_ID}/values/{RANGE_NAME}"
    )
    return request_json("GET", verify_url, token)


def update_sheet(gate_url, area_url, report_url):
    token = load_access_token()
    existing = verify_sheet(token)
    preserved_home_url = extract_preserved_home_url(existing.get("values", []))
    update_url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/"
        f"{SPREADSHEET_ID}/values/{RANGE_NAME}?valueInputOption=USER_ENTERED"
    )
    payload = build_payload(gate_url, area_url, report_url, preserved_home_url)
    update_result = request_json("PUT", update_url, token, payload)
    verify_result = verify_sheet(token)
    return update_result, verify_result


def build_temp_injector_code(gate_url, area_url, report_url):
    return f"""function doGet() {{
  try {{
    const ss = SpreadsheetApp.openById('{SPREADSHEET_ID}');
    let sheet = ss.getSheetByName('CONFIG_MODUL');
    if (!sheet) {{
      sheet = ss.insertSheet('CONFIG_MODUL');
      sheet.appendRow(['NAMA_MODUL', 'LINK_MODUL']);
      sheet.getRange('A1:B1').setFontWeight('bold');
    }}

    const target = {{
      GATE_PABRIK: {json.dumps(gate_url)},
      AREA_KERJA: {json.dumps(area_url)},
      REPORT: {json.dumps(report_url)}
    }};

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {{
      const name = String(data[i][0] || '').trim().toUpperCase();
      if (target[name]) {{
        sheet.getRange(i + 1, 2).setValue(target[name]);
      }}
    }}

    for (const [name, url] of Object.entries(target)) {{
      let found = false;
      for (let i = 1; i < data.length; i++) {{
        if (String(data[i][0] || '').trim().toUpperCase() === name) {{
          found = true;
          break;
        }}
      }}
      if (!found) {{
        sheet.appendRow([name, url]);
      }}
    }}

    return ContentService.createTextOutput('OK_CONFIG_MODUL_UPDATED');
  }} catch (err) {{
    return ContentService.createTextOutput('ERROR: ' + err.message);
  }}
}}
"""


def compact_text(value, limit=600):
    text = str(value)
    if len(text) <= limit:
        return text
    return text[:limit] + "...<truncated>"


def wait_for_injector_response(url):
    last_body = ""
    for _ in range(INJECTOR_POLL_ATTEMPTS):
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8", errors="replace")
        last_body = body
        if "OK_CONFIG_MODUL_UPDATED" in body or body.startswith("ERROR:"):
            return body
        time.sleep(INJECTOR_POLL_DELAY_SECONDS)
    return last_body


def fallback_update_via_temp_deploy(gate_url, area_url, report_url):
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    injector_dir = os.path.join(project_root, "active", "MODUL_GATE_PABRIK")
    code_path = os.path.join(injector_dir, "Code.js")

    with open(code_path, "r", encoding="utf-8") as handle:
        original_code = handle.read()

    temp_code = build_temp_injector_code(gate_url, area_url, report_url)

    try:
        with open(code_path, "w", encoding="utf-8") as handle:
            handle.write(temp_code)

        push_result = subprocess.run(
            ["clasp", "push", "--force"],
            cwd=injector_dir,
            capture_output=True,
            text=True,
            shell=True,
        )
        if push_result.returncode != 0:
            raise RuntimeError(push_result.stdout + push_result.stderr)

        ensure_deploy_capacity(injector_dir)

        deploy_result = subprocess.run(
            ["clasp", "deploy", "--description", "Temp CONFIG_MODUL Injection"],
            cwd=injector_dir,
            capture_output=True,
            text=True,
            shell=True,
        )
        output = deploy_result.stdout + deploy_result.stderr
        match = re.search(r"Deployed ([a-zA-Z0-9_-]+) @\d+", output)
        if deploy_result.returncode != 0 or not match:
            raise RuntimeError(output or "Failed to deploy temporary CONFIG_MODUL injector.")

        deploy_id = match.group(1)
        url = f"https://script.google.com/macros/s/{deploy_id}/exec"
        body = wait_for_injector_response(url)

        if "OK_CONFIG_MODUL_UPDATED" not in body:
            raise RuntimeError(f"Unexpected injector response: {compact_text(body)}")

        return {
            "mode": "temp_deploy",
            "inject_url": url,
            "response": body,
        }
    finally:
        with open(code_path, "w", encoding="utf-8") as handle:
            handle.write(original_code)
        subprocess.run(
            ["clasp", "push", "--force"],
            cwd=injector_dir,
            capture_output=True,
            text=True,
            shell=True,
        )


def main():
    parser = argparse.ArgumentParser(description="Update CONFIG_MODUL sheet URLs.")
    parser.add_argument("--gate-url", required=True, help="Exec URL for GATE_PABRIK module")
    parser.add_argument("--area-url", required=True, help="Exec URL for AREA_KERJA module")
    parser.add_argument("--report-url", required=True, help="Exec URL for REPORT module")
    args = parser.parse_args()

    try:
        update_result, verify_result = update_sheet(
            args.gate_url,
            args.area_url,
            args.report_url,
        )
    except urllib.error.HTTPError as err:
        error_body = err.read().decode("utf-8")
        if err.code == 403 and "SERVICE_DISABLED" in error_body:
            print("Sheets API disabled for clasp OAuth project. Falling back to temporary GAS injector.")
            try:
                fallback_result = fallback_update_via_temp_deploy(
                    args.gate_url,
                    args.area_url,
                    args.report_url,
                )
            except Exception as fallback_err:
                print("Fallback failed: " + compact_text(fallback_err).encode("ascii", errors="replace").decode("ascii"))
                return 1

            print("CONFIG_MODUL updated via fallback.")
            print(json.dumps(fallback_result, indent=2))
            return 0

        print(f"HTTP Error: {err.code}")
        print(error_body)
        return 1
    except Exception as err:
        print(f"Error: {err}")
        return 1

    print("CONFIG_MODUL updated.")
    print(json.dumps(update_result, indent=2))
    print("CONFIG_MODUL verification:")
    print(json.dumps(verify_result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
