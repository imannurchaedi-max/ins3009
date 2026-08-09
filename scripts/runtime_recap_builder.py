from collections import Counter
from datetime import datetime

from runtime_shift_rules import (
    as_text,
    clean_nik,
    detect_shift,
    format_date,
    normalize_time,
    parse_sheet_date,
    resolve_factory_work_date,
)


SHEET_KARYAWAN = "KARYAWAN"
SHEET_MASUK = "REGISTRASI SAAT MASUK PABRIK"
SHEET_KELUAR = "REGISTRASI SAAT KELUAR PABRIK"
SHEET_RECAP = "ABSEN IN OUT MK"
AREA_SHEET_TRUNCATED = "REGISTRASI MASUK KELUAR AREA KE"
AREA_SHEET_CANONICAL = "REGISTRASI MASUK KELUAR AREA KERJA"


def get_recap_status(jam_masuk, jam_keluar):
    if jam_masuk and jam_keluar:
        return "SELESAI"
    if jam_masuk:
        return "DI DALAM"
    if jam_keluar:
        return "KELUAR TANPA MASUK"
    return ""


def find_area_sheet_name(sheet_names):
    if AREA_SHEET_CANONICAL in sheet_names:
        return AREA_SHEET_CANONICAL
    if AREA_SHEET_TRUNCATED in sheet_names:
        return AREA_SHEET_TRUNCATED
    for sheet_name in sheet_names:
        if sheet_name.startswith("REGISTRASI MASUK KELUAR AREA"):
            return sheet_name
    return None


def rename_area_sheet_if_needed(workbook):
    if AREA_SHEET_CANONICAL in workbook.sheetnames:
        return None
    if AREA_SHEET_TRUNCATED not in workbook.sheetnames:
        return None
    sheet = workbook[AREA_SHEET_TRUNCATED]
    sheet.title = AREA_SHEET_CANONICAL
    return f"{AREA_SHEET_TRUNCATED} -> {AREA_SHEET_CANONICAL}"


def load_karyawan_map(workbook):
    if SHEET_KARYAWAN not in workbook.sheetnames:
        return {}

    ws = workbook[SHEET_KARYAWAN]
    karyawan_map = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        nik = clean_nik(row[0] if len(row) > 0 else "")
        if not nik:
            continue
        karyawan_map[nik] = {
            "nama": as_text(row[1] if len(row) > 1 else ""),
            "type": as_text(row[2] if len(row) > 2 else ""),
            "dept": as_text(row[3] if len(row) > 3 else ""),
            "jabatan": as_text(row[4] if len(row) > 4 else ""),
            "userLevel": as_text(row[5] if len(row) > 5 else ""),
        }
    return karyawan_map


def sanitize_nik_cells(workbook):
    cleaned = 0
    for sheet_name in workbook.sheetnames:
        ws = workbook[sheet_name]
        headers = [as_text(cell.value) for cell in ws[1]]
        nik_col_idx = None
        for idx, header in enumerate(headers, start=1):
            if header.upper() == "NIK":
                nik_col_idx = idx
                break
        if not nik_col_idx:
            continue

        for row_idx in range(2, ws.max_row + 1):
            value = ws.cell(row=row_idx, column=nik_col_idx).value
            text = as_text(value)
            clean = clean_nik(value)
            if text and text != clean:
                ws.cell(row=row_idx, column=nik_col_idx).value = clean
                cleaned += 1
    return cleaned


def repair_shift_labels(ws, event_type, shift_col_idx=6, time_col_idx=5):
    fixed = 0
    samples = []
    for row_idx in range(2, ws.max_row + 1):
        time_value = ws.cell(row=row_idx, column=time_col_idx).value
        old_shift = as_text(ws.cell(row=row_idx, column=shift_col_idx).value)
        new_shift = detect_shift(time_value, event_type)
        if old_shift != new_shift:
            ws.cell(row=row_idx, column=shift_col_idx).value = new_shift
            fixed += 1
            if len(samples) < 10:
                samples.append(
                    {
                        "row": row_idx,
                        "oldShift": old_shift,
                        "newShift": new_shift,
                        "time": normalize_time(time_value),
                        "nik": clean_nik(ws.cell(row=row_idx, column=2).value),
                    }
                )
    return {"fixed": fixed, "samples": samples}


def collect_factory_events(ws, event_type, karyawan_map=None):
    karyawan_map = karyawan_map or {}
    events = []
    skipped = 0

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        card = as_text(row[0] if len(row) > 0 else "")
        nik = clean_nik(row[1] if len(row) > 1 else "")
        nama = as_text(row[2] if len(row) > 2 else "")
        tanggal = row[3] if len(row) > 3 else ""
        time_value = row[4] if len(row) > 4 else ""
        loker = as_text(row[6] if len(row) > 6 else "")

        parsed_date = parse_sheet_date(tanggal)
        jam_str = normalize_time(time_value)
        if not nik or not parsed_date or not jam_str:
            skipped += 1
            continue

        master = karyawan_map.get(nik, {})
        work_context = resolve_factory_work_date(parsed_date, time_value, event_type)
        events.append(
            {
                "row": row_idx,
                "eventType": event_type,
                "nik": nik,
                "nama": nama or master.get("nama", ""),
                "dept": master.get("dept", ""),
                "jabatan": master.get("jabatan", ""),
                "card": card,
                "loker": loker,
                "eventDate": format_date(parsed_date),
                "recapDate": as_text(work_context.get("tanggal")),
                "shift": as_text(work_context.get("shiftLabel")) or detect_shift(time_value, event_type),
                "jamStr": jam_str,
                "timeMs": _date_to_millis(parsed_date) + _time_to_millis(jam_str),
            }
        )

    return {"events": events, "skipped": skipped}


def build_recap_rows_from_events(masuk_events, keluar_events):
    grouped = {}

    def ensure_group(event):
        key = f"{event['nik']}|{event['recapDate']}"
        if key not in grouped:
            grouped[key] = {
                "tanggal": event["recapDate"],
                "nik": event["nik"],
                "nama": event["nama"],
                "dept": event["dept"],
                "jabatan": event["jabatan"],
                "firstMasuk": None,
                "lastKeluar": None,
            }
        group = grouped[key]
        if not group["nama"] and event["nama"]:
            group["nama"] = event["nama"]
        if not group["dept"] and event["dept"]:
            group["dept"] = event["dept"]
        if not group["jabatan"] and event["jabatan"]:
            group["jabatan"] = event["jabatan"]
        return group

    for event in masuk_events or []:
        group = ensure_group(event)
        if not group["firstMasuk"] or event["timeMs"] < group["firstMasuk"]["timeMs"]:
            group["firstMasuk"] = event

    for event in keluar_events or []:
        group = ensure_group(event)
        if not group["lastKeluar"] or event["timeMs"] > group["lastKeluar"]["timeMs"]:
            group["lastKeluar"] = event

    rows = []
    for key in sorted(grouped.keys(), key=_group_sort_key):
        group = grouped[key]
        masuk_event = group["firstMasuk"]
        keluar_event = group["lastKeluar"]
        jam_masuk = masuk_event["jamStr"] if masuk_event else ""
        jam_keluar = keluar_event["jamStr"] if keluar_event else ""
        rows.append(
            [
                group["tanggal"],
                group["nik"],
                group["nama"],
                group["dept"],
                group["jabatan"],
                jam_masuk,
                jam_keluar,
                get_recap_status(jam_masuk, jam_keluar),
                masuk_event["card"] if masuk_event else (keluar_event["card"] if keluar_event else ""),
                masuk_event["loker"] if masuk_event else (keluar_event["loker"] if keluar_event else ""),
            ]
        )

    return rows


def recap_status_counts(rows):
    return Counter(as_text(row[7]).upper() for row in rows if row and len(row) > 7)


def load_existing_recap_rows(workbook):
    if SHEET_RECAP not in workbook.sheetnames:
        return []
    ws = workbook[SHEET_RECAP]
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not any(cell not in (None, "") for cell in row):
            continue
        rows.append(list(row[:10]))
    return rows


def rewrite_recap_sheet(workbook, rows):
    ws = workbook[SHEET_RECAP]
    if ws.max_row > 1:
        ws.delete_rows(2, ws.max_row - 1)
    for row in rows:
        ws.append(row)
    return len(rows)


def _group_sort_key(key):
    nik_date = key.split("|", 1)
    if len(nik_date) != 2:
        return ("99999999", key, "")
    nik, recap_date = nik_date
    parsed = parse_sheet_date(recap_date)
    sort_date = parsed.strftime("%Y%m%d") if parsed else "99999999"
    return (sort_date, nik, recap_date)


def _time_to_millis(time_text):
    parts = normalize_time(time_text).split(":")
    if len(parts) != 3:
        return 0
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = int(parts[2])
    return ((hours * 60 + minutes) * 60 + seconds) * 1000


def _date_to_millis(parsed_date):
    dt = datetime(parsed_date.year, parsed_date.month, parsed_date.day)
    return int(dt.timestamp() * 1000)
