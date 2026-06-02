import os
import re
import subprocess

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"
modules = ["HOME_PORTAL", "MODUL_GATE_PABRIK", "MODUL_AREA_KERJA", "MODUL_REPORT"]

verify_session_code = """
function verifySession(nik) {
  const karyawanMap = getKaryawanMapByNIK();
  const k = karyawanMap[nik];
  
  if (!k) {
    return { ok: false, msg: 'NIK tidak ditemukan di database.' };
  }
  
  const role = k.userLevel || 'KARYAWAN';
  
  const deptSet = {};
  const availableDepts = [];
  for (const key in karyawanMap) {
    const d = (karyawanMap[key].dept || '').trim();
    if (d && !deptSet[d]) {
      deptSet[d] = true;
      availableDepts.push(d);
    }
  }
  availableDepts.sort();

  return { 
    ok: true, 
    karyawan: {
      nik: k.nik,
      nama: k.nama,
      dept: k.dept,
      jabatan: k.jabatan,
      role: role
    },
    depts: availableDepts
  };
}
"""

def get_public_deployment_id(mod_dir):
    res = subprocess.run(["clasp", "deployments"], cwd=mod_dir, shell=True, capture_output=True, text=True)
    out = res.stdout + res.stderr
    print(out)
    
    # We want the ID of the Public Webapp Deployment
    # Example: - AKfycbw7nufCB1ephRdjbPp785LgXkrWVf9FieVEmIpBd8ihYI8OdzD9CFMK34px6sVggAJ1tA @2 - Public Webapp Deployment
    match = re.search(r"- ([a-zA-Z0-9_-]+) @\d+ - Public Webapp Deployment", out)
    if match:
        return match.group(1)
        
    # Fallback to isolated deployment if public doesn't exist
    match = re.search(r"- ([a-zA-Z0-9_-]+) @\d+ - Microservice Isolated Deployment", out)
    if match:
        return match.group(1)
        
    # Last fallback, get any deployment that is not HEAD
    matches = re.findall(r"- ([a-zA-Z0-9_-]+) @(\d+)", out)
    for m in matches:
        if m[1] != "HEAD":
            return m[0]
            
    return None

for mod in modules:
    mod_dir = os.path.join(base_dir, mod)
    print(f"--- Fixing {mod} ---")
    
    code_path = os.path.join(mod_dir, "Code.js")
    with open(code_path, "r", encoding="utf-8") as f:
        code_content = f.read()
        
    if "function verifySession(" not in code_content:
        # Insert before verifyLogin
        code_content = code_content.replace("function verifyLogin(nik, password) {", verify_session_code + "\nfunction verifyLogin(nik, password) {")
        with open(code_path, "w", encoding="utf-8") as f:
            f.write(code_content)
            
    app_path = os.path.join(mod_dir, "app.html")
    with open(app_path, "r", encoding="utf-8") as f:
        app_content = f.read()
        
    if ".verifyLogin(sessionNik, \"\");" in app_content:
        app_content = app_content.replace('.verifyLogin(sessionNik, "");', '.verifySession(sessionNik);')
        with open(app_path, "w", encoding="utf-8") as f:
            f.write(app_content)

    print("Pushing...")
    subprocess.run(["clasp", "push", "--force"], cwd=mod_dir, shell=True)
    
    dep_id = get_public_deployment_id(mod_dir)
    if dep_id:
        print(f"Updating deployment {dep_id}...")
        subprocess.run(["clasp", "deploy", "-i", dep_id, "-d", "Fix Auto-Login Auth Bug"], cwd=mod_dir, shell=True)
    else:
        print("WARNING: Could not find existing deployment ID to update.")
        
print("All fixed!")
