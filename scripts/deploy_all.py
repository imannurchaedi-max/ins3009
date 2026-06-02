import os
import subprocess
import re
import urllib.request
import time

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"
modules = ["HOME_PORTAL", "MODUL_GATE_PABRIK", "MODUL_AREA_KERJA", "MODUL_REPORT"]

urls = {}

def deploy_module(mod):
    mod_dir = os.path.join(base_dir, mod)
    print(f"Deploying {mod}...")
    
    # Check if .clasp.json exists to avoid recreating if script reran
    if not os.path.exists(os.path.join(mod_dir, ".clasp.json")):
        subprocess.run(["clasp", "create", "--type", "webapp", "--title", f"DAM - {mod}"], cwd=mod_dir, shell=True)
    
    subprocess.run(["clasp", "push", "--force"], cwd=mod_dir, shell=True)
    
    res = subprocess.run(["clasp", "deploy", "--description", "Initial Microservices"], cwd=mod_dir, shell=True, capture_output=True, text=True)
    out = res.stdout + res.stderr
    print(out)
    
    # Extract Deployment ID: Deployed AKfycb... @10
    match = re.search(r"Deployed ([a-zA-Z0-9_-]+) @\d+", out)
    if match:
        deployment_id = match.group(1)
        url = f"https://script.google.com/macros/s/{deployment_id}/exec"
        return url
    else:
        print(f"WARNING: Could not find Deployment ID for {mod}")
        return None

# 1. Deploy HOME_PORTAL first to get the URL
home_url = deploy_module("HOME_PORTAL")
urls["HOME_PORTAL"] = home_url

# 2. Deploy others
for mod in modules[1:]:
    urls[mod] = deploy_module(mod)

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
        req = urllib.request.urlopen(setup_url)
        res_body = req.read().decode('utf-8')
        print("Setup Response:", res_body)
    except Exception as e:
        print("Failed to call setup endpoint:", e)
else:
    print("Missing some URLs, skipping config injection.")
