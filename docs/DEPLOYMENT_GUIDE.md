# Deployment Guide

Panduan ini mengikuti arsitektur aktif saat ini:

- perilaku runtime utama dibaca dari `active/HOME_PORTAL/`
- semua project di `scripts/module-config.json` tetap dipush/deploy
- `HOME_PORTAL` adalah URL utama user-facing

## Prasyarat

- `clasp` sudah terpasang dan login
- `node` tersedia untuk menjalankan `npm run push` dan `npm run deploy`
- `python` tersedia untuk `scripts/update_config_sheet.py`
- file `.clasp.json` per project masih valid

## Deploy Standar

Gunakan command dari root project:

```bash
npm run push
npm run deploy
```

Perilaku command:

- `npm run push`
  Push code ke semua project tanpa update deployment version
- `npm run deploy`
  Push code, lalu update deployment in-place untuk semua deployment ID di `scripts/module-config.json`

- `npm run watch:deploy`
  Menjalankan watcher lokal yang memantau perubahan file runtime di `active/` lalu otomatis memanggil `npm run deploy`

Verifikasi konfigurasi URL (lokal, tanpa API call):

```bash
npm run verify
```

Opsi paksa:

```bash
npm run push:force
npm run deploy:force
```

## Apa yang Dilakukan `npm run deploy`

1. `clasp push` untuk setiap project:
   - `HOME_PORTAL`
   - `MODUL_GATE_PABRIK`
   - `MODUL_AREA_KERJA`
   - `MODUL_REPORT`
2. `clasp deploy -i <deploymentId>` untuk tiap project
3. `python scripts/update_config_sheet.py` untuk memperbarui `CONFIG_MODUL`
4. `node scripts/verify-config.js` otomatis dijalankan sebagai audit akhir (jika semua deploy sukses)

Catatan:

- URL publik utama mengikuti `HOME_PORTAL` aktif di `scripts/module-config.json`.
- `CONFIG_MODUL` disinkronkan untuk `HOME_PORTAL`, `GATE_PABRIK`, `AREA_KERJA`, dan `REPORT`.
- Jika akses langsung ke Sheets API gagal, script akan fallback ke temporary GAS injector lalu membersihkan deployment temporernya lagi.

## URL Permanen HOME_PORTAL

```text
https://script.google.com/macros/s/AKfycbw4I2Vxh_CKH2k1RHCtvqZwJ1fGwyb0LKeC4MPzEoVibhlSF0lSf5sYeuppZ3BBgp-x/exec
```

## Deployment IDs

Sumber kebenaran deployment ID ada di `scripts/module-config.json`.

Current map:

```json
{
  "HOME_PORTAL": "AKfycbw4I2Vxh_CKH2k1RHCtvqZwJ1fGwyb0LKeC4MPzEoVibhlSF0lSf5sYeuppZ3BBgp-x",
  "MODUL_GATE_PABRIK": "AKfycbyjQ36Nlastyw1xBgzvojgX6QH2oPxB6462YKg0sELBb3gb08dYQuKHz5X_RLFntfoV9g",
  "MODUL_AREA_KERJA": "AKfycbyu6uW7XgdZPtJysgtf3x0i3E7cxR5Hrb_dZNKYns0QJ6Lef7xzbC0mT3uP_rREHz5ypA",
  "MODUL_REPORT": "AKfycbycdcUt4y9RdoQIOTnIzWs6AxyZe5JayFhbk6f9abnv5kr3VAWapXicdVvRGn3o53BS"
}
```

## Workflow Modifikasi

### Perubahan perilaku utama

Edit file di `active/HOME_PORTAL/`:

| Ubah apa | Edit file |
|---|---|
| Logika gate/kartu | `active/HOME_PORTAL/GateFunctions.gs` |
| Logika scan area | `active/HOME_PORTAL/AreaFunctions.gs` |
| Laporan | `active/HOME_PORTAL/ReportFunctions.gs` |
| Utility/auth/sheet access | `active/HOME_PORTAL/SharedLib.gs` |
| UI/frontend | `active/HOME_PORTAL/app.html` |
| Struktur halaman | `active/HOME_PORTAL/Index.html` |
| Styling | `active/HOME_PORTAL/style.html` |

### Perubahan compatibility deployment

Edit `active/MODUL_*` hanya jika memang ingin menjaga parity atau fallback behavior. Jangan menjadikan modul child sebagai acuan arsitektur utama.

## Smoke Test Setelah Deploy

1. Buka URL `HOME_PORTAL`
2. Login sebagai role utama:
   - `KARYAWAN`
   - `SECURITY`
   - `PENGAWAS`
   - `ADMINISTRATOR`
3. Pastikan default tab sesuai role
4. Coba flow `MASUK`
5. Coba flow `SCAN AREA`
6. Coba `CEK ABSEN` dan `CEK AREA`
7. Pastikan URL shell tidak berubah saat tab aktif berpindah
8. Buka tab `DASHBOARD` -> pastikan tab `Supervisi`, `Review`, dan `Laporan` tampil sesuai role login.
9. Pastikan persona dashboard ikut berubah sesuai role: `Security Personel`, `Area Owner`, `HR Supervisor`, `HR Manager`.
10. Buka area review kehadiran -> pastikan kanban kehadiran dan keterlambatan terisi.
11. Pastikan panel shift coverage tetap menampilkan coverage % jika ada data `JADWAL_SHIFT`.

## Repair Data Historis

Jika data shift lama atau recap sudah terlanjur salah, jalankan menu spreadsheet `DAM Access Control`:

- `1. Repair Shift Log Masuk`
  Tahap pertama. Koreksi kolom `SHIFT` di `REGISTRASI SAAT MASUK PABRIK` hanya dari `JAM MASUK`.
- `2. Repair Shift Log Keluar`
  Tahap kedua. Koreksi kolom `SHIFT` di `REGISTRASI SAAT KELUAR PABRIK` hanya dari `JAM KELUAR`.
- `3. Rebuild Recap Absen Dari Log`
  Tahap ketiga. Bangun ulang `ABSEN IN OUT MK` hanya dari dua log yang sudah dibersihkan.
- `Fix & Clean All Spreadsheet Errors`
  Menjalankan seluruh urutan di atas sekaligus, ditambah pembersihan NIK `.0` dan sinkronisasi `BINDING_KARTU_MK`.

Jika ada header sheet yang tidak cocok, menu `Fix & Clean` akan menampilkan popup error yang menyebut nama sheet bermasalah. Perbaiki header itu dulu, lalu jalankan ulang menu repair.

## Fallback Manual

Jika perlu update `HOME_PORTAL` secara manual di luar `npm run deploy`, gunakan:

```bash
python scripts/deploy_home_fixed.py --deployment-id "<HOME_PORTAL_DEPLOYMENT_ID>"
```

Script ini adalah fallback operasional, bukan jalur utama harian.

## Auto Deploy Watcher

Jika ingin deploy otomatis setiap ada perubahan file runtime:

```bash
npm run watch:deploy
```

Watcher ini:

- memantau `active/` dan `scripts/module-config.json`
- debounce perubahan singkat agar tidak deploy di tengah save berturut-turut
- menjalankan `npm run deploy` setiap ada perubahan stabil

## Update `CONFIG_MODUL` Manual

Jika sinkronisasi otomatis gagal:

```bash
python scripts/update_config_sheet.py \
  --home-url "https://script.google.com/macros/s/<HOME_ID>/exec" \
  --gate-url "https://script.google.com/macros/s/<GATE_ID>/exec" \
  --area-url "https://script.google.com/macros/s/<AREA_ID>/exec" \
  --report-url "https://script.google.com/macros/s/<REPORT_ID>/exec"
```

## Aturan Operasional

- Jangan jadikan file di `reports/` sebagai dasar arsitektur tanpa generate ulang.
- Jangan anggap child modules sebagai sumber perilaku utama.
- Perubahan struktur sheet wajib diikuti validasi `SHEET_HEADERS`.
- Setelah perubahan arsitektur atau flow utama, update dokumen aktif di `docs/`.
- **CONFIG_MODUL sheet tidak pernah ditulis secara manual dari GAS Editor.** Source of truth satu-satunya adalah `scripts/module-config.json`, dieksekusi via `npm run deploy`.
- `setupModuleUrls()` sudah dihapus dari `SharedLib.gs` — jangan buat kembali. Gunakan `npm run deploy` untuk semua update CONFIG_MODUL.
- Jalankan `npm run verify` setelah perubahan `module-config.json` untuk memastikan konfigurasi URL konsisten sebelum deploy.
