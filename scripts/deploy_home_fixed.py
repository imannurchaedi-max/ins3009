import argparse
import os
import re
import subprocess
import sys


def update_home_portal_deployment(home_path, deployment_id, description):
    subprocess.run(["clasp", "push", "--force"], cwd=home_path, shell=True, check=True)
    result = subprocess.run(
        ["clasp", "deploy", "-i", deployment_id, "--description", description],
        cwd=home_path,
        capture_output=True,
        text=True,
        shell=True,
        check=True,
    )
    output = result.stdout + result.stderr
    match = re.search(r"Deployed ([a-zA-Z0-9_-]+) @\\d+", output)
    stable_id = match.group(1) if match else deployment_id
    url = f"https://script.google.com/macros/s/{stable_id}/exec"
    return url, output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Update HOME_PORTAL in place so the public exec URL stays fixed."
    )
    parser.add_argument(
        "--deployment-id",
        required=True,
        help="Deployment ID HOME_PORTAL yang ingin di-update in place.",
    )
    parser.add_argument(
        "--description",
        default="Update HOME_PORTAL without changing URL",
        help="Deployment description.",
    )
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    home_path = os.path.join(root, "active", "HOME_PORTAL")

    try:
        url, output = update_home_portal_deployment(home_path, args.deployment_id, args.description)
    except subprocess.CalledProcessError as err:
        print(err.stdout or "", end="")
        print(err.stderr or "", end="")
        sys.exit(err.returncode or 1)

    print(output.strip())
    print(f"HOME_PORTAL updated in place: {url}")
