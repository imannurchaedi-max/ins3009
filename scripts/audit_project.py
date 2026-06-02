from __future__ import annotations

from common_audit import REPORTS_DIR, ensure_reports_dir, names, scan_project


def md_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    if not rows:
        lines.append("| " + " | ".join(["_None_"] + [""] * (len(headers) - 1)) + " |")
    lines.append("")
    return lines


def first_file_line(items, name: str) -> str:
    for item in items:
        if item.name == name:
            return f"`{item.file}:{item.line}`"
    return ""


def main() -> None:
    ensure_reports_dir()
    audit = scan_project()

    gas_names = names(audit.gas_functions)
    frontend_calls = names(audit.frontend_server_calls)
    missing_frontend_targets = sorted(frontend_calls - gas_names)
    uncached_backend_functions = sorted(frontend_calls & gas_names)

    lines = [
        "# GAS Runtime Audit",
        "",
        "## Summary",
        "",
        f"- Scanned files: {len(audit.scanned_files)}",
        f"- GAS backend functions: {len(gas_names)}",
        f"- Frontend functions: {len(audit.frontend_functions)}",
        f"- Frontend `google.script.run` calls: {len(audit.frontend_server_calls)} unique {len(frontend_calls)}",
        f"- Sheet constants: {len(audit.sheet_constants)}",
        f"- Sheet dependencies: {len(audit.sheet_dependencies)}",
        "",
        "## Critical Issues",
        "",
    ]

    critical = []
    if missing_frontend_targets:
        critical.append(
            f"{len(missing_frontend_targets)} frontend server calls reference GAS functions that were not found."
        )
    if not audit.sheet_constants:
        critical.append("No `SHEET_*` constants were found, so spreadsheet dependencies are unclear.")
    if not frontend_calls:
        critical.append("No active `google.script.run` calls were found in the frontend.")

    lines.extend(f"- {issue}" for issue in critical)
    if not critical:
        lines.append("- No missing GAS runtime dependencies were detected by static scan.")
    lines.append("")

    lines += ["## Missing Functions", ""]
    lines += md_table(
        ["Frontend Server Call", "Frontend Location", "Status"],
        [
            [f"`{name}`", first_file_line(audit.frontend_server_calls, name), "missing backend GAS function"]
            for name in missing_frontend_targets
        ],
    )

    lines += ["## Broken Dependencies", ""]
    lines += md_table(
        ["Dependency", "Location", "Issue"],
        [
            [f"`{item.name}`", f"`{item.file}:{item.line}`", "sheet dependency references a non-constant name"]
            for item in audit.sheet_dependencies
            if not item.name.startswith("SHEET_") and item.name != "name"
        ],
    )

    lines += ["## Active Runtime Mapping", ""]
    lines += md_table(
        ["Frontend GAS Call", "Backend Function", "Frontend Caller", "Sheet Dependency", "Runtime Risk"],
        [
            [
                f"`{name}`",
                f"`{name}`" if name in gas_names else "_missing_",
                ", ".join(
                    f"`{call.file}:{call.line}`" for call in audit.frontend_server_calls if call.name == name
                ),
                "sheet-backed" if name in gas_names else "unknown",
                "covered" if name in gas_names else "missing backend function",
            ]
            for name in sorted(frontend_calls)
        ],
    )

    sheet_rows = []
    for key, label in sorted({item.name: item.detail for item in audit.sheet_constants}.items()):
        sheet_rows.append([f"`{key}`", label, "used by GAS runtime"])
    lines += ["## Sheet Dependencies", ""]
    lines += md_table(["Sheet Constant", "Spreadsheet Sheet", "Status"], sheet_rows)

    lines += [
        "## Recommended Fix Order",
        "",
        "1. Keep active `google.script.run` calls aligned with real GAS backend function names.",
        "2. Prioritise runtime-critical flows: login, masuk, keluar, security scan, dashboard, and reports.",
        "3. Validate sheet headers whenever spreadsheet structure changes.",
        "4. Review legacy frontend code paths that are no longer rendered by `Index.html`.",
        "5. Re-run the Python audit scripts after every structural frontend/backend update.",
        "",
        "## Generated Artifacts",
        "",
        "- `reports/project_scan.json` from `scripts/scan_project.py`",
        "- `reports/function_inventory.md` from `scripts/extract_functions.py`",
        "- `reports/gas_runtime_comparison.json` from `scripts/compare_gas_runtime.py`",
    ]

    report = REPORTS_DIR / "GAS_RUNTIME_AUDIT.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    (REPORTS_DIR / "project_scan.json").write_text(audit.to_json(), encoding="utf-8")
    print(f"Wrote {report}")


if __name__ == "__main__":
    main()
