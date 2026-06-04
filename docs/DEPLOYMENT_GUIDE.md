# Deployment Guide

Panduan ini mengikuti struktur repo aktif saat ini, yaitu semua source runtime berada di folder `active/`.

## Prasyarat

- `clasp` sudah terpasang dan login.
- File `.clasp.json` per modul di `active/*/.clasp.json` sudah benar.
- Akses ke spreadsheet master dan sheet `CONFIG_MODUL` tersedia.

## Lokasi Deploy

- `active/HOME_PORTAL`
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
python scripts/deploy_all.py --include-home
```

Script ini akan:
- menjalankan `clasp push --force` per modul
- menjalankan `clasp deploy`
- mengambil URL `/exec`
- memanggil `scripts/update_config_sheet.py`

## Update CONFIG_MODUL

Updater utama:

```powershell
python scripts/update_config_sheet.py ^
  --gate-url "<url gate>" ^
  --area-url "<url area>" ^
  --report-url "<url report>" ^
  --home-url "<url home>"
```

Catatan:
- Jika Sheets API pada project OAuth `clasp` masih disabled, script ini punya fallback temporary injector melalui GAS.
- Fallback akan menulis `CONFIG_MODUL`, lalu merestore source `HOME_PORTAL`.

## Verifikasi Setelah Deploy

Pastikan:

1. `deployment_urls.json` berisi URL terbaru jika dipakai oleh tooling lokal.
2. `CONFIG_MODUL` di spreadsheet memuat:
   - `GATE_PABRIK`
   - `AREA_KERJA`
   - `REPORT`
   - `HOME_PORTAL`
3. URL `/exec` masing-masing bisa dibuka.
4. Smoke test minimum:
   - login dari `HOME_PORTAL`
   - buka `GATE_PABRIK`
   - cek flow `MASUK`
   - cek flow `KELUAR`
   - buka `REPORT`

## Aturan Operasional

- Jangan deploy dari file root lama jika ada duplikasi dengan `active/`.
- Setelah perubahan code runtime, audit dan deploy harus berjalan berurutan.
- Jika ada perubahan struktur sheet, perbarui dokumentasi dan validasi header runtime sebelum release.
