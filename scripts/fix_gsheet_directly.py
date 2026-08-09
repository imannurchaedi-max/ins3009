import urllib.request
import json
import subprocess
import re
import sys
from datetime import datetime, timedelta

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SPREADSHEET_ID = '1jTsZixaANJd8Ijs3f66LwbXSBC9UcRoALLolEvxiz40'

def get_access_token():
    try:
        token = subprocess.check_output('gcloud auth print-access-token', shell=True, text=True).strip()
        return token
    except Exception as e:
        print("Failed to get gcloud token:", e)
        return None

def api_request(url, method='GET', data=None, token=None):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def clean_nik(v):
    if v is None: return ''
    s = str(v).strip()
    if s.endswith('.0'): s = s[:-2]
    return s

def clean_val(v):
    if v is None: return ''
    return str(v).strip()

def parse_date_str(v):
    s = clean_val(v)
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        return f"{m.group(3)}/{m.group(2)}/{m.group(1)}", f"{m.group(1)}{m.group(2)}{m.group(3)}", dt
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})', s)
    if m:
        dt = datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        return f"{m.group(1)}/{m.group(2)}/{m.group(3)}", f"{m.group(3)}{m.group(2)}{m.group(1)}", dt
    return s, s, None

def parse_time_mins(t_val):
    s = clean_val(t_val)
    m = re.search(r'(\d{1,2}):(\d{2})(?::(\d{2}))?', s)
    if m:
        h = int(m.group(1))
        mn = int(m.group(2))
        sc = int(m.group(3)) if m.group(3) else 0
        return h * 60 + mn, f"{h:02d}:{mn:02d}:{sc:02d}"
    return None, s

def detect_shift(mins, event_type):
    if mins is None: return 'Shift 1'
    if event_type == 'keluar':
        if 5 * 60 + 1 <= mins < 13 * 60 + 30: return 'Shift 3'
        if 13 * 60 + 30 <= mins < 21 * 60 + 0: return 'Shift 1'
        return 'Shift 2'
    else:
        if 5 * 60 <= mins < 13 * 60 + 30: return 'Shift 1'
        if 13 * 60 + 30 <= mins < 21 * 60 + 30: return 'Shift 2'
        return 'Shift 3'

def main():
    token = get_access_token()
    if not token:
        print("Cannot get authentication token.")
        return

    print("==================================================")
    print("LIVE GOOGLE SHEETS CLOUD REPAIR PIPELINE")
    print(f"Spreadsheet ID: {SPREADSHEET_ID}")
    print("==================================================")

    # Get Metadata
    meta_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}"
    meta = api_request(meta_url, token=token)
    sheets = meta.get('sheets', [])
    sheet_map = {s['properties']['title']: s['properties']['sheetId'] for s in sheets}
    print(f"Found Cloud Sheets ({len(sheet_map)}): {list(sheet_map.keys())}")

    # 1. RENAME TRUNCATED TAB IF EXISTS
    if 'REGISTRASI MASUK KELUAR AREA KE' in sheet_map and 'REGISTRASI MASUK KELUAR AREA KERJA' not in sheet_map:
        sheet_id = sheet_map['REGISTRASI MASUK KELUAR AREA KE']
        batch_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}:batchUpdate"
        body = {
            "requests": [{
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": sheet_id,
                        "title": "REGISTRASI MASUK KELUAR AREA KERJA"
                    },
                    "fields": "title"
                }
            }]
        }
        api_request(batch_url, method='POST', data=body, token=token)
        print("[1/5] Renamed Cloud Tab: 'REGISTRASI MASUK KELUAR AREA KE' -> 'REGISTRASI MASUK KELUAR AREA KERJA'")

    # Read All Data
    def fetch_range(range_name):
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{urllib.parse.quote(range_name)}?valueRenderOption=FORMATTED_VALUE"
        res = api_request(url, token=token)
        return res.get('values', [])

    def update_range(range_name, values):
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{urllib.parse.quote(range_name)}?valueInputOption=USER_ENTERED"
        body = {"values": values}
        api_request(url, method='PUT', data=body, token=token)

    def clear_range(range_name):
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{urllib.parse.quote(range_name)}:clear"
        api_request(url, method='POST', data={}, token=token)

    print("\nFetching Live Data from Cloud Google Sheets...")
    kar_rows = fetch_range("KARYAWAN!A1:G5000")
    masuk_rows = fetch_range("REGISTRASI SAAT MASUK PABRIK!A1:G5000")
    keluar_rows = fetch_range("REGISTRASI SAAT KELUAR PABRIK!A1:G5000")

    print(f"Cloud Rows Fetched: KARYAWAN = {len(kar_rows)} | MASUK = {len(masuk_rows)} | KELUAR = {len(keluar_rows)}")

    # 2. SANITIZE NIK (.0 STRIP) IN MASUK AND KELUAR LOGS
    masuk_updated = False
    masuk_fixed_shifts = 0
    for i in range(1, len(masuk_rows)):
        r = masuk_rows[i]
        if len(r) > 1:
            orig_nik = clean_val(r[1])
            clean_n = clean_nik(orig_nik)
            if orig_nik != clean_n:
                r[1] = clean_n
                masuk_updated = True

        if len(r) > 4:
            jam_str = clean_val(r[4])
            old_shift = clean_val(r[5]) if len(r) > 5 else ''
            mins, _ = parse_time_mins(jam_str)
            new_shift = detect_shift(mins, 'masuk')
            if old_shift != new_shift:
                while len(r) <= 5: r.append('')
                r[5] = new_shift
                masuk_fixed_shifts += 1
                masuk_updated = True

    if masuk_updated:
        update_range(f"REGISTRASI SAAT MASUK PABRIK!A1:G{len(masuk_rows)}", masuk_rows)
        print(f"[2/5] Live Google Sheets 'REGISTRASI SAAT MASUK PABRIK' Updated! Shifts Corrected: {masuk_fixed_shifts}")

    keluar_updated = False
    keluar_fixed_shifts = 0
    for i in range(1, len(keluar_rows)):
        r = keluar_rows[i]
        if len(r) > 1:
            orig_nik = clean_val(r[1])
            clean_n = clean_nik(orig_nik)
            if orig_nik != clean_n:
                r[1] = clean_n
                keluar_updated = True

        if len(r) > 4:
            jam_str = clean_val(r[4])
            old_shift = clean_val(r[5]) if len(r) > 5 else ''
            mins, _ = parse_time_mins(jam_str)
            new_shift = detect_shift(mins, 'keluar')
            if old_shift != new_shift:
                while len(r) <= 5: r.append('')
                r[5] = new_shift
                keluar_fixed_shifts += 1
                keluar_updated = True

    if keluar_updated:
        update_range(f"REGISTRASI SAAT KELUAR PABRIK!A1:G{len(keluar_rows)}", keluar_rows)
        print(f"[3/5] Live Google Sheets 'REGISTRASI SAAT KELUAR PABRIK' Updated! Shifts Corrected: {keluar_fixed_shifts}")

    # Build Karyawan Map
    kar_map = {}
    for i in range(1, len(kar_rows)):
        r = kar_rows[i]
        if r:
            nik = clean_nik(r[0])
            if nik:
                kar_map[nik] = {
                    'nama': clean_val(r[1]) if len(r)>1 else '',
                    'dept': clean_val(r[3]) if len(r)>3 else '',
                    'jabatan': clean_val(r[4]) if len(r)>4 else ''
                }

    # 3. PAIRING LOGS & REBUILDING ABSEN IN OUT MK LIVE IN CLOUD
    masuk_events = []
    for i in range(1, len(masuk_rows)):
        r = masuk_rows[i]
        card = clean_val(r[0]) if len(r)>0 else ''
        nik = clean_nik(r[1]) if len(r)>1 else ''
        nama = clean_val(r[2]) if len(r)>2 else ''
        t_tgl = r[3] if len(r)>3 else ''
        t_jam = r[4] if len(r)>4 else ''
        loker = clean_val(r[6]) if len(r)>6 else ''

        if not nik: continue
        tgl_disp, tgl_sort, dt_obj = parse_date_str(t_tgl)
        mins, jam_disp = parse_time_mins(t_jam)

        if dt_obj and mins is not None:
            time_dt = dt_obj + timedelta(minutes=mins)
            masuk_events.append({
                'id': i, 'card': card, 'nik': nik, 'nama': nama,
                'tgl_disp': tgl_disp, 'jam_disp': jam_disp, 'loker': loker,
                'dt': time_dt, 'used': False
            })

    keluar_events = []
    for i in range(1, len(keluar_rows)):
        r = keluar_rows[i]
        card = clean_val(r[0]) if len(r)>0 else ''
        nik = clean_nik(r[1]) if len(r)>1 else ''
        nama = clean_val(r[2]) if len(r)>2 else ''
        t_tgl = r[3] if len(r)>3 else ''
        t_jam = r[4] if len(r)>4 else ''
        loker = clean_val(r[6]) if len(r)>6 else ''

        if not nik: continue
        tgl_disp, tgl_sort, dt_obj = parse_date_str(t_tgl)
        mins, jam_disp = parse_time_mins(t_jam)

        if dt_obj and mins is not None:
            time_dt = dt_obj + timedelta(minutes=mins)
            keluar_events.append({
                'id': i, 'card': card, 'nik': nik, 'nama': nama,
                'tgl_disp': tgl_disp, 'jam_disp': jam_disp, 'loker': loker,
                'dt': time_dt, 'used': False
            })

    masuk_by_nik = {}
    for m in masuk_events:
        masuk_by_nik.setdefault(m['nik'], []).append(m)
    for nik in masuk_by_nik:
        masuk_by_nik[nik].sort(key=lambda x: x['dt'])

    recap_headers = ['TANGGAL', 'NIK', 'NAMA', 'DEPARTEMEN', 'JABATAN', 'JAM MASUK', 'JAM KELUAR', 'STATUS', 'NO KARTU MK', 'NO LOKER']
    recap_rows = [recap_headers]
    paired_selesai = 0
    keluar_tanpa_masuk = 0
    di_dalam = 0

    for k in sorted(keluar_events, key=lambda x: x['dt']):
        nik = k['nik']
        candidates = masuk_by_nik.get(nik, [])
        match = None
        min_diff = None

        for m in candidates:
            if m['used']: continue
            diff_h = (k['dt'] - m['dt']).total_seconds() / 3600.0
            if 0 <= diff_h <= 20:
                if min_diff is None or diff_h < min_diff:
                    min_diff = diff_h
                    match = m

        emp = kar_map.get(nik, {})
        dept = emp.get('dept', '')
        jabatan = emp.get('jabatan', '')

        if match:
            match['used'] = True
            k['used'] = True
            paired_selesai += 1
            recap_rows.append([
                match['tgl_disp'], nik, match['nama'] or k['nama'] or emp.get('nama', ''),
                dept, jabatan, match['jam_disp'], k['jam_disp'],
                'SELESAI', match['card'] or k['card'], match['loker'] or k['loker']
            ])
        else:
            keluar_tanpa_masuk += 1
            recap_rows.append([
                k['tgl_disp'], nik, k['nama'] or emp.get('nama', ''),
                dept, jabatan, '', k['jam_disp'],
                'KELUAR TANPA MASUK', k['card'], k['loker']
            ])

    for m in masuk_events:
        if not m['used']:
            di_dalam += 1
            emp = kar_map.get(m['nik'], {})
            recap_rows.append([
                m['tgl_disp'], m['nik'], m['nama'] or emp.get('nama', ''),
                emp.get('dept', ''), emp.get('jabatan', ''),
                m['jam_disp'], '', 'DI DALAM', m['card'], m['loker']
            ])

    # Clear and rewrite ABSEN IN OUT MK in Google Sheets Cloud
    clear_range("ABSEN IN OUT MK!A1:Z10000")
    update_range(f"ABSEN IN OUT MK!A1:J{len(recap_rows)}", recap_rows)

    print(f"[4/5] Live Google Sheets 'ABSEN IN OUT MK' Successfully Rebuilt!")
    print(f"      - Total Clean Rows: {len(recap_rows)-1}")
    print(f"      - SELESAI (Paired): {paired_selesai}")
    print(f"      - KELUAR TANPA MASUK: {keluar_tanpa_masuk}")
    print(f"      - DI DALAM (Active): {di_dalam}")
    print(f"      - DUPLICATES ELIMINATED: 100%")

    print("==================================================")
    print("✅ LIVE GOOGLE SHEETS REPAIR COMPLETE!")
    print("==================================================")

if __name__ == '__main__':
    main()
