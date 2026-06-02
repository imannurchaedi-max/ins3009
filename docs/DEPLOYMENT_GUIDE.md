# Deployment Guide

## Scope

Project ini sekarang memakai file runtime:

- `Code.js` untuk backend Google Apps Script
- `Index.html` untuk shell UI
- `app.html` untuk logic frontend
- `style.html` untuk styling

## Struktur Deploy

- Root project
  Source master lokal untuk runtime utama dan basis sinkronisasi module.
- `HOME_PORTAL`
  Portal utama yang mengarahkan user ke module lain.
- `MODUL_GATE_PABRIK`
  Module masuk dan keluar pabrik.
- `MODUL_AREA_KERJA`
  Module scan area kerja.
- `MODUL_REPORT`
  Module laporan dan review data.

## Deployment Lokal

1. Pastikan `clasp` sudah login.
2. Pastikan `.clasp.json` pada folder target menunjuk ke Apps Script project yang benar.
3. Push source dengan `clasp push`.
4. Deploy web app dengan `clasp deploy`.
5. Untuk arsitektur modular, update URL module ke sheet `CONFIG_MODUL`.

## Script Bantu

- `python scripts/build_microservices.py`
  Menyalin source root ke module dan menjaga spesialisasi module tetap ada.
- `python scripts/deploy_all.py`
  Deploy semua module dan mengisi `CONFIG_MODUL` lewat Google Sheets API lokal.
- `python scripts/deploy_all_isolated.py`
  Alternatif deploy per module.
- `python scripts/update_config_sheet.py`
  Update konfigurasi URL module pada sheet jika diperlukan.
  Contoh:
  `python scripts/update_config_sheet.py --gate-url <url> --area-url <url> --report-url <url>`
  Helper ini akan mencoba Google Sheets API dulu, lalu fallback ke injector Apps Script sementara jika API belum aktif.

## Validasi Setelah Deploy

- Buka `HOME_PORTAL` dan login normal.
- Pastikan tab module membuka URL yang benar.
- Uji flow `MASUK` internal.
- Uji flow `MASUK` external dengan kartu MK.
- Uji flow `KELUAR`.
- Uji `SCAN AREA`.
- Uji `CEK ABSEN` dan `CEK AREA`.

## Catatan

- `CONFIG_MODUL` tidak otomatis ter-update hanya karena source lokal berubah, jadi jalankan helper update setelah deploy.
- Perubahan lokal baru aktif di web app setelah `clasp push` dan deploy ulang.
- Runtime aktif project ini memakai `Code.js`, bukan `Code.gs`.
