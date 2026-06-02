import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request


SPREADSHEET_ID = "1jTsZixaANJd8Ijs3f66LwbXSBC9UcRoALLolEvxiz40"
RANGE_NAME = "CONFIG_MODUL!A1:B4"


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


def build_payload(gate_url, area_url, report_url):
    return {
        "range": RANGE_NAME,
        "majorDimension": "ROWS",
        "values": [
            ["NAMA_MODUL", "LINK_MODUL"],
            ["GATE_PABRIK", gate_url],
            ["AREA_KERJA", area_url],
            ["REPORT", report_url],
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
    update_url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/"
        f"{SPREADSHEET_ID}/values/{RANGE_NAME}?valueInputOption=USER_ENTERED"
    )
    payload = build_payload(gate_url, area_url, report_url)
    update_result = request_json("PUT", update_url, token, payload)
    verify_result = verify_sheet(token)
    return update_result, verify_result


def build_temp_injector_code(gate_url, area_url, report_url):
    return f"""function doGet() {{
  try {{
    const ss = SpreadsheetApp.openById('{SPREADSHEET_ID}');
    let sheet = ss.getSheetByName('CONFIG_MODUL');
    if (!sheet) sheet = ss.insertSheet('CONFIG_MODUL');
    sheet.clearContents();
    sheet.getRange(1, 1, 4, 2).setValues([
      ['NAMA_MODUL', 'LINK_MODUL'],
      ['GATE_PABRIK', {json.dumps(gate_url)}],
      ['AREA_KERJA', {json.dumps(area_url)}],
      ['REPORT', {json.dumps(report_url)}]
    ]);
    return ContentService.createTextOutput('OK_CONFIG_MODUL_UPDATED');
  }} catch (err) {{
    return ContentService.createTextOutput('ERROR: ' + err.message);
  }}
}}
"""


def fallback_update_via_temp_deploy(gate_url, area_url, report_url):
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    home_dir = os.path.join(project_root, "HOME_PORTAL")
    code_path = os.path.join(home_dir, "Code.js")

    with open(code_path, "r", encoding="utf-8") as handle:
        original_code = handle.read()

    temp_code = build_temp_injector_code(gate_url, area_url, report_url)

    try:
        with open(code_path, "w", encoding="utf-8") as handle:
            handle.write(temp_code)

        push_result = subprocess.run(
            ["clasp", "push", "--force"],
            cwd=home_dir,
            capture_output=True,
            text=True,
            shell=True,
        )
        if push_result.returncode != 0:
            raise RuntimeError(push_result.stdout + push_result.stderr)

        deploy_result = subprocess.run(
            ["clasp", "deploy", "--description", "Temp CONFIG_MODUL Injection"],
            cwd=home_dir,
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
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8", errors="replace")

        if "OK_CONFIG_MODUL_UPDATED" not in body:
            raise RuntimeError(f"Unexpected injector response: {body}")

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
            cwd=home_dir,
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
                print(f"Fallback failed: {fallback_err}")
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
