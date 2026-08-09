import argparse
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ACTIVE_DIR = ROOT / "active"
WATCH_FILE_EXTENSIONS = {".gs", ".js", ".html", ".json"}


def iter_watched_files():
    if ACTIVE_DIR.exists():
        for path in sorted(ACTIVE_DIR.rglob("*")):
            if path.is_file() and path.suffix.lower() in WATCH_FILE_EXTENSIONS:
                yield path
    module_config = ROOT / "scripts" / "module-config.json"
    if module_config.exists():
        yield module_config


def build_snapshot():
    snapshot = {}
    for path in iter_watched_files():
        try:
            snapshot[str(path)] = path.stat().st_mtime_ns
        except FileNotFoundError:
            continue
    return snapshot


def find_changed_paths(old_snapshot, new_snapshot):
    changed = []
    for path, mtime in new_snapshot.items():
        if old_snapshot.get(path) != mtime:
            changed.append(path)
    for path in old_snapshot:
        if path not in new_snapshot:
            changed.append(path)
    return sorted(set(changed))


def run_deploy(command):
    print(f"[autodeploy] running: {' '.join(command)}")
    result = subprocess.run(command, cwd=ROOT, shell=True)
    return result.returncode


def main():
    parser = argparse.ArgumentParser(description="Watch runtime files and auto deploy on change.")
    parser.add_argument("--push-only", action="store_true", help="Run `npm run push` instead of `npm run deploy`.")
    parser.add_argument("--interval", type=int, default=2, help="Polling interval in seconds.")
    parser.add_argument("--debounce", type=int, default=4, help="Debounce delay in seconds before deploying.")
    args = parser.parse_args()

    command = ["npm", "run", "push" if args.push_only else "deploy"]
    snapshot = build_snapshot()
    print("[autodeploy] watcher active")
    print(f"[autodeploy] command: {' '.join(command)}")
    print(f"[autodeploy] watching: {ACTIVE_DIR}")

    while True:
        time.sleep(max(1, args.interval))
        new_snapshot = build_snapshot()
        changed_paths = find_changed_paths(snapshot, new_snapshot)
        if not changed_paths:
            snapshot = new_snapshot
            continue

        print("[autodeploy] change detected:")
        for changed_path in changed_paths:
            try:
                rel_path = Path(changed_path).relative_to(ROOT)
            except ValueError:
                rel_path = Path(changed_path)
            print(f"  - {rel_path.as_posix()}")

        time.sleep(max(1, args.debounce))
        latest_snapshot = build_snapshot()
        latest_changed = find_changed_paths(new_snapshot, latest_snapshot)
        while latest_changed:
            new_snapshot = latest_snapshot
            print("[autodeploy] additional changes detected during debounce, waiting again...")
            time.sleep(max(1, args.debounce))
            latest_snapshot = build_snapshot()
            latest_changed = find_changed_paths(new_snapshot, latest_snapshot)

        exit_code = run_deploy(command)
        if exit_code != 0:
            print(f"[autodeploy] command failed with exit code {exit_code}")
        else:
            print("[autodeploy] command completed successfully")
        snapshot = build_snapshot()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[autodeploy] watcher stopped")
        sys.exit(0)
