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
- Direktori `graphify-out/` adalah output lokal hasil generate ulang saat analisis Graphify sedang dibutuhkan.
- Artifact Graphify tidak lagi dijadikan file permanen di repo aktif supaya hasil graph tidak membawa noise dari snapshot lama atau arsip legacy.
- Jika perlu, generate ulang dengan `venv\Scripts\python.exe -m graphify update . --no-cluster`.
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
   - Mapping action Android ke handler GAS, caller Flutter, dan sheet dependency dirangkum di `docs/ANDROID_GAS_BRIDGE_MAP.md`.
3. **Session Shell**:
   - `SessionProvider` adalah source of truth auth state Android.
   - `AuthWrapper` memutuskan hanya dua state root: `LoginScreen` atau `HomeScreen`.
   - `LoginScreen` dan `HomeScreen` tidak lagi menjadi pengendali navigasi auth utama; keduanya hanya memicu perubahan state ke `SessionProvider`.
4. **Session Restore**:
   - Setelah fungsi `verifyLogin` berhasil, aplikasi Dart menyimpan data session (Role, NIK, Nama) ke dalam `SharedPreferences`.
   - Saat app dibuka ulang, session lokal dipulihkan secara **optimistis** agar user bisa langsung masuk tanpa menunggu round-trip backend.
   - `verifySession` tetap dipanggil di background untuk revalidasi payload user.
   - Refresh session lama tidak boleh menimpa hasil login/logout yang lebih baru; guard dilakukan di `SessionProvider` lewat versioned auth state.
5. **Hardware Integrations**:
   - `flutter_nfc_kit`: Digunakan untuk membaca UID/Serial kartu MIFARE/RFID dari ID Karyawan saat melakukan *Scan Gate* maupun *Scan Area*.
   - `geolocator`: Digunakan secara khusus saat *Scan Gate Keluar* untuk memvalidasi posisi latitude/longitude karyawan.
6. **Handling Redirect (302)**: Google Apps Script Web App `exec` URL selalu melakukan HTTP 302 Redirect. Komunikasi API di Dart *wajib* menggunakan `dart:io HttpClient` untuk memanualisasi handling redirect; `http.post` biasa akan mengubah metode POST menjadi GET sehingga payload JSON hilang di tengah jalan.
7. **Transport Guard untuk Aksi Gate**:
   - Aksi gate Android sekarang tidak lagi menembak `bindKartu()` atau `releaseKartu()` secara langsung.
   - Client mengirim `submitGateRequest` dengan `requestId` unik, lalu backend mencatat ledger ke sheet `ANDROID_GATE_REQUESTS`.
   - Backend memproses request itu satu kali, menyimpan status `PENDING` / `PROCESSING` / `SUCCESS` / `FAILED`, lalu Android melakukan *poll* ke `getGateRequestStatus`.
   - Jika koneksi putus setelah submit, Android tidak mengulang mutasi dengan request baru; ia selalu mengecek request lama dulu memakai `requestId` yang sama.
   - Mekanisme ini membuat retry jaringan menjadi idempotent walau `bindKartu()` dan `releaseKartu()` sendiri tetap fungsi mutasi.
   - **Locking ledger (2026-08-14)**: registrasi/klaim/finalisasi request di `processGateRequestById_()` dikunci lewat `withGateRequestQueueLock_()` (key `'GRQ_' + requestId`, mekanisme sama dengan `withCardLock`), **bukan** `withDocumentLock` global. Sebelumnya document lock global dipakai di sini dan membuat request kartu A menunggu kartu B — root cause keluhan "antrian kartu". Detail lengkap di `docs/ANDROID_GAS_BRIDGE_MAP.md`.
   - Klaim juga menolak re-claim requestId yang statusnya masih `PROCESSING` dan baru (< 45 detik), mencegah `bindKartu`/`releaseKartu` terpanggil dobel oleh retry yang tumpang tindih.
8. **HTTP Client Lifecycle Android**:
   - Transport Android tidak boleh membuat `HttpClient` baru untuk setiap request penting, karena itu memaksa DNS lookup, TCP connect, dan TLS handshake dari nol pada tiap call.
   - Client koneksi dibagikan ulang agar koneksi keep-alive ke `script.google.com` dan `script.googleusercontent.com` bisa dipakai kembali.
   - Jika terjadi `SocketException`, `HandshakeException`, atau `HttpException`, pool client harus di-reset agar socket rusak tidak diwariskan ke request berikutnya.
9. **Ledger Request Gate**:
   - Sheet `ANDROID_GATE_REQUESTS` adalah ledger request Android khusus untuk domain gate.
   - Tujuannya bukan mengganti `withCardLock()`, tetapi menambah lapisan dedupe, observability, dan recovery saat response HTTP hilang di tengah jalan.
   - `withCardLock()` tetap menjadi pengaman mutasi per kartu, sedangkan ledger request mencegah Android membuat keputusan ulang tanpa mengetahui hasil request sebelumnya.
10. **Diagnostics & Warmup**:
   - Android menyimpan event diagnostik lokal saat request sukses, gagal, timeout, DNS error, atau recovery polling berjalan.
   - Event itu di-flush ke GAS lewat `logAndroidDiagnostics` pada request sukses berikutnya, sehingga kegagalan mobile tetap bisa diaudit walau saat error terjadi backend tidak sempat menerima request utama.
   - Sheet `ANDROID_DIAGNOSTICS` dipakai sebagai tab audit koneksi Android.
   - Saat `HomeScreen` terbuka, Android melakukan `pingAndroidGateway` sebagai prewarm agar DNS, redirect, dan TLS handshake tidak semuanya terjadi tepat di scan pertama user.

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
- backend (web, via `google.script.run`):
  - `verifySession(nik)` — lookup by NIK, dipakai web saja
  - `verifyLogin(nik, password)` — juga menerbitkan `sessionToken` (dipakai Android, diabaikan web)
- backend (Android, via `doPost()` HTTP, real bearer token — lihat "Auth Android" di bawah):
  - `verifySessionToken_(token)`
  - `generateSessionToken_(nik)` / `validateSessionToken_(token)` / `cleanupExpiredAndroidSessions_()`
  - `requireAndroidSessionToken_(payload)` — guard dipakai `doPost()` untuk action sensitif
- sheet utama:
  - `KARYAWAN`
  - `ANDROID_SESSIONS` (token Android, lihat "Auth Android")

**Auth Android (2026-08-17)**: `verifySession(nik)`/`verifyLogin(nik, pwd)` yang dipakai web TETAP lookup by NIK (model lama, tidak diubah supaya web tidak putus). Jalur Android (`doPost()`) memakai mekanisme terpisah:
- `verifyLogin()` sukses → `generateSessionToken_(nik)` menerbitkan UUID token (TTL 30 hari) disimpan di sheet `ANDROID_SESSIONS`, dikembalikan sebagai field tambahan `sessionToken` (aman untuk web, diabaikan).
- Action Android `verifySession` di `doPost()` di-route ke `verifySessionToken_(payload.sessionToken)` — verifikasi token nyata, bukan lookup NIK.
- `doPost()` mewajibkan `sessionToken` valid (via `requireAndroidSessionToken_()`) sebelum menjalankan `bindKartu`, `releaseKartu`, `scanAreaKerja`, `submitGateRequest`, `getKaryawanByNIK`.
- API key Android (`apiKey`) dibaca dari Script Property `ANDROID_API_KEY` via `getAndroidApiKey_()` (rotatable tanpa deploy ulang), fallback ke literal lama kalau property belum diisi. API key cuma gate identifikasi aplikasi, bukan kredensial kuat — itu peran `sessionToken`.
- Detail lengkap & rasional scoping (kenapa web tidak disentuh): `docs/ANDROID_GAS_BRIDGE_MAP.md`, `docs/ARCHITECTURE_AUDIT_2026-08-17.md`.

### 2. Gate / Pabrik

- frontend:
  - `confirmMasuk()`
  - `confirmKeluar()`
- backend:
  - `getBindingStatus()`
  - `submitGateRequest()`
  - `getGateRequestStatus()`
  - `pingAndroidGateway()`
  - `logAndroidDiagnostics()`
  - `bindKartu()`
  - `releaseKartu()`
  - `updateRecapAbsen()`
- sheet utama:
  - `KARYAWAN`
  - `ANDROID_GATE_REQUESTS`
  - `ANDROID_DIAGNOSTICS`
  - `BINDING_KARTU_MK`
  - `REGISTRASI SAAT MASUK PABRIK`
  - `REGISTRASI SAAT KELUAR PABRIK`
  - `ABSEN IN OUT MK`

Kontrak domain:

- `bindKartu()` hanya membuka binding dan menulis log masuk.
- `releaseKartu()` hanya menutup binding dan menulis log keluar.
- `submitGateRequest()` adalah gateway Android yang memberi `requestId` idempotent di depan dua fungsi mutasi tadi.
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
- **Daftar area kanonik (2026-08-18)**: `GUDANG MATERIAL`, `PRODUKSI`, `PACKING`, `OFFICE`, `GUDANG FINISH GOOD`, `AREA CACAH`, `UTILITY` — dipakai identik di dropdown "SET AREA" web (`Index.html`) dan dropdown per-scan Android (`area_screen.dart`) supaya kedua platform menulis label yang sama ke `REGISTRASI MASUK KELUAR AREA KERJA` (sebelumnya dua daftar berbeda tanpa sumber kebenaran tunggal — lihat `docs/date-normalization-2026-08-02.md` §2026-08-18). Kolom `catatan` (parameter ke-3 `scanAreaKerja`) diisi dari chip "Keperluan/Catatan" (Istirahat/Toilet/Sholat/Klinik/Pekerjaan/Lainnya) di kedua platform.
- TANGGAL/JAM di `REGISTRASI MASUK KELUAR AREA KERJA` wajib tetap teks polos dikunci `@` — lihat guardrail di `docs/date-normalization-2026-08-02.md`. Jangan tambahkan normalizer baru yang mengonversi kolom ini ke objek Date.

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
  - `getAbsenReport(nik, deptFilter, periodType, periodValue, page, pageSize, search, sort, typeFilter)`
  - `getAreaActivityReport()`
  - `exportAbsenReportCsv(nik, deptFilter, periodType, periodValue, typeFilter)`
- sheet utama:
  - `ABSEN IN OUT MK`
  - `REGISTRASI MASUK KELUAR AREA KERJA`
  - `KARYAWAN`

Kontrak domain:

- `getAbsenReport()` membaca recap yang sudah dibangun ulang.
- `getAreaActivityReport()` membaca log area yang sudah dinormalisasi.
- pagination, export, dan tabel render harus berasal dari dataset yang sama.
- **`typeFilter` (2026-08-17)**: parameter opsional `'' | 'internal' | 'outsource'`, sama pola dengan filter type di `getDashboardData()` (via `isExternalKaryawan()`). Dipakai untuk mode "vendor admin" — lihat catatan `CEK ABSEN` di bawah. Backward compatible; kosong/tidak dikirim = perilaku lama (tanpa filter tipe).

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

### Session Android

- Session Android disimpan via `flutter_secure_storage` (bukan `SharedPreferences` — diganti 2026-08-17 karena `sessionToken` sekarang kredensial bearer nyata, bukan lagi NIK biasa) dengan key `user_session`.
- `sessionToken` diterbitkan server (`generateSessionToken_`) saat login, disimpan `ApiService.sessionToken` (static field) dan otomatis dilampirkan ke setiap request `ApiService.post()`.
- Payload session Android (`SessionModel`) memuat:
  - `sessionToken` — opaque UUID, bukan NIK
  - `nik`
  - `nama`
  - `departemen`
  - `jabatan`
  - `role`
  - `type` — TYPE KARYAWAN, dipakai a.l. untuk deteksi `isVendorAdmin` (role PENGAWAS + type VENDOR, lihat domain Report)
- Kontrak runtime aktif Android:
  - restore local session lebih dulu
  - `AuthWrapper` langsung render `HomeScreen` jika session lokal valid secara struktur
  - `verifySession` (via `verifySessionToken_` di backend) berjalan di background untuk sinkronisasi data user terbaru
  - kegagalan konektivitas saat bootstrap tidak boleh melempar user kembali ke login
  - logout dan login baru harus menonaktifkan bootstrap/session refresh lama agar tidak terjadi race condition
  - session Android lama (format pra-2026-08-17, `sessionToken` == NIK) otomatis ditolak `verifySessionToken_` dan jatuh ke alur "sesi tidak valid → login ulang" yang sudah ada — bukan bug, memang expected sekali per upgrade.

### Update Mechanism (Android)

- `lib/services/update_service.dart` mengecek GitHub Releases repo `imannurchaedi-max/ins3009` (`releases/latest` API) saat `HomeScreen` dibuka + tombol manual "Cek Update" di app bar.
- Rilis baru diterbitkan dengan tag `vX.Y.Z` + asset `.apk` terlampir; app membandingkan tag terhadap `PackageInfo.version` lokal.
- Kalau ada versi lebih baru: download APK ke direktori sementara, lalu buka installer sistem Android (`open_filex`, butuh permission `REQUEST_INSTALL_PACKAGES`). Tetap ada dialog konfirmasi sistem Android — tidak bisa install sepenuhnya silent tanpa root/MDM.
- Release APK ditandatangani keystore release khusus (`applicationId` = `com.dayaanugrahmulya.dam_access_control`), bukan debug key — wajib supaya update bisa terpasang menimpa versi lama di device yang sama.

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
- **Vendor admin (2026-08-17)**: `PENGAWAS` dengan `TYPE KARYAWAN = VENDOR` (`isVendorAdmin` di web `app.html`/Android `SessionModel`) TIDAK di-lock ke departemen sendiri — deptFilter dikosongkan, `typeFilter='outsource'` dipasang otomatis, sehingga bisa lihat/unduh absen semua mitra kerja lintas departemen tapi tidak melihat staf internal. Berlaku di web (report + CSV export) dan Android (`absen_screen.dart`). Setup: set `TYPE KARYAWAN = VENDOR` + `USER LEVEL = PENGAWAS` di sheet `KARYAWAN`, tidak butuh perubahan kode untuk vendor admin baru.

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
- `ANDROID_SESSIONS`
  Token session Android (`TOKEN`, `NIK`, `CREATED_AT`, `EXPIRES_AT`) — TTL 30 hari, dibersihkan opportunistically oleh `cleanupExpiredAndroidSessions_()`. Lihat domain Session/Auth.
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

- **Concurrency Gate & Area Scan**: Sistem mendukung hingga ~100 transaksi scan bersamaan. Arsitektur lock memakai key spesifik per-entitas (bukan lock global) di seluruh jalur scan aktif:
  - `withCardLock(key, fn)` — lock via PropertiesService keyed by string bebas; global lock hanya dipakai ~200ms untuk set/check, lalu dilepas. Key berbeda berjalan paralel penuh, tidak saling menunggu.
    - Gate scan (`bindKartu`, `releaseKartu`) dan Area scan (`scanAreaKerja`) mengunci per nomor kartu.
    - Ledger request Android (`submitGateRequest`/`processGateRequestById_`) mengunci per `requestId` lewat `withGateRequestQueueLock_()`.
    - Recap update (`updateRecapAbsen`) mengunci per (`NIK` + `tanggal`) — bukan lagi document lock global (diperbaiki 2026-08-14; sebelumnya update recap satu karyawan bisa menahan update recap karyawan lain).
  - `withDocumentLock(fn)` — global lock dengan retry 3x dan wait 30 detik; sengaja masih dipertahankan HANYA untuk operasi admin berat yang jarang jalan dan/atau butuh exclusive access ke seluruh sheet: repair (`fixAllSpreadsheetErrorsNow_`), rebuild recap historis, dan `JadwalFunctions.gs` (`saveJadwalShift`/`deleteJadwalShift` — `deleteJadwalShift` menghapus baris sehingga index baris lain bergeser, butuh exclusive lock).
  - Prinsip: kalau sebuah operasi terjadi berkali-kali per menit di jalur scan real-time, dia HARUS dikunci per-entitas (card/requestId/NIK+tanggal), bukan document lock global — supaya throughput satu entitas tidak pernah menunggu entitas lain yang tidak terkait.
- **Urutan timeline gate scan**:
  1. Baca validasi (karyawan, binding, factory status) — di luar lock, paralel
  2. `withCardLock` (per nomor kartu): append ke BINDING + MASUK/KELUAR (~0.5 detik)
  3. `safeUpdateRecapAbsen` — `withCardLock` terpisah (per NIK+tanggal), sheet ABSEN IN OUT MK
- **Write-order bug class (date/time cell format)**: menulis string tanggal/jam ke sel LALU BARU mengunci `setNumberFormat('@')` tidak cukup — Google Sheets sudah keburu auto-convert string yang match pola tanggal/jam jadi tipe Date/Time sebelum baris `setNumberFormat` sempat jalan, sehingga tampilan sel mengikuti format locale default Sheets (tidak konsisten, mis. jam tanpa leading zero) alih-alih string literal yang ditulis. Pola aman: kunci format `'@'` **sebelum** `setValue()`, atau kalau baris baru dibuat via `appendRow()` (tidak bisa diformat dulu karena barisnya belum ada), tulis ulang value-nya setelah format dikunci. Lihat `docs/date-normalization-2026-08-02.md` untuk detail lengkap dan daftar kolom yang sudah diperbaiki (`WAKTU_BIND`, `WAKTU_RELEASE`, kolom TANGGAL/JAM di `ABSEN IN OUT MK` dan `REGISTRASI MASUK KELUAR AREA KERJA`, `CREATED_AT`/`UPDATED_AT` di `ANDROID_GATE_REQUESTS`).
- **Auto-repair terjadwal**: menu *DAM Access Control → ⏰ Aktifkan Auto-Repair Malam Hari* memasang time-driven trigger yang menjalankan `fixAllSpreadsheetErrorsNow_()` otomatis tiap hari ~02:00 WIB, sebagai jaring pengaman berkelanjutan terhadap drift data (bukan pengganti fix di write path, cuma pembersih data lama). Detail di `docs/date-normalization-2026-08-02.md`.
- **Stable-read debounce kamera**: baik scanner Android (`mobile_scanner`) maupun web (`BarcodeDetector`/`html5-qrcode` di tiap `app.html`) sekarang mensyaratkan nilai yang sama terbaca konsisten selama ~400ms sebelum diterima, bukan langsung menerima hasil frame pertama. Ini mengurangi misread dari 1 frame blur/pantulan cahaya. Android memakai `DetectionSpeed.unrestricted` (bukan `noDuplicates`) supaya `onDetect` tetap terpanggil berulang untuk value yang sama — prasyarat wajib untuk debounce ini bekerja.
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
