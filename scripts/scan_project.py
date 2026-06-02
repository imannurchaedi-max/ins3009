from __future__ import annotations

from common_audit import REPORTS_DIR, ensure_reports_dir, scan_project


def main() -> None:
    ensure_reports_dir()
    audit = scan_project()
    output = REPORTS_DIR / "project_scan.json"
    output.write_text(audit.to_json(), encoding="utf-8")
    print(f"Scanned {len(audit.scanned_files)} source files")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
