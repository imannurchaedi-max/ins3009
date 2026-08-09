import re
from datetime import date, datetime, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = REPO_ROOT / "EMPLOYEE DATA.xlsx"


SHIFT_CONFIG = {
    "Shift 1": {
        "startTotal": 6 * 60,
        "endTotal": 13 * 60 + 59,
        "preStartMinutes": 60,
        "postEndMinutes": 120,
        "crossMidnight": False,
    },
    "Shift 2": {
        "startTotal": 14 * 60,
        "endTotal": 21 * 60 + 59,
        "preStartMinutes": 60,
        "postEndMinutes": 120,
        "crossMidnight": False,
    },
    "Shift 3": {
        "startTotal": 22 * 60,
        "endTotal": 5 * 60 + 59,
        "preStartMinutes": 60,
        "postEndMinutes": 120,
        "crossMidnight": True,
    },
    "Non Shift 08:00-16:00": {
        "startTotal": 8 * 60,
        "endTotal": 16 * 60,
        "preStartMinutes": 60,
        "postEndMinutes": 120,
        "crossMidnight": False,
    },
    "Non Shift 10:00-18:00": {
        "startTotal": 10 * 60,
        "endTotal": 18 * 60,
        "preStartMinutes": 60,
        "postEndMinutes": 120,
        "crossMidnight": False,
    },
}


def as_text(value):
    if value is None:
        return ""
    text = str(value).strip()
    return text[:-2] if text.endswith(".0") else text


def clean_nik(value):
    return as_text(value)


def parse_sheet_date(value):
    if isinstance(value, datetime):
        return date(value.year, value.month, value.day)
    if isinstance(value, date):
        return value

    text = as_text(value)
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def format_date(value):
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return as_text(value)


def parse_date_str(value):
    parsed = parse_sheet_date(value)
    if not parsed:
        text = as_text(value)
        return text, text, None
    return parsed.strftime("%d/%m/%Y"), parsed.strftime("%Y%m%d"), datetime(parsed.year, parsed.month, parsed.day)


def normalize_time(value):
    if isinstance(value, datetime):
        return value.strftime("%H:%M:%S")
    text = as_text(value)
    match = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", text)
    if not match:
        return ""
    return f"{int(match.group(1)):02d}:{int(match.group(2)):02d}:{int(match.group(3) or 0):02d}"


def parse_time_mins(value):
    if isinstance(value, datetime):
        return value.hour * 60 + value.minute, value.strftime("%H:%M:%S")
    text = as_text(value)
    match = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", text)
    if not match:
        return None, text
    hour = int(match.group(1))
    minute = int(match.group(2))
    second = int(match.group(3) or 0)
    return hour * 60 + minute, f"{hour:02d}:{minute:02d}:{second:02d}"


def time_to_minutes(value):
    minutes, _ = parse_time_mins(value)
    return minutes


def get_shift_range(label):
    cfg = SHIFT_CONFIG[label]
    end_abs = cfg["endTotal"] + 24 * 60 if cfg["crossMidnight"] or cfg["endTotal"] < cfg["startTotal"] else cfg["endTotal"]
    return {
        "label": label,
        "startAbs": cfg["startTotal"],
        "endAbs": end_abs,
        "startTotal": cfg["startTotal"],
        "preStartMinutes": cfg["preStartMinutes"],
        "postEndMinutes": cfg["postEndMinutes"],
        "crossMidnight": cfg["crossMidnight"],
    }


def get_shift_event_match(label, minute, event_type):
    shift_range = get_shift_range(label)
    if minute is None:
        return {"matches": False, "distance": float("inf"), "actualAbs": None}

    mode = "keluar" if event_type == "keluar" else "masuk"
    window_start = shift_range["startAbs"] - shift_range["preStartMinutes"] if mode == "masuk" else shift_range["startAbs"]
    window_end = shift_range["endAbs"] + shift_range["postEndMinutes"] if mode == "keluar" else shift_range["endAbs"]
    ref_point = shift_range["startAbs"] if mode == "masuk" else shift_range["endAbs"]

    best_actual = None
    best_distance = float("inf")
    for actual_abs in (minute, minute + 24 * 60):
        if actual_abs < window_start or actual_abs > window_end:
            continue
        distance = abs(actual_abs - ref_point)
        if distance < best_distance:
            best_distance = distance
            best_actual = actual_abs

    return {
        "matches": best_actual is not None,
        "distance": best_distance,
        "actualAbs": best_actual,
    }


def detect_shift(value, event_type):
    minute = time_to_minutes(value)
    if minute is None:
        return "Shift 1"

    best_label = "Shift 1"
    best_distance = float("inf")
    for label in ("Shift 1", "Shift 2", "Shift 3"):
        match = get_shift_event_match(label, minute, event_type)
        if not match["matches"]:
            continue
        if match["distance"] < best_distance:
            best_label = label
            best_distance = match["distance"]
    return best_label


def resolve_factory_work_date(tanggal, time_value, event_type):
    base_date = parse_sheet_date(tanggal)
    normalized_date = format_date(base_date) if base_date else as_text(tanggal)
    shift_label = detect_shift(time_value, event_type)
    minute = time_to_minutes(time_value)
    shift_range = get_shift_range(shift_label)

    if not base_date:
        return {"tanggal": normalized_date, "shiftLabel": shift_label, "source": "raw"}

    if shift_label == "Shift 3" and minute is not None and minute < shift_range["startTotal"]:
        previous_date = base_date - timedelta(days=1)
        return {
            "tanggal": format_date(previous_date),
            "shiftLabel": shift_label,
            "source": "shift3_prev_day",
        }

    return {"tanggal": normalized_date, "shiftLabel": shift_label, "source": "same_day"}
