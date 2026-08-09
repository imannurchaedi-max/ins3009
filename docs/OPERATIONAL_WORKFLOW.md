# Operational Workflow

Dokumen ini adalah jalur kerja operasional paling singkat untuk repo ini.

## 1. Runtime Aktif

- Runtime utama user-facing adalah `active/HOME_PORTAL/`.
- URL aktif user harus mengikuti hasil `npm run verify` atau `scripts/module-config.json`.
- `active/MODUL_GATE_PABRIK/`, `active/MODUL_AREA_KERJA/`, dan `active/MODUL_REPORT/` adalah compatibility source, bukan titik baca utama.

## 2. Alur Operasional Resmi

Sistem sekarang harus dibaca sebagai alur satu arah:

1. Karyawan datang ke gerbang pabrik.
2. Security / petugas gate menukar KTP dengan kartu MK.
3. Proses `Masuk`:
   - kartu MK dibinding ke NIK
   - log masuk pabrik ditulis ke `REGISTRASI SAAT MASUK PABRIK`
4. Selama karyawan berada di dalam pabrik:
   - security area melakukan scan kartu MK
   - scan pertama berarti `IN`
   - scan kedua berarti `OUT`
   - jika kondisi lapangan meragukan, pakai `Paksa Masuk` atau `Paksa Keluar`
5. Saat pulang:
   - petugas gate menjalankan proses `Keluar`
   - log keluar pabrik ditulis ke `REGISTRASI SAAT KELUAR PABRIK`
   - binding kartu MK dilepas
   - KTP dikembalikan
6. `ABSEN IN OUT MK` tidak boleh lagi diperlakukan sebagai sumber utama.
   - sheet ini adalah turunan hasil rebuild dari log masuk dan log keluar
7. Dashboard, cek absen, export, dan laporan membaca data turunan yang sudah dinormalisasi.

## 3. Kontrak Data Operasional

- Sumber kebenaran gate:
  - `REGISTRASI SAAT MASUK PABRIK`
  - `REGISTRASI SAAT KELUAR PABRIK`
- Sumber kebenaran area:
  - `REGISTRASI MASUK KELUAR AREA KERJA`
- State aktif kartu:
  - `BINDING_KARTU_MK`
- Rekap turunan:
  - `ABSEN IN OUT MK`

Semua penentuan `tanggal kerja` harus memakai resolver yang sama. Tidak boleh ada parser tanggal atau logika shift yang berbeda antara gate, area, repair, recap, dan report.

## 4. Jalur Edit

Untuk perubahan perilaku utama, edit hanya di `active/HOME_PORTAL/`:

- Gate masuk/keluar: `GateFunctions.gs`
- Scan area: `AreaFunctions.gs`
- Report dan recap: `ReportFunctions.gs`
- Utility, auth, sheet access: `SharedLib.gs`
- Struktur halaman: `Index.html`
- Runtime frontend: `app.html`
- Styling: `style.html`

## 5. Jalur Deploy

Urutan normal:

1. Edit code di `active/HOME_PORTAL/`.
2. Jalankan audit bila perubahan cukup besar:
   - `python scripts/audit_project.py`
3. Deploy:
   - `npm run deploy`
4. Verifikasi:
   - `npm run verify`

## 6. Arti Output Deploy

- `OK HOME_PORTAL` berarti runtime utama berhasil ter-push dan ter-deploy.
- `WARN MODUL_* binding clasp tidak ditemukan` berarti child module tidak bisa dipush dari checkout ini, tetapi itu tidak memblokir runtime utama.
- `CONFIG_MODUL berhasil diupdate` berarti registry URL di spreadsheet sudah sinkron.

## 7. Urutan Perbaikan Data

Jika data operasional rusak, jalankan urutannya seperti ini:

1. normalisasi NIK
2. normalisasi tanggal dan jam
3. repair log masuk
4. repair log keluar
5. rebuild recap dari log
6. baru cek dashboard / export / laporan

Urutan ini penting karena report tidak boleh mencoba memperbaiki data mentah sendiri.

## 8. Jika User Masih Membuka URL Lama

Gejala:

- Perubahan tidak terlihat.
- UI masih versi lama.
- Error lama muncul lagi walau code sudah diperbaiki.

Tindakan:

1. Ambil URL `HOME_PORTAL` dari output `npm run verify`.
2. Pastikan user membuka URL itu, bukan deployment lama yang pernah dibagikan.

## 9. Prinsip Bersih Repo

- Perlakukan `HOME_PORTAL` sebagai source of truth.
- Anggap child module sebagai compatibility code sampai binding `clasp` mereka ditemukan kembali.
- Jangan tulis `CONFIG_MODUL` manual dari GAS editor.
- Jangan jadikan artifact di `reports/` sebagai arsitektur aktif tanpa regenerasi ulang.
