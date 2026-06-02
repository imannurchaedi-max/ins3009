import os
import re
import subprocess

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"
modules = ["MODUL_GATE_PABRIK", "MODUL_AREA_KERJA", "MODUL_REPORT"]

for mod in modules:
    mod_dir = os.path.join(base_dir, mod)
    
    # 1. Update Index.html
    index_path = os.path.join(mod_dir, "Index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        idx_content = f.read()
    
    if "GLOBAL_SESSION_NIK" not in idx_content:
        idx_content = idx_content.replace(
            "<?!= include('style'); ?>",
            "<script> const GLOBAL_SESSION_NIK = \"<?= sessionNik ?>\"; </script>\n  <?!= include('style'); ?>"
        )
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(idx_content)
    
    # 2. Update app.html
    app_path = os.path.join(mod_dir, "app.html")
    with open(app_path, "r", encoding="utf-8") as f:
        app_content = f.read()
    
    if "<?= sessionNik ?>" in app_content:
        app_content = app_content.replace(
            'const sessionNik = "<?= sessionNik ?>";',
            'const sessionNik = GLOBAL_SESSION_NIK;'
        )
        with open(app_path, "w", encoding="utf-8") as f:
            f.write(app_content)

    print(f"Fixed files for {mod}. Pushing and deploying...")
    
    # Push and deploy
    subprocess.run(["clasp", "push", "--force"], cwd=mod_dir, shell=True)
    res = subprocess.run(["clasp", "deploy", "-d", "Fix HTML rendering bug"], cwd=mod_dir, shell=True, capture_output=True, text=True)
    out = res.stdout + res.stderr
    
    match = re.search(r"Deployed ([a-zA-Z0-9_-]+) @", out)
    if match:
        deployment_id = match.group(1)
        url = f"https://script.google.com/macros/s/{deployment_id}/exec"
        print(f"SUCCESS: {mod} -> {url}")
    else:
        print(f"FAILED to deploy {mod}. Output:\n{out}")
