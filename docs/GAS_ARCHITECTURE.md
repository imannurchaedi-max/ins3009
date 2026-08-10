# GAS Architecture

## Ringkasan

Proyek ini adalah web app Google Apps Script untuk access control, absensi, dan tracking area kerja PT Daya Anugrah Mulya. Sistem ini memiliki dua antarmuka (interface) utama:
1. **Web App Utama**: Berjalan sebagai `True Single-URL Shell` dari project `HOME_PORTAL`.
2. **Aplikasi Android Native**: Dibangun dengan Flutter (`android_app/`), terhubung langsung ke backend GAS via HTTP POST (JSON).

## Jalur Baca Efektif

Untuk memahami sistem tanpa tersesat oleh artifact lama, gunakan urutan ini:

1. `README.md`
2. dokumen ini
3. `docs/NEURAL_MAPPING.md`
4. `docs/DEPLOYMENT_GUIDE.md`
5. source di `active/HOME_PORTAL/`

Yang tidak boleh dipakai sebagai sumber arsitektur aktif:

- `reports/` karena seluruh isinya generated artifact
- cache Python atau helper lokal di `_local/`
- `Junk/` karena berisi arsip dokumentasi non-aktif
- `active/MODUL_GATE_PABRIK/`, `active/MODUL_AREA_KERJA/`, `active/MODUL_REPORT/` sebagai frontend utama
- `scripts/` sebagai jalur baca arsitektur, kecuali saat memang perlu eksekusi tooling

## Source of Truth

- Perilaku runtime aktif yang diaudit dan dijadikan acuan perubahan ada di `active/HOME_PORTAL/`.
- Child modules tetap ikut push/deploy untuk menjaga compatibility deployment, tetapi perubahan arsitektur harus divalidasi dari `HOME_PORTAL` lebih dulu.
- Satu URL shell utama yang aktif saat ini:
  ```
  https://script.google.com/macros/s/AKfycbzVN4Z58pluVPnUG1jBOBc4hLggJjDAlrSekiW9DtkHqvk8rEsSKuhvhWHTbsHbaP8m/exec
  ```
- URL aktif ini mengikuti `scripts/module-config.json` dan hasil `npm run deploy`.

## Graphify Knowledge Graph

Proyek ini telah dianalisis menggunakan **Graphify**, yang menghasilkan representasi grafik dari seluruh basis kode, dependensi, dan *workflow*:
- Direktori `graphify-out/` berisi grafik utuh (`graph.json`) dan representasi visual HTML (`graph.html`).
- Rangkuman hubungan dan *cluster* komunitas dapat dibaca di `graphify-out/GRAPH_REPORT.md`.
- Rincian dependensi otomatis untuk pemanggilan fungsi tingkat rendah, rantai UI, dan ikatan data konseptual didokumentasikan di `docs/NEURAL_MAPPING.md`.

## Struktur HOME_PORTAL

```text
active/HOME_PORTAL/
|- Code.js              <- doGet() web entry point & doPost() Android API router
|- SharedLib.gs         <- utility, auth, lookup, sheet access, shift config, registry compatibility
|- GateFunctions.gs     <- bindKartu, releaseKartu, getBindingStatus, updateRecapAbsen
|- AreaFunctions.gs     <- scanAreaKerja, getDashboardData, getKehadiranDashboard, getRecentAreaLogs
|- ReportFunctions.gs   <- getAbsenReport, getAreaActivityReport
|- JadwalFunctions.gs   <- saveJadwalShift, deleteJadwalShift, getJadwalShift, getKaryawanExpectedForDate
|- Index.html           <- shell page dan semua section UI
|- app.html             <- seluruh JS UI logic, event handler, scanner flow
|- style.html           <- CSS mobile-first
`- appsscript.json
```

## Workflow Aplikasi

1. User membuka URL `HOME_PORTAL`.
2. `Code.js::doGet()` merender `Index.html`.
3. `Index.html` meng-include `style.html` dan `app.html`.
4. `DOMContentLoaded` membaca `dam_session` dari `localStorage`.
   - jika valid: `restoreSavedSession()` -> `verifySession()` -> `applyRolePermissions()`
   - jika tidak ada: tampil form login
5. Login baru berjalan lewat `handleLoginSubmit()` -> `verifyLogin()`.
6. Semua tab di shell aktif berpindah secara lokal, tanpa ganti URL.
7. Semua operasi backend berjalan lewat `google.script.run` ke GAS project `HOME_PORTAL`.

## Workflow Android App (Flutter)

Aplikasi Android dibangun untuk memudahkan proses *tapping* kartu ID (NFC) oleh Karyawan dan Security langsung dari handphone.

1. **Stack**: Frontend menggunakan Flutter (Dart), Backend menggunakan GAS (`Code.js` -> `doPost`).
2. **HTTP Router**: `doPost(e)` di `Code.js` menerima payload JSON yang di-*flatten* (terdiri dari `apiKey`, `action`, dan parameter lain). Jika `apiKey` cocok, request akan di-route ke fungsi backend yang sama persis seperti yang digunakan Web App.
3. **Session**: Setelah fungsi `verifyLogin` berhasil, aplikasi Dart menyimpan data session (Role, NIK, Nama) ke dalam `SharedPreferences`.
4. **Hardware Integrations**:
   - `flutter_nfc_kit`: Digunakan untuk membaca UID/Serial kartu MIFARE/RFID dari ID Karyawan saat melakukan *Scan Gate* maupun *Scan Area*.
   - `geolocator`: Digunakan secara khusus saat *Scan Gate Keluar* untuk memvalidasi posisi latitude/longitude karyawan.
5. **Handling Redirect (302)**: Google Apps Script Web App `exec` URL selalu melakukan HTTP 302 Redirect. Komunikasi API di Dart *wajib* menggunakan `dart:io HttpClient` untuk memanualisasi handling redirect; `http.post` biasa akan mengubah metode POST menjadi GET sehingga payload JSON hilang di tengah jalan.

## Workflow Operasional Satu Arah

Arsitektur aktif harus dibaca sebagai pipeline satu arah:

1. `Masuk Gate`
   - tulis log ke `REGISTRASI SAAT MASUK PABRIK`
   - buka state kartu di `BINDING_KARTU_MK`
2. `Keluar Gate`
   - tulis log ke `REGISTRASI SAAT KELUAR PABRIK`
   - tutup state kartu di `BINDING_KARTU_MK`
3. `Scan Area`
   - tulis log `IN/OUT` ke `REGISTRASI MASUK KELUAR AREA KERJA`
   - tidak mengubah log gate
4. `Repair`
   - membersihkan NIK
   - menormalkan tanggal dan jam
   - memperbaiki label shift
5. `Rebuild Recap`
   - membangun `ABSEN IN OUT MK` hanya dari log gate masuk dan keluar
6. `Dashboard / Review / Export`
   - membaca recap dan log area yang sudah bersih

Prinsip utamanya:

- `ABSEN IN OUT MK` adalah hasil turunan, bukan tempat input manual.
- `BINDING_KARTU_MK` adalah state aktif kartu, bukan histori final absen.
- report dan dashboard tidak boleh memperbaiki data mentah sendiri.
- penentuan `tanggal kerja` harus memakai resolver yang sama di semua domain.

## Domain Runtime

### 1. Session dan Auth

- frontend:
  - `restoreSavedSession()`
  - `handleLoginSubmit()`
- backend:
  - `verifySession()`
  - `verifyLogin()`
- sheet utama:
  - `KARYAWAN`

### 2. Gate / Pabrik

- frontend:
  - `confirmMasuk()`
  - `confirmKeluar()`
- backend:
  - `getBindingStatus()`
  - `bindKartu()`
  - `releaseKartu()`
  - `updateRecapAbsen()`
- sheet utama:
  - `KARYAWAN`
  - `BINDING_KARTU_MK`
  - `REGISTRASI SAAT MASUK PABRIK`
  - `REGISTRASI SAAT KELUAR PABRIK`
  - `ABSEN IN OUT MK`

Kontrak domain:

- `bindKartu()` hanya membuka binding dan menulis log masuk.
- `releaseKartu()` hanya menutup binding dan menulis log keluar.
- recap harian harus selalu diturunkan dari dua log gate tersebut.

### 3. Area Kerja

- frontend:
  - `onSerialScanned('security', serial)`
  - `loadRecentLogs()`
  - `loadDashboard()`
  - `switchDashboardSubtab(subtab)` — sub-tab: Operasional / Kehadiran / Keterlambatan / Lembur
  - `loadKehadiranDashboard()`
  - `renderKehadiranKanban()`, `renderKeterlambatanKanban()`, `renderLemburKanban()`
  - `renderShiftCoverage()`, `updateKehadiranKPI()`
- backend:
  - `scanAreaKerja()`
  - `getRecentAreaLogs()`
  - `getDashboardData(basis, basisValue, deptFilter, typeFilter)`
  - `getKehadiranDashboard(tanggal, shiftFilter, deptFilter, typeFilter)`
- sheet utama:
  - `REGISTRASI MASUK KELUAR AREA KERJA`
  - `ABSEN IN OUT MK`
  - `KARYAWAN`
  - `JADWAL_SHIFT` (untuk coverage % di kehadiran dashboard)

Kontrak domain:

- log area tidak boleh memperbaiki log gate.
- scan area hanya valid jika karyawan masih `DI DALAM` menurut alur gate/recap.
- force mode hanya memaksa arah event area, bukan mengubah histori gate.

### 4. Jadwal Shift

- frontend:
  - `loadJadwalShift()`
  - `saveJadwalEntry()`
  - `deleteJadwalEntry(rowIndex)`
  - `lookupJadwalNik()`
  - `renderJadwalTable(data)`
- backend:
  - `getJadwalShift(deptFilter)`
  - `saveJadwalShift(nik, shift, tanggalMulai, tanggalSelesai)`
  - `deleteJadwalShift(rowIndex)`
  - `bulkSaveJadwalShift(items)`
  - `getKaryawanExpectedForDate(tanggal)` ← internal, dipanggil dari `getKehadiranDashboard`
- sheet utama:
  - `JADWAL_SHIFT`
  - `KARYAWAN`

### 5. Report

- frontend:
  - `processAbsenReport()`
  - `processAreaReport()`
- backend:
  - `getAbsenReport()`
  - `getAreaActivityReport()`
- sheet utama:
  - `ABSEN IN OUT MK`
  - `REGISTRASI MASUK KELUAR AREA KERJA`
  - `KARYAWAN`

Kontrak domain:

- `getAbsenReport()` membaca recap yang sudah dibangun ulang.
- `getAreaActivityReport()` membaca log area yang sudah dinormalisasi.
- pagination, export, dan tabel render harus berasal dari dataset yang sama.

## Session Management

- `dam_session` disimpan di `localStorage` browser.
- Payload utamanya memuat:
  - `nik`
  - `nama`
  - `role`
  - `dept`
  - `jabatan`
  - `type`
  - `exp`
- Session dipakai ulang di shell yang sama karena seluruh UX utama hidup di satu origin GAS.

## Role dan Akses Tab

| Tab | ADMINISTRATOR | PENGAWAS | SECURITY | KARYAWAN |
|---|:---:|:---:|:---:|:---:|
| MASUK | yes | no | yes | yes |
| KELUAR | yes | no | yes | yes |
| SCAN AREA | yes | yes | yes | no |
| DASHBOARD | yes | yes | no | no |
| CEK ABSEN | yes | yes | yes | yes |
| LOG AREA | yes | yes | yes | no |
| EXPORT | yes | no | no | no |
| REVISI | yes | no | no | no |

Catatan `CEK ABSEN`:

- `KARYAWAN`: wajib isi NIK
- `SECURITY` dan `ADMINISTRATOR`: NIK opsional
- `PENGAWAS`: NIK opsional, auto-filter departemen sendiri

## Google Sheet yang Dipakai

- `KARYAWAN`
  Master identitas, role, departemen, jabatan, tipe karyawan, password
- `REGISTRASI SAAT MASUK PABRIK`
  Log masuk pabrik
- `REGISTRASI SAAT KELUAR PABRIK`
  Log keluar pabrik
- `REGISTRASI MASUK KELUAR AREA KERJA`
  Log area kerja
- `BINDING_KARTU_MK`
  Status binding kartu aktif
- `ABSEN IN OUT MK`
  Recap harian turunan dari log masuk/keluar
- `JADWAL_SHIFT`
  Jadwal shift per karyawan — NIK, shift, tanggal mulai/selesai. Dipakai untuk hitung coverage % per shift di dashboard
- `CONFIG_MODUL`
  Registry URL deployment child modules dan compatibility routing lama, bukan penentu navigasi shell aktif

## Resolver Tanggal Kerja

Untuk mengatasi campuran format `dd/MM/yyyy` dan `MM/dd/yyyy` serta potensi *auto-formatting* Google Sheets (menjadi *Date Object*), runtime aktif memakai guardrail berikut:

- format kanonik penyimpanan tanggal operasional: `dd/MM/yyyy`
- perbandingan tanggal internal **wajib** menggunakan nilai yang telah dinormalisasi via `formatDateForSort()` (menghasilkan angka `yyyyMMdd` seperti `20240810`).
- perbandingan langsung antar-string `tanggal === targetDate` dilarang keras kecuali jika telah dipastikan formatnya sama melalui `formatDateForSort()`.
- parser slash-date memprioritaskan `dd/MM/yyyy`
- translasi `MM/dd/yyyy` hanya diterima jika hasilnya masih masuk jendela operasional aplikasi
- gate, area, repair, rebuild recap, dan report harus berbagi resolver `tanggal kerja` yang sama
- tanggal native `Date` yang jatuh di luar jendela operasional harus dipulihkan dari display value saat repair, bukan dibiarkan lolos apa adanya

## Child Modules

Project berikut masih aktif dan tetap dipush/deploy:

- `active/MODUL_GATE_PABRIK/`
- `active/MODUL_AREA_KERJA/`
- `active/MODUL_REPORT/`

Namun statusnya adalah:

- compatibility deployment
- fallback/testing surface
- visibility untuk audit jalur lama

Mereka bukan referensi perilaku utama user normal.

## Tooling Deploy

Perintah standar dari root project:

```bash
npm run push
npm run deploy
npm run push:force
npm run deploy:force
npm run verify
```

Pipeline `npm run deploy`:

1. Pre-deploy guard: batalkan jika ada modul tanpa `deploymentId` di `scripts/module-config.json`
2. `clasp push` ke semua project di `scripts/module-config.json`
3. `clasp deploy -i <deploymentId>` untuk update in-place semua URL
4. `python scripts/update_config_sheet.py` untuk refresh `CONFIG_MODUL` seluruh modul terdaftar, termasuk `HOME_PORTAL`
5. `node scripts/verify-config.js` — audit akhir otomatis (jika semua deploy sukses)

`npm run verify` dapat dijalankan kapan saja untuk validasi lokal tanpa API call. Memeriksa:
- Kelengkapan `module-config.json`
- HOME_PORTAL punya deployment aktif
- Tidak ada `.clasp.json` yang menyimpan `deploymentId` hardcoded

`scripts/deploy_home_fixed.py` tersedia sebagai fallback manual bila perlu update `HOME_PORTAL` secara terpisah dari pipeline npm biasa.

Untuk autodeploy berbasis perubahan file runtime, tersedia watcher lokal lewat `npm run watch:deploy`.

## Catatan Runtime Penting

- **Concurrency Gate & Area Scan**: Sistem mendukung hingga ~100 transaksi scan bersamaan. Arsitektur lock dua-tingkat:
  - `withCardLock(cardNo, fn)` — per-kartu lock via PropertiesService; global lock hanya dipakai ~200ms untuk set/check, lalu dilepas. Kartu berbeda berjalan paralel penuh.
  - `withDocumentLock(fn)` — global lock dengan retry 3x dan wait 30 detik; hanya untuk operasi berat (repair, rebuild recap, jadwal write).
  - Gate scan (`bindKartu`, `releaseKartu`) dan Area scan (`scanAreaKerja`) semuanya memakai `withCardLock` untuk performa konkurensi maksimal. Recap update (`safeUpdateRecapAbsen`) dilakukan di luar lock.
- **Urutan timeline gate scan**:
  1. Baca validasi (karyawan, binding, factory status) — di luar lock, paralel
  2. `withCardLock`: append ke BINDING + MASUK/KELUAR (~0.5 detik, per-kartu)
  3. `safeUpdateRecapAbsen` — di luar lock, sheet ABSEN IN OUT MK
- Header sheet wajib sinkron dengan definisi runtime di `SharedLib.gs`.
- Klasifikasi `internal/external` mengutamakan tipe karyawan dari master data.
- `escHtml()` tersedia di backend untuk sanitasi output HTML.
- `getModuleUrls()` masih ada untuk compatibility flow lama, tetapi shell aktif `HOME_PORTAL` tidak bergantung padanya untuk tab switching.
- Rekap `ABSEN IN OUT MK` sekarang mengandalkan logika shift-aware untuk pairing event masuk/keluar, termasuk shift 3 yang keluar di hari berikutnya.
- Aturan window rekap aktif dan `SHIFT_CONFIG` / `SHIFT_EVENT_RULES` telah distandardisasi dan diamankan timezone-nya di seluruh modul:
  - `Shift 1`: `06:00-13:59` (masuk 05:00-09:59, keluar 13:00-15:59)
  - `Shift 2`: `14:00-21:59` (masuk 13:00-15:59, keluar 21:00-23:59)
  - `Shift 3`: `22:00-05:59` (masuk 21:00-23:59, keluar 00:00-07:59, *crossMidnight*)
- **Deteksi shift keluar**: Jam `00:00–07:59` pada event keluar diprioritaskan sebagai Shift 3 (bukan Shift 1) untuk menangani karyawan Shift 3 yang keluar dini hari.
- Fungsi `rebuildRecapAbsenInOutMK()` tersedia untuk generate ulang recap dari log gate masuk/keluar memakai aturan shift tersebut.
- **Pagination**: Report table memakai pagination horizontal compact (`renderReportPagination`, `renderLocalPagination`) dengan class CSS `.pg-btn`, `.pg-active`, `.pg-ellipsis` di `style.html`. Ellipsis otomatis muncul jika halaman > 7.

## Catatan Arsitektur URL

- `setupModuleUrls()` **sudah dihapus** dari `SharedLib.gs` (FASE 37). Fungsi ini bisa memperbarui CONFIG_MODUL dengan ID kedaluwarsa jika dijalankan dari GAS Editor.
- CONFIG_MODUL dikelola **eksklusif** oleh `npm run deploy` via `scripts/update_config_sheet.py`. Jangan tulis ke CONFIG_MODUL secara manual.
- Source of truth deployment ID: `scripts/module-config.json`.
- HOME_PORTAL deployment ID sekarang dikelola oleh `scripts/module-config.json` dan boleh berganti selama hasil `npm run deploy` sukses dan link terbaru dibagikan dari output deploy.
