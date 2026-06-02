import os
import shutil
import subprocess
import urllib.request
import re

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"

# Backup Code.js
code_js_path = os.path.join(base_dir, "Code.js")
code_js_backup = os.path.join(base_dir, "Code.js.bak")

shutil.copy(code_js_path, code_js_backup)

try:
    # 1. Restore clasp config
    clasp_json = os.path.join(base_dir, ".clasp.json")
    clasp_backup = os.path.join(base_dir, ".clasp.json.backup")
    if os.path.exists(clasp_backup):
        shutil.copy(clasp_backup, clasp_json)

    # 2. Write temp Code.js
    temp_code = """
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById('1jTsZixaANJd8Ijs3f66LwbXSBC9UcRoALLolEvxiz40');
    let sheet = ss.getSheetByName('CONFIG_MODUL');
    if (!sheet) sheet = ss.insertSheet('CONFIG_MODUL');
    
    sheet.clearContents();
    sheet.appendRow(["NAMA_MODUL", "LINK_MODUL"]);
    sheet.appendRow(["GATE_PABRIK", "https://script.google.com/macros/s/AKfycbw7nufCB1ephRdjbPp785LgXkrWVf9FieVEmIpBd8ihYI8OdzD9CFMK34px6sVggAJ1tA/exec"]);
    sheet.appendRow(["AREA_KERJA", "https://script.google.com/macros/s/AKfycbwCAuiDpqrlGb7x8wznC9njkLiGGOQG3P_0TO1SeVcChBgedUPYhnM5q42qKDKMG_FQ0A/exec"]);
    sheet.appendRow(["REPORT", "https://script.google.com/macros/s/AKfycbx-nBRi_7BQZ8oIn-YT2MW58ZgoXOZlBpJpTHfcoWLQjeurv4fvg6TYRByItwzRw5cY/exec"]);
    
    return ContentService.createTextOutput("OK_SUCCESS_INJECT");
  } catch(err) {
    return ContentService.createTextOutput("ERROR: " + err.message);
  }
}
"""
    with open(code_js_path, "w", encoding="utf-8") as f:
        f.write(temp_code)

    # 3. Push and Deploy
    print("Pushing temporary code to monolith project...")
    subprocess.run(["clasp", "push", "--force"], cwd=base_dir, shell=True)
    
    print("Deploying...")
    res = subprocess.run(["clasp", "deploy", "--description", "Temp Injection"], cwd=base_dir, shell=True, capture_output=True, text=True)
    out = res.stdout + res.stderr
    print(out)
    
    match = re.search(r"Deployed ([a-zA-Z0-9_-]+) @\d+", out)
    if match:
        deployment_id = match.group(1)
        url = f"https://script.google.com/macros/s/{deployment_id}/exec"
        print(f"Injection URL: {url}")
        
        # 4. Hit the URL
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        body = response.read().decode('utf-8', errors='replace')
        print(f"Response: {body}")
    else:
        print("Failed to get deployment ID.")

finally:
    # Restore original Code.js
    if os.path.exists(code_js_backup):
        shutil.copy(code_js_backup, code_js_path)
        os.remove(code_js_backup)
        # Push the original code back to the monolith so it doesn't break anything permanently
        print("Restoring monolith code...")
        subprocess.run(["clasp", "push", "--force"], cwd=base_dir, shell=True)
        
    # Remove clasp.json
    if os.path.exists(clasp_json):
        os.remove(clasp_json)
    
    print("Cleanup complete.")
