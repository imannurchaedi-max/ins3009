import openpyxl
import sys
from pathlib import Path

from runtime_recap_builder import (
    SHEET_KELUAR,
    SHEET_MASUK,
    as_text,
    build_recap_rows_from_events,
    clean_nik,
    collect_factory_events,
    format_date,
    load_existing_recap_rows,
    load_karyawan_map,
    parse_sheet_date,
    recap_status_counts,
)


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")


REPO_ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = REPO_ROOT / "EMPLOYEE DATA.xlsx"


def build_key_map(rows):
    result = {}
    for row in rows:
        parsed = parse_sheet_date(row[0])
        tanggal = format_date(parsed) if parsed else as_text(row[0]).strip()
        nik = clean_nik(row[1])
        if not tanggal or not nik:
            continue
        result[f"{tanggal}|{nik}"] = row
    return result


def normalize_row_tail(row):
    normalized = []
    for value in row[5:10]:
        text = str(value).strip() if value is not None else ""
        normalized.append(text)
    return normalized


def main():
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    karyawan_map = load_karyawan_map(wb)

    masuk_result = collect_factory_events(wb[SHEET_MASUK], "masuk", karyawan_map)
    keluar_result = collect_factory_events(wb[SHEET_KELUAR], "keluar", karyawan_map)
    rebuilt_rows = build_recap_rows_from_events(masuk_result["events"], keluar_result["events"])
    existing_rows = load_existing_recap_rows(wb)

    rebuilt_map = build_key_map(rebuilt_rows)
    existing_map = build_key_map(existing_rows)

    missing_keys = sorted(set(rebuilt_map) - set(existing_map))
    extra_keys = sorted(set(existing_map) - set(rebuilt_map))
    mismatch_keys = []

    for key in sorted(set(rebuilt_map) & set(existing_map)):
        rebuilt = rebuilt_map[key]
        existing = existing_map[key]
        rebuilt_core = normalize_row_tail(rebuilt)
        existing_core = normalize_row_tail(existing)
        if rebuilt_core != existing_core:
            mismatch_keys.append(key)

    rebuilt_counts = recap_status_counts(rebuilt_rows)
    existing_counts = recap_status_counts(existing_rows)

    print("=== SIMULASI REBUILD RECAP BERDASARKAN LOG PRIMER ===")
    print(f"Workbook: {EXCEL_PATH.name}")
    print(f"Event masuk valid  : {len(masuk_result['events'])}")
    print(f"Event keluar valid : {len(keluar_result['events'])}")
    print(f"Baris recap eksisting : {len(existing_rows)}")
    print(f"Baris recap hasil rebuild runtime : {len(rebuilt_rows)}")
    print("")
    print("Status recap eksisting :", dict(existing_counts))
    print("Status recap rebuild   :", dict(rebuilt_counts))
    print("")
    print(f"Key baru yang belum ada di recap : {len(missing_keys)}")
    print(f"Key ekstra di recap lama         : {len(extra_keys)}")
    print(f"Key sama tapi isi berbeda        : {len(mismatch_keys)}")
    print("")

    if missing_keys:
        print("Contoh key yang hilang dari recap lama:")
        for key in missing_keys[:10]:
            print("  ", key, "->", rebuilt_map[key])
        print("")

    if extra_keys:
        print("Contoh key ekstra di recap lama:")
        for key in extra_keys[:10]:
            print("  ", key, "->", existing_map[key])
        print("")

    if mismatch_keys:
        print("Contoh key yang sama tapi hasilnya beda:")
        for key in mismatch_keys[:10]:
            print("  ", key)
            print("     lama :", existing_map[key])
            print("     baru :", rebuilt_map[key])


if __name__ == "__main__":
    main()
