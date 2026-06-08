from __future__ import annotations

import json

from common_audit import REPORTS_DIR, ensure_reports_dir, names, scan_project


def build_comparison() -> dict:
    audit = scan_project()
    gas_names = names(audit.gas_functions)
    frontend_calls = names(audit.frontend_server_calls)
    sheet_constants = names(audit.sheet_constants)

    return {
        "summary": {
            "gas_functions": len(gas_names),
            "frontend_functions": len(audit.frontend_functions),
            "frontend_gas_calls": len(frontend_calls),
            "sheet_constants": len(sheet_constants),
        },
        "frontend_calls_missing_gas": sorted(frontend_calls - gas_names),
        "gas_not_called_by_frontend": sorted(gas_names - frontend_calls),
        "frontend_calls_covered_by_gas": sorted(frontend_calls & gas_names),
        "sheet_constants": sorted(sheet_constants),
        "runtime_status": "ok" if frontend_calls <= gas_names else "missing backend targets",
    }


def main() -> None:
    ensure_reports_dir()
    comparison = build_comparison()
    output = REPORTS_DIR / "gas_runtime_comparison.json"
    output.write_text(json.dumps(comparison, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(comparison["summary"], indent=2))
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
