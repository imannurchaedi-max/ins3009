import os
import json
import subprocess
import urllib.request
import re

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"
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

# 3. Hit HOME_PORTAL setupConfig to save to Google Sheets
if home_url and all(urls.values()):
    gate_param = urllib.parse.quote(urls["MODUL_GATE_PABRIK"])
    area_param = urllib.parse.quote(urls["MODUL_AREA_KERJA"])
    report_param = urllib.parse.quote(urls["MODUL_REPORT"])
    
    setup_url = f"{home_url}?action=setupConfig&gate={gate_param}&area={area_param}&report={report_param}"
    print(f"Calling setup endpoint: {setup_url}")
    
    try:
        req = urllib.request.Request(setup_url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req)
        res_body = res.read().decode('utf-8', errors='replace')
        print("Setup completed successfully. Check output if needed.")
    except Exception as e:
        print("Failed to call setup endpoint:", e)
else:
    print("Missing some URLs, skipping config injection.")
