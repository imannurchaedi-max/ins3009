import os
import subprocess
import re
import sys

DEPLOYMENT_LIMIT = 20
KEEP_RECENT_DEPLOYMENTS = 12


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
        print(f"Undeploying old deployment {item['id']} @ {item['version']}...")
        subprocess.run(
            ["clasp", "undeploy", item["id"]],
            cwd=path,
            shell=True,
            check=True,
        )


def deploy_module(name, path):
    print(f"Deploying {name}...")
    subprocess.run(["clasp", "push", "--force"], cwd=path, shell=True, check=True)
    ensure_deploy_capacity(path)
    res = subprocess.run(["clasp", "deploy"], cwd=path, capture_output=True, text=True, shell=True, check=True)
    output = (res.stdout or "") + (res.stderr or "")
    match = re.search(r'Deployed ([a-zA-Z0-9_-]+) @\d+', output)
    if not match:
        raise Exception(f"Failed to parse deployment ID for {name}: {output.strip()}")
    url = f"https://script.google.com/macros/s/{match.group(1)}/exec"
    print(f"{name} deployed: {url}")
    return url

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--include-home',
        action='store_true',
        help='Deprecated. HOME_PORTAL harus dipertahankan pada URL tetap dan tidak boleh ikut deploy biasa.'
    )
    args = parser.parse_args()

    if args.include_home:
        print("ERROR: HOME_PORTAL tidak boleh di-deploy lewat flow normal karena URL-nya harus tetap.")
        print("Gunakan scripts/deploy_home_fixed.py jika benar-benar perlu update HOME_PORTAL tanpa mengubah link.")
        sys.exit(1)

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    active = os.path.join(root, 'active')
    
    # Deploy modules
    gate_url = deploy_module("GATE_PABRIK", os.path.join(active, 'MODUL_GATE_PABRIK'))
    area_url = deploy_module("AREA_KERJA", os.path.join(active, 'MODUL_AREA_KERJA'))
    report_url = deploy_module("REPORT", os.path.join(active, 'MODUL_REPORT'))
    
    # Update config
    print("Updating config...")
    cmd = [
        "python", "scripts/update_config_sheet.py",
        "--gate-url", gate_url,
        "--area-url", area_url,
        "--report-url", report_url,
    ]

    subprocess.run(cmd, cwd=root, check=True)
    print("Done!")
