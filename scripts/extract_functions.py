from __future__ import annotations

from common_audit import REPORTS_DIR, ensure_reports_dir, scan_project


def rows(title: str, items) -> list[str]:
    lines = [f"## {title}", "", "| Name | Kind | File | Line | Detail |", "|---|---|---:|---:|---|"]
    for item in sorted(items, key=lambda f: (f.file, f.line, f.name)):
        lines.append(f"| `{item.name}` | {item.kind} | `{item.file}` | {item.line} | {item.detail or ''} |")
    if not items:
        lines.append("| _None found_ |  |  |  |  |")
    lines.append("")
    return lines


def main() -> None:
    ensure_reports_dir()
    audit = scan_project()
    lines = ["# Function and Dependency Extraction", ""]
    lines += rows("GAS Functions", audit.gas_functions)
    lines += rows("Frontend Functions", audit.frontend_functions)
    lines += rows("Frontend Calls to GAS", audit.frontend_server_calls)
    lines += rows("HTML Includes", audit.includes)
    lines += rows("Sheet Constants", audit.sheet_constants)
    lines += rows("Sheet Dependencies", audit.sheet_dependencies)
    lines += rows("Internal GAS Calls", audit.internal_gas_calls)

    output = REPORTS_DIR / "function_inventory.md"
    output.write_text("\n".join(lines), encoding="utf-8")
    print(f"Extracted {len(audit.gas_functions)} GAS functions and {len(audit.frontend_functions)} frontend functions")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
