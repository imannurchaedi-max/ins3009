import os
import subprocess
import re

def deploy_module(name, path):
    print(f"Deploying {name}...")
    subprocess.run(["clasp", "push", "--force"], cwd=path, shell=True, check=True)
    res = subprocess.run(["clasp", "deploy"], cwd=path, capture_output=True, text=True, shell=True, check=True)
    match = re.search(r'Deployed ([a-zA-Z0-9_-]+) @\d+', res.stdout)
    if not match:
        raise Exception(f"Failed to parse deployment ID for {name}")
    url = f"https://script.google.com/macros/s/{match.group(1)}/exec"
    print(f"{name} deployed: {url}")
    return url

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--include-home', action='store_true', help='Include HOME_PORTAL in deployment')
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    active = os.path.join(root, 'active')
    
    # Deploy modules
    gate_url = deploy_module("GATE_PABRIK", os.path.join(active, 'MODUL_GATE_PABRIK'))
    area_url = deploy_module("AREA_KERJA", os.path.join(active, 'MODUL_AREA_KERJA'))
    report_url = deploy_module("REPORT", os.path.join(active, 'MODUL_REPORT'))
    
    home_url = None
    if args.include_home:
        home_url = deploy_module("HOME_PORTAL", os.path.join(active, 'HOME_PORTAL'))
    
    # Update config
    print("Updating config...")
    cmd = [
        "python", "scripts/update_config_sheet.py",
        "--gate-url", gate_url,
        "--area-url", area_url,
        "--report-url", report_url
    ]
    if home_url:
        cmd.extend(["--home-url", home_url])
        
    subprocess.run(cmd, cwd=root, check=True)
    print("Done!")

