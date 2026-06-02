import os
import json
import subprocess
import re
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
modules = ["HOME_PORTAL", "MODUL_GATE_PABRIK", "MODUL_AREA_KERJA", "MODUL_REPORT"]

urls = {}

def fix_and_deploy(mod):
    mod_dir = os.path.join(base_dir, mod)
    
    # 1. Update appsscript.json
    manifest_path = os.path.join(mod_dir, "appsscript.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    
    manifest["webapp"] = {
        "executeAs": "USER_DEPLOYING",
        "access": "ANYONE_ANONYMOUS"
    }
    manifest["timeZone"] = "Asia/Jakarta"
    
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"Deploying {mod}...")
    subprocess.run(["clasp", "push", "--force"], cwd=mod_dir, shell=True)
    
    res = subprocess.run(["clasp", "deploy", "--description", "Public Webapp Deployment"], cwd=mod_dir, shell=True, capture_output=True, text=True)
    out = res.stdout + res.stderr
    print(out)
    
    match = re.search(r"Deployed ([a-zA-Z0-9_-]+) @\d+", out)
    if match:
        deployment_id = match.group(1)
        url = f"https://script.google.com/macros/s/{deployment_id}/exec"
        return url
    else:
        print(f"WARNING: Could not find Deployment ID for {mod}")
        return None

# 1. Deploy HOME_PORTAL
home_url = fix_and_deploy("HOME_PORTAL")
urls["HOME_PORTAL"] = home_url

# 2. Deploy others
for mod in modules[1:]:
    urls[mod] = fix_and_deploy(mod)

print("All Deployments Complete.")
print("URLs:", urls)

# 3. Update CONFIG_MODUL directly via Sheets API
if home_url and all(urls.values()):
    update_script = os.path.join(base_dir, "scripts", "update_config_sheet.py")
    result = subprocess.run(
        [
            sys.executable,
            update_script,
            "--gate-url", urls["MODUL_GATE_PABRIK"],
            "--area-url", urls["MODUL_AREA_KERJA"],
            "--report-url", urls["MODUL_REPORT"],
        ],
        cwd=base_dir,
        shell=True,
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr)
        print("Failed to update CONFIG_MODUL.")
else:
    print("Missing some URLs, skipping config injection.")
