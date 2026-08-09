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
TOKEN_REFRESH_URL = "https://oauth2.googleapis.com/token"
TOKEN_EXPIRY_SKEW_SECONDS = 300


def get_clasprc_path():
    return os.path.join(os.path.expanduser("~"), ".clasprc.json")


def load_clasprc():
    token_path = get_clasprc_path()
    with open(token_path, "r", encoding="utf-8") as handle:
        return json.load(handle), token_path


def save_clasprc(clasprc, token_path):
    with open(token_path, "w", encoding="utf-8") as handle:
        json.dump(clasprc, handle, indent=2, ensure_ascii=False)


def get_default_token_entry(clasprc):
    return clasprc["tokens"]["default"]


def token_is_expired(token_entry):
    expiry_ms = int(token_entry.get("expiry_date") or 0)
    if not expiry_ms:
        return True
    now_ms = int(time.time() * 1000)
    skew_ms = TOKEN_EXPIRY_SKEW_SECONDS * 1000
    return expiry_ms <= now_ms + skew_ms


def refresh_access_token():
    clasprc, token_path = load_clasprc()
    token_entry = get_default_token_entry(clasprc)
    payload = urllib.parse.urlencode(
        {
            "client_id": token_entry["client_id"],
            "client_secret": token_entry["client_secret"],
            "refresh_token": token_entry["refresh_token"],
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    request = urllib.request.Request(TOKEN_REFRESH_URL, data=payload, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(request) as response:
        refreshed = json.loads(response.read().decode("utf-8"))

    token_entry["access_token"] = refreshed["access_token"]
    token_entry["token_type"] = refreshed.get("token_type", token_entry.get("token_type", "Bearer"))
    token_entry["expiry_date"] = int((time.time() + int(refreshed.get("expires_in", 3600))) * 1000)
    if refreshed.get("id_token"):
        token_entry["id_token"] = refreshed["id_token"]
    save_clasprc(clasprc, token_path)
    return token_entry["access_token"]


def load_access_token(force_refresh=False):
    clasprc, _ = load_clasprc()
    token_entry = get_default_token_entry(clasprc)
    if force_refresh or not token_entry.get("access_token") or token_is_expired(token_entry):
        return refresh_access_token()
    return token_entry["access_token"]


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


def request_json_with_retry(method, url, payload=None):
    token = load_access_token()
    try:
        return request_json(method, url, token, payload)
    except urllib.error.HTTPError as err:
        if err.code != 401:
            raise
    token = load_access_token(force_refresh=True)
    return request_json(method, url, token, payload)


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


def undeploy_if_exists(path, deployment_id):
    if not deployment_id:
        return
    try:
        subprocess.run(
            ["clasp", "undeploy", deployment_id],
            cwd=path,
            capture_output=True,
            text=True,
            shell=True,
            check=True,
        )
    except Exception:
        pass


def extract_preserved_home_url(sheet_values):
    for row in sheet_values:
        if len(row) >= 2 and str(row[0]).strip().upper() == "HOME_PORTAL":
            return str(row[1]).strip()
    return ""


def build_payload(gate_url, area_url, report_url, home_url):
    return {
        "range": RANGE_NAME,
        "majorDimension": "ROWS",
        "values": [
            ["NAMA_MODUL", "LINK_MODUL"],
            ["GATE_PABRIK", gate_url],
            ["AREA_KERJA", area_url],
            ["REPORT", report_url],
            ["HOME_PORTAL", home_url],
        ],
    }


def verify_sheet():
    verify_url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/"
        f"{SPREADSHEET_ID}/values/{RANGE_NAME}"
    )
    return request_json_with_retry("GET", verify_url)


def update_sheet(gate_url, area_url, report_url, home_url=None):
    existing = verify_sheet()
    effective_home_url = home_url or extract_preserved_home_url(existing.get("values", []))
    update_url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/"
        f"{SPREADSHEET_ID}/values/{RANGE_NAME}?valueInputOption=USER_ENTERED"
    )
    payload = build_payload(gate_url, area_url, report_url, effective_home_url)
    update_result = request_json_with_retry("PUT", update_url, payload)
    verify_result = verify_sheet()
    return update_result, verify_result


def build_temp_injector_code(gate_url, area_url, report_url, home_url=None):
    target_lines = [
        f"      GATE_PABRIK: {json.dumps(gate_url)},",
        f"      AREA_KERJA: {json.dumps(area_url)},",
        f"      REPORT: {json.dumps(report_url)},",
    ]
    if home_url:
        target_lines.append(f"      HOME_PORTAL: {json.dumps(home_url)},")
    target_block = "\n".join(target_lines)
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
{target_block}
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


def fallback_update_via_temp_deploy(gate_url, area_url, report_url, home_url=None):
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    injector_dir = os.path.join(project_root, "active", "HOME_PORTAL")
    code_path = os.path.join(injector_dir, "Code.js")
    deploy_id = None

    with open(code_path, "r", encoding="utf-8") as handle:
        original_code = handle.read()

    temp_code = build_temp_injector_code(gate_url, area_url, report_url, home_url=home_url)

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
        match = re.search(r"Deployed ([A-Za-z0-9_-]+) @\d+", output)
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
        undeploy_if_exists(injector_dir, deploy_id)


def should_fallback(err, error_body):
    if isinstance(err, urllib.error.HTTPError) and err.code in {401, 403}:
        return True
    normalized = (error_body or "").upper()
    return any(
        marker in normalized
        for marker in ["SERVICE_DISABLED", "UNAUTHORIZED", "INSUFFICIENT", "AUTHENTICATION", "PERMISSION"]
    )


def main():
    parser = argparse.ArgumentParser(description="Update CONFIG_MODUL sheet URLs.")
    parser.add_argument("--gate-url", help="Exec URL for GATE_PABRIK module")
    parser.add_argument("--area-url", help="Exec URL for AREA_KERJA module")
    parser.add_argument("--report-url", help="Exec URL for REPORT module")
    parser.add_argument("--home-url", help="Exec URL for HOME_PORTAL module")
    parser.add_argument("--verify-only", action="store_true", help="Read CONFIG_MODUL and output JSON without updating")
    args = parser.parse_args()

    # ── Verify-only mode ──────────────────────────────────────────────────────
    if args.verify_only:
        try:
            result = verify_sheet()
            print(json.dumps(result, indent=2))
        except Exception as err:
            print(json.dumps({"error": str(err)}))
            return 1
        return 0

    if not args.gate_url or not args.area_url or not args.report_url:
        parser.error("--gate-url, --area-url, and --report-url are required unless --verify-only is set")

    try:
        update_result, verify_result = update_sheet(
            args.gate_url,
            args.area_url,
            args.report_url,
            home_url=args.home_url,
        )
    except urllib.error.HTTPError as err:
        error_body = err.read().decode("utf-8", errors="replace")
        if should_fallback(err, error_body):
            print("Direct Sheets API update failed. Falling back to temporary GAS injector.")
            try:
                fallback_result = fallback_update_via_temp_deploy(
                    args.gate_url,
                    args.area_url,
                    args.report_url,
                    home_url=args.home_url,
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
