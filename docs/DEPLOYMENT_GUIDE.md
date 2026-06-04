# Deployment Guide

Panduan ini mengikuti struktur repo aktif saat ini, yaitu semua source runtime berada di folder `active/`.

## Prasyarat

- `clasp` sudah terpasang dan login.
- File `.clasp.json` per modul di `active/*/.clasp.json` sudah benar.
- Akses ke spreadsheet master dan sheet `CONFIG_MODUL` tersedia.

## Lokasi Deploy

- `active/HOME_PORTAL`
  Container tetap. Tidak boleh ikut auto-deploy biasa.
- `active/MODUL_GATE_PABRIK`
- `active/MODUL_AREA_KERJA`
- `active/MODUL_REPORT`

## Workflow Aman

1. Edit source hanya di `active/`.
2. Jalankan audit:
   - `python scripts/audit_project.py`
   - `python scripts/extract_functions.py`
   - `python scripts/compare_gas_runtime.py`
3. Deploy modul.
4. Update `CONFIG_MODUL`.
5. Smoke test URL hasil deploy.

## Deploy Semua Modul

Perintah paling aman saat ini:

```powershell
python scripts/deploy_all.py
```

Script ini akan:
- menjalankan `clasp push --force` per modul
- menjalankan `clasp deploy`
- mengambil URL `/exec`
- memanggil `scripts/update_config_sheet.py`
- mempertahankan baris `HOME_PORTAL` di `CONFIG_MODUL` apa adanya
- membersihkan deployment lama modul jika batas deployment Apps Script sudah mendekati limit

## Update CONFIG_MODUL

Updater utama:

```powershell
python scripts/update_config_sheet.py ^
  --gate-url "<url gate>" ^
  --area-url "<url area>" ^
  --report-url "<url report>"
```

Catatan:
- Jika Sheets API pada project OAuth `clasp` masih disabled, script ini punya fallback temporary injector melalui GAS.
- Fallback tidak lagi memakai `HOME_PORTAL` sebagai injector.
- Updater hanya menimpa `GATE_PABRIK`, `AREA_KERJA`, dan `REPORT`.
- Baris `HOME_PORTAL` dibiarkan tetap sebagai URL container permanen.

## Update HOME_PORTAL Tanpa Ganti URL

Jika source `HOME_PORTAL` memang perlu diubah, gunakan update deployment in-place:

```powershell
python scripts/deploy_home_fixed.py --deployment-id "<deployment-id-home>"
```

Tujuannya:
- push source `active/HOME_PORTAL`
- update deployment HOME_PORTAL yang sudah ada
- mempertahankan URL publik `/exec` yang sama

## Verifikasi Setelah Deploy

Pastikan:

1. `deployment_urls.json` berisi URL terbaru jika dipakai oleh tooling lokal.
2. `CONFIG_MODUL` di spreadsheet memuat:
   - `GATE_PABRIK`
   - `AREA_KERJA`
   - `REPORT`
   - `HOME_PORTAL` sebagai URL tetap
3. URL `/exec` masing-masing bisa dibuka.
4. Smoke test minimum:
   - login dari `HOME_PORTAL`
   - buka `GATE_PABRIK`
   - cek flow `MASUK`
   - cek flow `KELUAR`
   - buka `REPORT`

## Aturan Operasional

- Jangan deploy dari file root lama jika ada duplikasi dengan `active/`.
- Jangan jalankan auto-deploy untuk `HOME_PORTAL` kecuali benar-benar bermaksud update in-place.
- Setelah perubahan code runtime, audit dan deploy harus berjalan berurutan.
- Jika ada perubahan struktur sheet, perbarui dokumentasi dan validasi header runtime sebelum release.
