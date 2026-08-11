# Blast Radius Analysis

Dokumen ini memetakan dampak perubahan setiap fungsi backend GAS. Digunakan sebagai panduan sebelum mengedit kode — selalu cek blast radius sebelum memodifikasi fungsi apa pun.

**Acuan**: `reports/function_inventory.md` (202 GAS functions, 354 frontend functions) · Graphify 169 nodes/212 edges · Audit terakhir: 2026-06-23

## Risk Level Definition

| Level | Deskripsi |
|---|---|
| **CRITICAL** | Semua user terdampak. Perubahan bisa menjatuhkan auth, session, atau seluruh shell app. |
| **HIGH** | Flow operasional inti terdampak. Beberapa domain/modul terpengaruh. |
| **MEDIUM** | Satu domain/modul terdampak. Dampak terbatas. |
| **LOW** | Fungsi utility internal. Hampir tidak ada dampak user-facing langsung. |

---

## Domain: Shell & Entry Point

### doGet() — `Code.js:12`
- **Risk**: CRITICAL
- **Frontend callers**: Browser URL (entry point)
- **Callees**: `include()` (untuk style.html, app.html)
- **Sheets**: Tidak langsung
- **What breaks**: Seluruh web app tidak bisa diakses. URL shell mati.
- **Notes**: Entry point tunggal HOME_PORTAL. Jangan diubah signature-nya.

---

## Domain: Authentication & Session

### verifyLogin(nik, password) — `SharedLib.gs:522`
- **Risk**: CRITICAL
- **Frontend callers**: `handleLoginSubmit()` di HOME_PORTAL, MODUL_GATE_PABRIK, MODUL_AREA_KERJA, MODUL_REPORT (4 modules)
- **Callees**: `getKaryawanMapByNIK()`, `makeKaryawanPayload()`, `getAvailableDepts()`
- **Sheets read**: `KARYAWAN`
- **What breaks**: Tidak ada user yang bisa login. Semua role terdampak.
- **Notes**: Dependency pada kolom `USER LEVEL` dan `PASSWORD` di sheet KARYAWAN.

### verifySession(nik) — `SharedLib.gs:545`
- **Risk**: CRITICAL
- **Frontend callers**: `restoreSavedSession()` di HOME_PORTAL (2 calls), MODUL_AREA_KERJA, MODUL_GATE_PABRIK, MODUL_REPORT (total 5 calls)
- **Callees**: `getKaryawanMapByNIK()`, `makeKaryawanPayload()`, `getAvailableDepts()`
- **Sheets read**: `KARYAWAN`
- **What breaks**: Session restore gagal. User harus login ulang setiap kali buka/masuk tab. Flow `dam_session` localStorage rusak.
- **Notes**: Dipanggil 2 kali di HOME_PORTAL (initial restore + role permission restore).

### getKaryawanMapByNIK() — `SharedLib.gs:408`
- **Risk**: CRITICAL
- **Direct callers**: `verifyLogin()`, `verifySession()`, `searchKaryawan()`, `getDashboardData()`, `getKaryawanByNIK()`, `getAreaActivityReport()`, `requireRole()`, `getKehadiranDashboard()`
- **Callees**: `getSheet()`, `asText()`
- **Sheets read**: `KARYAWAN`
- **What breaks**: Semua auth, search, dashboard, report gagal. Fungsi paling banyak dipanggil di seluruh sistem.
- **Notes**: Output map `{ nik → { nik, nama, dept, jabatan, role, type, password } }`. Jangan ubah struktur return-nya.

### makeKaryawanPayload(row) — `SharedLib.gs:348`
- **Risk**: HIGH
- **Direct callers**: `verifyLogin()`, `verifySession()`, `requireRole()`
- **Callees**: `isExternalKaryawan()`
- **Sheets read**: Tidak langsung (via parameter row)
- **What breaks**: Payload session rusak. Frontend tidak bisa membaca role/dept/type user.
- **Notes**: Struktur payload: `{ nik, nama, role, dept, jabatan, type, isExternal }`. Kontrak dengan frontend `dam_session`.

### getKaryawanByNIK(nik) — `SharedLib.gs:430`
- **Risk**: HIGH
- **Direct callers**: `bindKartu()`, `releaseKartu()`, `scanAreaKerja()`, `saveJadwalShift()`, `searchKaryawan()`
- **Callees**: `getSheet()`, `asText()`
- **Sheets read**: `KARYAWAN`
- **What breaks**: Flow gate (masuk/keluar), scan area, jadwal shift tidak bisa resolve karyawan by NIK.
- **Notes**: Fungsi lookup single-row, lebih ringan dari `getKaryawanMapByNIK()`.

### searchKaryawan(query) — `SharedLib.gs:451` & `Code.js:34`
- **Risk**: MEDIUM
- **Frontend callers**: `doSearch()` di semua 4 modul + gate flow search
- **Callees**: `getSheet()`, `asText()`, `getKaryawanByNIK()`
- **Sheets read**: `KARYAWAN`
- **What breaks**: Search karyawan di UI tidak berfungsi. Flow masuk manual terganggu.
- **Notes**: Ada dua definisi: di `Code.js:34` (wrapper) dan `SharedLib.gs:451` (core). Code.js wrapper menambah validasi query length.

### getAvailableDepts() — `SharedLib.gs:361`
- **Risk**: LOW
- **Direct callers**: `verifyLogin()`, `verifySession()`
- **Callees**: `getKaryawanMapByNIK()` (indirect via parameter?)
- **Sheets read**: Tidak langsung
- **What breaks**: Filter departemen di dashboard/report tidak terisi.

---

## Domain: Gate — Masuk & Keluar Pabrik

### bindKartu(noKartuMK, nik, loker) — `GateFunctions.gs:98`
- **Risk**: HIGH
- **Frontend callers**: `confirmMasuk()` di HOME_PORTAL:658, MODUL_AREA_KERJA:665, MODUL_GATE_PABRIK:653, MODUL_REPORT:579
- **Callees**: `withDocumentLock()`, `assertCard()`, `getKaryawanByNIK()`, `nowWIB()`, `formatDate()`, `formatTime()`, `isExternalKaryawan()`, `getFactoryRecapStatus()`, `detectShift()`, `getSheet()`, `safeUpdateRecapAbsen()`, `getBindingStatus()`, `escHtml()`
- **Sheets read**: `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`
- **Sheets write**: `REGISTRASI SAAT MASUK PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`
- **What breaks**: Karyawan tidak bisa masuk pabrik. Binding kartu gagal. Recap absen tidak terupdate. Seluruh flow MASUK mati.
- **Notes**: Write path paling kompleks. Dibungkus `withDocumentLock()`. Dependency pada `SHIFT_CONFIG` via `detectShift()`.

### releaseKartu(noKartuMK, loker, mode) — `GateFunctions.gs:169`
- **Risk**: HIGH
- **Frontend callers**: `confirmKeluar()` di HOME_PORTAL:679,792, MODUL_AREA_KERJA:766, MODUL_GATE_PABRIK:674,787, MODUL_REPORT:680
- **Callees**: `withDocumentLock()`, `assertCard()`, `asText()`, `getKaryawanByNIK()`, `isExternalKaryawan()`, `nowWIB()`, `formatDate()`, `getFactoryRecapStatus()`, `formatTime()`, `detectShift()`, `getSheet()`, `safeUpdateRecapAbsen()`, `formatDateTime()`, `getBindingStatus()`, `getHeaderIndex()`
- **Sheets read**: `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`
- **Sheets write**: `REGISTRASI SAAT KELUAR PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`
- **What breaks**: Karyawan tidak bisa keluar pabrik. Kartu tetap tertahan status BOUND. Recap absen tidak terupdate.
- **Notes**: `mode='FORCE_RELEASE'` diblokir sejak FASE 24. Hanya Security yang bisa release via flow terpisah.

### getBindingStatus(noKartuMK) — `GateFunctions.gs:56`
- **Risk**: MEDIUM
- **Frontend callers**: `onSerialScanned('keluar')`, `handleSecurityScan()` di semua 4 modul
- **Internal callers**: `bindKartu()`, `releaseKartu()`, `scanAreaKerja()`
- **Callees**: `getSheet()`, `assertCard()`, `normalizeCard()`, `asText()`, `getKaryawanByNIK()`, `isExternalKaryawan()`, `formatDate()`, `getFactoryRecapStatus()`, `nowWIB()`
- **Sheets read**: `BINDING_KARTU_MK`, `ABSEN IN OUT MK`, `KARYAWAN`
- **What breaks**: Status kartu tidak bisa dicek. Flow keluar dan scan area macet.
- **Notes**: Return value `{ status, card, nik, nama, ... }` dipakai oleh `scanAreaKerja()` dan flow keluar.

### updateRecapAbsen(dateKey, nik, ...) — `GateFunctions.gs:9`
- **Risk**: MEDIUM
- **Internal callers**: `safeUpdateRecapAbsen()`
- **Callees**: `getSheet()`, `makeRecapKey()`, `getRecapStatus()`, `asText()`
- **Sheets read/write**: `ABSEN IN OUT MK`
- **What breaks**: Recap absen harian tidak terupdate. Dashboard kehadiran akan menampilkan data kosong.
- **Notes**: Dipanggil via `safeUpdateRecapAbsen()` wrapper. Jangan dipanggil langsung.

### safeUpdateRecapAbsen(bindCtx) — `GateFunctions.gs:47`
- **Risk**: MEDIUM
- **Internal callers**: `bindKartu()`, `releaseKartu()`
- **Callees**: `updateRecapAbsen()`, `asText()`
- **Sheets**: Via `updateRecapAbsen()`
- **What breaks**: Recap absen tidak terupdate setelah masuk/keluar.
- **Notes**: Wrapper safety untuk `updateRecapAbsen()`. Menambahkan error handling.

### getFactoryRecapStatus(nik, dateKey) — `SharedLib.gs:375`
- **Risk**: MEDIUM
- **Internal callers**: `bindKartu()`, `releaseKartu()`, `getBindingStatus()`, `scanAreaKerja()`
- **Callees**: `getSheet()`, `makeRecapKey()`, `getRecapStatus()`
- **Sheets read**: `ABSEN IN OUT MK`
- **What breaks**: Status DI DALAM/SUDAH PULANG/BELUM MASUK tidak terdeteksi. Flow gate dan scan area tidak bisa menentukan IN/OUT.
- **Notes**: Return value menentukan apakah user bisa masuk/keluar/scan area.

---

## Domain: Area Kerja

### scanAreaKerja(serial, area, reason, forceMode) — `AreaFunctions.gs:9`
- **Risk**: HIGH
- **Frontend callers**: `onSerialScanned('security')` di HOME_PORTAL:581, MODUL_AREA_KERJA:588, MODUL_GATE_PABRIK:576, MODUL_REPORT:502
- **Callees**: `withDocumentLock()`, `assertCard()`, `asText()` (multiple), `getKaryawanByNIK()`, `getBindingStatus()`, `getFactoryRecapStatus()`, `isExternalKaryawan()`, `nowWIB()`, `formatDate()`, `formatDateTime()`, `getSheet()`, `normalizeCard()`, `formatTime()`, `formatDateForSort()`
- **Sheets read**: `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`, `REGISTRASI MASUK KELUAR AREA KERJA`
- **Sheets write**: `REGISTRASI MASUK KELUAR AREA KERJA`
- **What breaks**: Security/pengawas tidak bisa scan area kerja. Log IN/OUT area tidak tercatat. Dashboard populasi area tidak terupdate.
- **Notes**: Dibungkus `withDocumentLock()`. Parameter `forceMode` (AUTO/IN/OUT) ditambahkan di FASE 8.

### getDashboardData(basis, basisValue, deptFilter, typeFilter) — `AreaFunctions.gs:68`
- **Risk**: MEDIUM
- **Frontend callers**: `loadDashboard()` di MODUL_AREA_KERJA:830, MODUL_GATE_PABRIK:851, MODUL_REPORT:744
- **Callees**: `toDateKey()`, `buildBasisConfig()`, `getKaryawanMapByNIK()`, `getSheet()`, `asText()` (multiple), `isDateWithinRange()`, `isTimeInShift()`, `buildDateTimeKey()`, `normalizeCard()`, `toDisplayTime()`, `formatDate()`, `isExternalKaryawan()`
- **Sheets read**: `ABSEN IN OUT MK`, `REGISTRASI MASUK KELUAR AREA KERJA`, `KARYAWAN`
- **What breaks**: Dashboard operasional tidak bisa load. Area population, kanban, shift coverage hilang. Bug fix FASE 38: typeCounts/deptCounts di-rebuild setelah filter.
- **Notes**: Fungsi paling kompleks di area domain (~400 baris). Return shape: `{ boundList, areaPopulation, summary, shiftCoverage }`.

### getKehadiranDashboard(tanggal, shiftFilter, deptFilter, typeFilter) — `AreaFunctions.gs` (FASE 35)
- **Risk**: MEDIUM
- **Frontend callers**: `loadKehadiranDashboard()` di HOME_PORTAL
- **Callees**: `getKaryawanExpectedForDate()`, `getKaryawanMapByNIK()`, `getLateMinutes()`, `getLateCategory()`, `getOvertimeMinutes()`, `SHIFT_CONFIG`
- **Sheets read**: `ABSEN IN OUT MK`, `KARYAWAN`, `JADWAL_SHIFT`
- **What breaks**: Dashboard Kehadiran, Keterlambatan, Lembur tidak berfungsi. 3 kanban tab kosong. Coverage % hilang.
- **Notes**: Return `{ summary, kehadiranList, anomaliList }`. Dipanggil dengan lazy-load di sub-tab dashboard.

### getRecentAreaLogs() — `AreaFunctions.gs:461`
- **Risk**: LOW
- **Frontend callers**: `loadRecentLogs()` di HOME_PORTAL:1259, MODUL_AREA_KERJA:862, MODUL_GATE_PABRIK:883, MODUL_REPORT:776
- **Callees**: `getSheet()`, `asText()`, `normalizeCard()`
- **Sheets read**: `REGISTRASI MASUK KELUAR AREA KERJA`
- **What breaks**: Log area terbaru tidak tampil. Fitur minor.
- **Notes**: Read-only. Return maks 20 baris terakhir.

---

## Domain: Android Bridge & Diagnostics

### submitGateRequest(payload) — `GateFunctions.gs:424`
- **Risk**: HIGH
- **Frontend callers**: `gate_screen.dart` (Android)
- **Callees**: `withCardLock()`, `bindKartu()`, `releaseKartu()`, helper ledger Android gate
- **Sheets read**: `ANDROID_GATE_REQUESTS`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`, `KARYAWAN`
- **Sheets write**: `ANDROID_GATE_REQUESTS`, plus sheet gate domain terkait
- **What breaks**: Retry Android jadi tidak idempotent. Scan gate dari HP rawan double write atau status abu-abu saat koneksi putus.
- **Notes**: Ini lapisan bridge Android, bukan pengganti mutasi inti `bindKartu()` / `releaseKartu()`.

### getGateRequestStatus(requestId) — `GateFunctions.gs:485`
- **Risk**: MEDIUM
- **Frontend callers**: polling recovery di `gate_screen.dart`
- **Callees**: `getSheet()`, helper lookup ledger
- **Sheets read**: `ANDROID_GATE_REQUESTS`
- **What breaks**: Android tidak bisa memastikan apakah request gate sebelumnya sudah sukses atau belum.
- **Notes**: Sangat penting untuk recovery setelah timeout atau response hilang.

### pingAndroidGateway(payload) — `AndroidDiagnostics.gs:53`
- **Risk**: LOW
- **Frontend callers**: `home_screen.dart` via `ApiService.prewarmGateway()`
- **Sheets read/write**: -
- **What breaks**: Tidak mematikan flow inti, tetapi scan pertama dari HP lebih rawan kena cold-start DNS/TLS/redirect penalty.
- **Notes**: Dipakai untuk prewarm koneksi.

### logAndroidDiagnostics(payload) — `AndroidDiagnostics.gs:65`
- **Risk**: LOW
- **Frontend callers**: `ApiService` flush telemetry Android
- **Callees**: `getSheet()`
- **Sheets write**: `ANDROID_DIAGNOSTICS`
- **What breaks**: Kegagalan koneksi Android tidak punya jejak audit backend. Proses troubleshooting jadi buta.
- **Notes**: Tidak boleh melempar error yang merusak request operasional lain.

---

## Domain: Report

### getAbsenReport(nik, deptFilter, periodType, periodValue) — `ReportFunctions.gs:26`
- **Risk**: MEDIUM
- **Frontend callers**: `processAbsenReport()` di HOME_PORTAL:1327, MODUL_REPORT:840
- **Callees**: `toDateKey()`, `buildAbsenReportCacheKey()`, `getPeriodRange()`, `getSheet()`, `formatDate()`, `asText()`
- **Sheets read**: `ABSEN IN OUT MK`
- **What breaks**: Report absen tidak bisa di-generate. Export CSV gagal.
- **Notes**: Punya cache singkat untuk request periode yang sama (FASE 25 optimization).

### getAreaActivityReport(nik, deptFilter, periodType, periodValue) — `ReportFunctions.gs:83`
- **Risk**: MEDIUM
- **Frontend callers**: `processAreaReport()` di HOME_PORTAL:1478, MODUL_AREA_KERJA:1083, MODUL_GATE_PABRIK:1104, MODUL_REPORT:1009
- **Callees**: `getPeriodRange()`, `getSheet()`, `getKaryawanMapByNIK()`, `asText()`, `isDateInRange()`, `normalizeCard()`
- **Sheets read**: `REGISTRASI MASUK KELUAR AREA KERJA`, `KARYAWAN`
- **What breaks**: Report aktivitas area tidak bisa di-generate.
- **Notes**: Enrich nama dari KARYAWAN untuk setiap baris log area.

---

## Domain: Jadwal Shift

### saveJadwalShift(nik, shift, tanggalMulai, tanggalSelesai) — `JadwalFunctions.gs`
- **Risk**: MEDIUM
- **Frontend callers**: `saveJadwalEntry()` di HOME_PORTAL
- **Callees**: `getKaryawanByNIK()`, `withDocumentLock()`
- **Sheets read**: `KARYAWAN`, `JADWAL_SHIFT`
- **Sheets write**: `JADWAL_SHIFT`
- **What breaks**: Tidak bisa menyimpan jadwal shift. Coverage % dashboard kehadiran tidak terhitung.
- **Notes**: Upsert by NIK + shift combination. Auto-fill nama/dept dari KARYAWAN.

### deleteJadwalShift(rowIndex) — `JadwalFunctions.gs`
- **Risk**: LOW
- **Frontend callers**: `deleteJadwalEntry()` di HOME_PORTAL
- **Callees**: `withDocumentLock()`
- **Sheets write**: `JADWAL_SHIFT`
- **What breaks**: Tidak bisa menghapus jadwal shift.

### getJadwalShift(deptFilter) — `JadwalFunctions.gs`
- **Risk**: LOW
- **Frontend callers**: `loadJadwalShift()` di HOME_PORTAL
- **Sheets read**: `JADWAL_SHIFT`, `KARYAWAN`
- **What breaks**: Tabel jadwal shift tidak tampil di tab REVISI.

### getKaryawanExpectedForDate(tanggal) — `JadwalFunctions.gs`
- **Risk**: MEDIUM
- **Internal callers**: `getKehadiranDashboard()`
- **Sheets read**: `JADWAL_SHIFT`
- **What breaks**: Coverage % di dashboard kehadiran = 0. Perbandingan expected vs actual tidak jalan.
- **Notes**: Internal-only, dipanggil dari `getKehadiranDashboard()`.

---

## Domain: Shared Utilities

### getSheet(name) — `SharedLib.gs:142`
- **Risk**: CRITICAL
- **Direct callers**: Hampir semua fungsi backend (50+ calls)
- **Callees**: `getSpreadsheet()`, `ensureHeader()`, `ensureOptionalHeaders()`
- **Sheets read**: Semua (via `SHEET_HEADERS`)
- **What breaks**: Seluruh akses Google Sheet gagal. Aplikasi mati total.
- **Notes**: Single point of failure untuk semua sheet access. Header enforcement di sini.

### withDocumentLock(fn) — `SharedLib.gs:303`
- **Risk**: CRITICAL
- **Direct callers**: `bindKartu()`, `releaseKartu()`, `scanAreaKerja()`, `saveJadwalShift()`, `deleteJadwalShift()`
- **What breaks**: Race condition di semua write path. Data corrupt bisa terjadi.
- **Notes**: Semua write path utama dibungkus ini. Kalau locking rusak, binding, recap, log area, dan data jadwal langsung terdampak.

### ensureHeader(sheet, name) — `SharedLib.gs:81`
- **Risk**: HIGH
- **Direct callers**: `getSheet()` (setiap akses sheet)
- **Callees**: `normalizeHeader()`
- **What breaks**: Sheet dengan header tidak sesuai akan gagal dibaca. Flow apapun yang akses sheet tersebut mati.
- **Notes**: Mismatch header adalah dependency runtime kritis. Setiap perubahan struktur sheet wajib update `SHEET_HEADERS`.

### nowWIB() — `SharedLib.gs:160`
- **Risk**: MEDIUM
- **Direct callers**: `scanAreaKerja()`, `bindKartu()`, `releaseKartu()`, `getDashboardData()`, `getBindingStatus()`
- **What breaks**: Semua timestamp salah zona waktu. Data log dan recap tidak akurat.
- **Notes**: Timezone WIB (Asia/Jakarta). Single source of truth untuk semua timestamp.

### formatDate() / formatTime() / formatDateTime() — `SharedLib.gs:164-184`
- **Risk**: LOW
- **Direct callers**: Hampir semua fungsi backend (30+ calls)
- **What breaks**: Semua output tanggal/jam ke UI dan sheet salah format.
- **Notes**: Utility formatting. Perubahan format string harus disinkronkan dengan frontend expectation.

### parseSheetDate() / parseIsoDate() — `SharedLib.gs:194-231`
- **Risk**: LOW
- **Direct callers**: `formatDateForSort()`, `getPeriodRange()`, `getDashboardData()`
- **What breaks**: Parsing tanggal dari sheet gagal. Filter periode, sortir, dan dashboard bisa salah data.

### detectShift(date) — `SharedLib.gs:290`
- **Risk**: MEDIUM
- **Direct callers**: `bindKartu()`, `releaseKartu()`, `getDashboardData()`
- **Callees**: `SHIFT_CONFIG`
- **What breaks**: Semua penentuan shift (Shift 1/2/3) salah. Recap masuk/keluar salah shift. Dashboard coverage salah.
- **Notes**: Dependency pada `SHIFT_CONFIG`. Cross-midnight handling untuk Shift 3.

### getLateMinutes() / getLateCategory() / getOvertimeMinutes() — `SharedLib.gs`
- **Risk**: MEDIUM
- **Direct callers**: `getKehadiranDashboard()`
- **Callees**: `SHIFT_CONFIG`, `timeStrToMinutes()`
- **What breaks**: Semua perhitungan keterlambatan dan lembur di dashboard kehadiran salah.
- **Notes**: Contract bersama dengan `SHIFT_CONFIG`. Shift 3 cross-midnight: effectiveEnd = 360 + 1440 = 1800.

### SHIFT_CONFIG constant — `SharedLib.gs`
- **Risk**: HIGH
- **Used by**: `detectShift()`, `getLateMinutes()`, `getOvertimeMinutes()`, `getKehadiranDashboard()`
- **What breaks**: Semua perhitungan shift, keterlambatan, dan lembur salah. Dashboard kehadiran tidak akurat.
- **Notes**: Single source of truth: Shift 1 (06:01–14:00), Shift 2 (14:01–22:00), Shift 3 (22:01–06:00).

### escHtml(value) — `SharedLib.gs:44`
- **Risk**: LOW
- **Direct callers**: `bindKartu()` (html message)
- **What breaks**: Potensi XSS di pesan HTML backend. FASE 21-22 hardening.

### asText(value) — `SharedLib.gs:34`
- **Risk**: LOW
- **Direct callers**: Hampir semua fungsi backend (100+ calls)
- **What breaks**: Konversi null/undefined ke empty string gagal. Bisa menyebabkan error cascade di banyak tempat.
- **Notes**: Utility paling fundamental. Dipanggil di mana-mana.

### getPeriodRange(periodType, periodValue) — `SharedLib.gs:241`
- **Risk**: MEDIUM
- **Internal callers**: `getAbsenReport()`, `getAreaActivityReport()`
- **Callees**: `parseIsoDate()`, `formatDate()`, `parseSheetDate()`
- **What breaks**: Filter tanggal di report salah. Data periode yang ditampilkan tidak sesuai.
- **Notes**: Support type: `date`, `week`, `month`.

### getModuleUrls() / setupModuleUrls() — `SharedLib.gs:581-615`
- **Risk**: LOW (legacy)
- **Frontend callers**: Hanya child modules (MODUL_AREA_KERJA, MODUL_GATE_PABRIK)
- **Sheets read**: `CONFIG_MODUL`
- **What breaks**: Routing compatibility lama mati. HOME_PORTAL shell tidak terpengaruh (sudah fully local tab switching).
- **Notes**: `setupModuleUrls()` SUDAH DIHAPUS (FASE 37). CONFIG_MODUL dikelola eksklusif oleh `npm run deploy`.

---

## Blast Radius Quick Reference (By Impact)

### Jika mengubah fungsi ini, berikut yang terdampak:

| Fungsi | Risk | Frontend flows terdampak | Sheet terdampak | Internal caller |
|---|---|---|---|---|
| `doGet()` | CRITICAL | Seluruh web app | - | Browser |
| `verifyLogin()` | CRITICAL | Login (semua role) | KARYAWAN | handleLoginSubmit |
| `verifySession()` | CRITICAL | Session restore | KARYAWAN | restoreSavedSession |
| `getKaryawanMapByNIK()` | CRITICAL | Auth, Search, Dashboard, Report | KARYAWAN | 8 functions |
| `getSheet()` | CRITICAL | Semua flows | Semua sheets | 50+ calls |
| `withDocumentLock()` | CRITICAL | Gate, Area, Jadwal write | BINDING, RECAP, AREA, JADWAL | 5 functions |
| `bindKartu()` | HIGH | MASUK pabrik | MASUK, BINDING, RECAP | confirmMasuk |
| `releaseKartu()` | HIGH | KELUAR pabrik | KELUAR, BINDING, RECAP | confirmKeluar |
| `scanAreaKerja()` | HIGH | SCAN AREA | AREA_KERJA | onSerialScanned |
| `SHIFT_CONFIG` | HIGH | Shift, Keterlambatan, Lembur | - | detectShift, getLateMinutes, getOvertimeMinutes |
| `ensureHeader()` | HIGH | Semua akses sheet | Semua sheets | getSheet |
| `makeKaryawanPayload()` | HIGH | Session payload | KARYAWAN | verifyLogin, verifySession |
| `getKaryawanByNIK()` | HIGH | Gate, Area, Jadwal lookup | KARYAWAN | 5 functions |
| `getDashboardData()` | MEDIUM | Dashboard Operasional | RECAP, AREA, KARYAWAN | loadDashboard |
| `getKehadiranDashboard()` | MEDIUM | Dashboard Kehadiran/Keterlambatan/Lembur | RECAP, KARYAWAN, JADWAL | loadKehadiranDashboard |
| `getAbsenReport()` | MEDIUM | CEK ABSEN | RECAP | processAbsenReport |
| `getAreaActivityReport()` | MEDIUM | CEK AREA | AREA_KERJA, KARYAWAN | processAreaReport |
| `getBindingStatus()` | MEDIUM | Keluar, Scan Area | BINDING, RECAP, KARYAWAN | onSerialScanned, bindKartu, releaseKartu, scanAreaKerja |
| `updateRecapAbsen()` | MEDIUM | Recap absen | RECAP | safeUpdateRecapAbsen |
| `getFactoryRecapStatus()` | MEDIUM | Gate, Area status | RECAP | bindKartu, releaseKartu, scanAreaKerja, getBindingStatus |
| `getPeriodRange()` | MEDIUM | Report filter | - | getAbsenReport, getAreaActivityReport |
| `saveJadwalShift()` | MEDIUM | Jadwal Shift save | JADWAL, KARYAWAN | saveJadwalEntry |
| `getLateMinutes()` | MEDIUM | Keterlambatan | - | getKehadiranDashboard |
| `getOvertimeMinutes()` | MEDIUM | Lembur | - | getKehadiranDashboard |
| `detectShift()` | MEDIUM | Shift detection | - | bindKartu, releaseKartu, getDashboardData |

## Cara Menggunakan Dokumen Ini

1. Sebelum edit fungsi backend, cari nama fungsi di tabel di atas.
2. Periksa risk level. Jika CRITICAL atau HIGH, wajib lapor dan verifikasi.
3. Periksa "Frontend flows terdampak" — test semua flow tersebut setelah perubahan.
4. Periksa "Sheet terdampak" — pastikan struktur sheet masih kompatibel.
5. Periksa "Internal caller" — pastikan fungsi upstream tidak rusak.
6. Setelah deploy, jalankan smoke test minimal untuk flow yang terdampak.
7. Update dokumen ini jika blast radius berubah akibat penambahan fungsi baru.

---

**Last updated**: 2026-08-11  
**Data source**: `reports/function_inventory.md`, `docs/NEURAL_MAPPING.md`, `docs/GAS_ARCHITECTURE.md`, hasil GitNexus, dan Graphify lokal bila diregenerate
