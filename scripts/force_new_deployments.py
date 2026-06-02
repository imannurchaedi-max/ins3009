import os
import subprocess
import re

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"
modules = ["MODUL_GATE_PABRIK", "MODUL_AREA_KERJA", "MODUL_REPORT"]

print("Generating FRESH URLs to bust cache...")

for mod in modules:
    mod_dir = os.path.join(base_dir, mod)
    print(f"Deploying {mod}...")
    
    # We create a brand new deployment
    res = subprocess.run(["clasp", "deploy", "-d", "Cache Busting Deployment"], cwd=mod_dir, shell=True, capture_output=True, text=True)
    out = res.stdout + res.stderr
    
    match = re.search(r"Deployed ([a-zA-Z0-9_-]+) @", out)
    if match:
        deployment_id = match.group(1)
        url = f"https://script.google.com/macros/s/{deployment_id}/exec"
        print(f"SUCCESS: {mod} -> {url}")
    else:
        print(f"FAILED to deploy {mod}. Output:\n{out}")
