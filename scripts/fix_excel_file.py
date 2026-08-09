import openpyxl
import sys
from pathlib import Path

from runtime_recap_builder import (
    SHEET_KELUAR,
    SHEET_MASUK,
    build_recap_rows_from_events,
    collect_factory_events,
    load_karyawan_map,
    recap_status_counts,
    rename_area_sheet_if_needed,
    repair_shift_labels,
    rewrite_recap_sheet,
    sanitize_nik_cells,
)


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")


REPO_ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = REPO_ROOT / "EMPLOYEE DATA.xlsx"
OUTPUT_PATH = EXCEL_PATH.parent / "EMPLOYEE DATA_CLEANED.xlsx"


def main():
    wb = openpyxl.load_workbook(EXCEL_PATH)

    print("==================================================")
    print("EXECUTING EXCEL DATA REPAIR PIPELINE")
    print("==================================================")

    # renamed = rename_area_sheet_if_needed(wb)
    # if renamed:
    #     print(f"[1/5] Renamed tab: {renamed}")
    # else:
    print("[1/5] Tab area kerja left as is to avoid 31-char limit in Excel")

    cleaned_niks = sanitize_nik_cells(wb)
    print(f"[2/5] Sanitized NIK values (.0 removed): {cleaned_niks} cells")

    masuk_shift_result = repair_shift_labels(wb[SHEET_MASUK], "masuk")
    keluar_shift_result = repair_shift_labels(wb[SHEET_KELUAR], "keluar")
    print(f"[3/5] Fixed masuk shift labels : {masuk_shift_result['fixed']} rows")
    print(f"[4/5] Fixed keluar shift labels: {keluar_shift_result['fixed']} rows")

    karyawan_map = load_karyawan_map(wb)
    masuk_events = collect_factory_events(wb[SHEET_MASUK], "masuk", karyawan_map)
    keluar_events = collect_factory_events(wb[SHEET_KELUAR], "keluar", karyawan_map)
    recap_rows = build_recap_rows_from_events(masuk_events["events"], keluar_events["events"])
    total_recap = rewrite_recap_sheet(wb, recap_rows)
    status_counts = recap_status_counts(recap_rows)

    print(f"[5/5] Rebuilt ABSEN IN OUT MK: {total_recap} rows")
    print(f"      - SELESAI            : {status_counts.get('SELESAI', 0)}")
    print(f"      - DI DALAM           : {status_counts.get('DI DALAM', 0)}")
    print(f"      - KELUAR TANPA MASUK : {status_counts.get('KELUAR TANPA MASUK', 0)}")
    print(f"      - Skipped masuk logs : {masuk_events['skipped']}")
    print(f"      - Skipped keluar logs: {keluar_events['skipped']}")

    wb.save(OUTPUT_PATH)
    print("==================================================")
    print(f"REPAIR COMPLETE. Saved to: {OUTPUT_PATH}")
    print("==================================================")


if __name__ == "__main__":
    main()
