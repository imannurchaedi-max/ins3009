# Neural Mapping

Dokumen ini adalah peta mental operasional untuk runtime aktif repo ini. Tujuannya bukan menggantikan source code atau audit generated, tetapi memberi visibilitas cepat tentang:

- jalur runtime yang benar-benar aktif
- neuron utama aplikasi: shell, session, gate, area, dashboard kehadiran, jadwal, report, dan sheet storage
- input-output dependency per use case
- jalur legacy yang masih terlihat di audit tetapi bukan primary user-facing flow

Status dokumen ini divalidasi ulang pada `2026-06-09` memakai:

- inspeksi langsung source `active/HOME_PORTAL/` setelah FASE 1-8 dan login-page bug fix
- `docs/GAS_ARCHITECTURE.md` sebagai acuan struktur
- `npm run deploy` sebagai jalur deploy+sync utama

## Source of Truth

- Runtime aktif yang harus dijadikan acuan utama: `active/HOME_PORTAL/`
- Dokumen arsitektur utama: `docs/GAS_ARCHITECTURE.md`
- Audit teknis generated:
  - `reports/GAS_RUNTIME_AUDIT.md`
  - `reports/function_inventory.md`
  - `reports/gas_runtime_comparison.json`

Jalur yang masih ada tetapi jangan dijadikan titik baca utama:

- `active/MODUL_GATE_PABRIK/`
- `active/MODUL_AREA_KERJA/`
- `active/MODUL_REPORT/`
- `scripts/` kecuali saat perlu eksekusi tooling

## Topologi Besar

```text
User / Browser
  -> HOME_PORTAL web app URL
  -> active/HOME_PORTAL/Code.js::doGet()
  -> active/HOME_PORTAL/Index.html
     -> include(style.html)
     -> include(app.html)
  -> app.html frontend state + event handlers + scanner flow
  -> google.script.run
  -> domain backend:
     -> SharedLib.gs          (utility, auth, shift config, lookup)
     -> GateFunctions.gs      (masuk/keluar pabrik)
     -> AreaFunctions.gs      (scan area, dashboard operasional, dashboard kehadiran)
     -> ReportFunctions.gs    (export report)
     -> JadwalFunctions.gs    (CRUD jadwal shift karyawan)
  -> Google Sheets
  -> JSON response
  -> render ulang ke UI
```

## Runtime Neurons

### 1. Shell Neuron

- Entry point: `active/HOME_PORTAL/Code.js::doGet()`
- Template shell: `active/HOME_PORTAL/Index.html`
- Client runtime: `active/HOME_PORTAL/app.html`
- Tugas:
  - memuat halaman tunggal
  - menjaga semua tab tetap lokal tanpa pindah URL
  - menjadi host semua event handler frontend
- Catatan terbaru:
  - Login page visibility dikendalikan oleh CSS class `.active` (bukan inline `display:flex`)
  - `#page-login { display: none }` + `#page-login.active { display: flex }` — id selector tidak lagi bersaing dengan `.page { display: none }`
  - `applyRolePermissions()` menggunakan null-safe DOM access + `style.removeProperty('display')` untuk hide login

### 2. Session Neuron

- Client state: `dam_session` di `localStorage`
- Frontend entry:
  - `restoreSavedSession()`
  - `handleLoginSubmit()`
  - `hydrateAuthenticatedUser(user, depts)`
  - `applyRolePermissions(role)`
  - `setLoginUiMode(mode)`
  - `handleLogout()`
- GAS endpoints:
  - `verifySession()`
  - `verifyLogin()`
- Shared dependency:
  - `getKaryawanMapByNIK()`
  - `makeKaryawanPayload()`
- Sheet utama:
  - `KARYAWAN`
- Output:
  - payload user `{ nik, nama, role, dept, jabatan, type, isExternal }`
  - daftar departemen untuk filter report/dashboard
- Role → tab default:
  - ADMINISTRATOR → dashboard
  - PENGAWAS → security
  - SECURITY → security
  - KARYAWAN → masuk

### 3. Search Neuron

- Frontend entry: `doSearch(q, context)`
- GAS endpoint: `searchKaryawan(query)`
- Sheet utama:
  - `KARYAWAN`
- Output:
  - hasil lookup NIK dan nama untuk proses masuk

### 4. Gate Neuron

- Frontend entry:
  - `confirmMasuk()`
  - `onSerialScanned('keluar', serial)` -> `handleKeluarScan()` -> `confirmKeluar()`
- GAS endpoints:
  - `bindKartu()`
  - `getBindingStatus()`
  - `releaseKartu()`
  - `updateRecapAbsen()` via helper internal
- Shared dependency:
  - `withDocumentLock()`
  - `getFactoryRecapStatus()`
  - `getKaryawanByNIK()`
- Sheet utama:
  - `KARYAWAN`
  - `BINDING_KARTU_MK`
  - `REGISTRASI SAAT MASUK PABRIK`
  - `REGISTRASI SAAT KELUAR PABRIK`
  - `ABSEN IN OUT MK`
- Output:
  - status binding
  - status masuk/keluar
  - recap absen harian

### 5. Area Neuron

- Frontend entry:
  - `onSerialScanned('security', serial)`
  - `handleSecurityScan(res)`
- GAS endpoints:
  - `scanAreaKerja()`
  - `getRecentAreaLogs()`
  - `getDashboardData(basis, basisValue, deptFilter, typeFilter)`
- Shared dependency:
  - `getBindingStatus()`
  - `getFactoryRecapStatus()`
  - `getKaryawanMapByNIK()`
- Sheet utama:
  - `REGISTRASI MASUK KELUAR AREA KERJA`
  - `ABSEN IN OUT MK`
  - `KARYAWAN`
- Output:
  - log IN/OUT area
  - area terakhir per orang
  - populasi dashboard (filter dept dan type tersedia)
  - shiftCoverage: hadir/terlambat/lembur per shift (Shift 1/2/3)

### 6. Dashboard Kehadiran Neuron

- Frontend entry:
  - `loadKehadiranDashboard()`
  - `switchDashboardSubtab(subtab)` — lazy load saat sub-tab pertama kali dibuka
  - `updateKehadiranKPI(summary)`
  - `renderKehadiranKanban(kehadiranList)`
  - `renderKeterlambatanKanban(kehadiranList)`
  - `renderLemburKanban(kehadiranList)`
  - `renderShiftCoverage(shiftCoverage)`
- GAS endpoint:
  - `getKehadiranDashboard(tanggal, shiftFilter, deptFilter, typeFilter)`
- Internal GAS dependency:
  - `getKaryawanExpectedForDate(tanggal)` ← dipanggil dari dalam `getKehadiranDashboard`
- Shared dependency:
  - `getLateMinutes()`, `getLateCategory()`, `getOvertimeMinutes()` — dari `SharedLib.gs`
  - `SHIFT_CONFIG` — shift standard 06:01/14:01/22:01
- Sheet utama:
  - `ABSEN IN OUT MK` (read)
  - `KARYAWAN` (read, enrichment)
  - `JADWAL_SHIFT` (read, expected count per shift)
- Output shape:
  ```js
  {
    ok, tanggal,
    summary: {
      totalHadir, totalBelumMasuk, totalSudahPulang,
      totalOnTime, totalTerlambat: { ringan, sedang, berat },
      totalLembur, totalAnomali, totalExpected, coveragePct,
      byShift: [{ label, expected, hadir, coverage_pct, terlambat, lembur }]
    },
    kehadiranList: [{ nik, nama, dept, jabatan, type, shift,
                      jamMasuk, jamKeluar, presenceStatus,
                      lateMinutes, lateCategory, overtimeMinutes }],
    anomaliList:   [{ nik, nama, deskripsi, jam }]
  }
  ```
- presenceStatus enum: `belum_masuk | di_dalam | sudah_pulang | anomali`
- lateCategory enum: `ontime | ringan (1-14m) | sedang (15-29m) | berat (≥30m)`
- Kanban sub-tabs:
  - **Kehadiran** — 4 kolom: Belum Masuk / Di Dalam / Sudah Pulang / Anomali
  - **Keterlambatan** — 4 kolom: On Time / Ringan / Sedang / Berat
  - **Lembur** — 3 kolom: <1 Jam / 1-2 Jam / >2 Jam

### 7. Report Neuron

- Frontend entry:
  - `processAbsenReport()`
  - `processAreaReport()`
- GAS endpoints:
  - `getAbsenReport()`
  - `getAreaActivityReport()`
- Sheet utama:
  - `ABSEN IN OUT MK`
  - `REGISTRASI MASUK KELUAR AREA KERJA`
  - `KARYAWAN`
- Output:
  - data tabel report
  - summary counter
  - data export CSV di sisi frontend

### 8. Jadwal Neuron

- Frontend entry:
  - `loadJadwalShift()`
  - `renderJadwalTable(data)`
  - `saveJadwalEntry()`
  - `deleteJadwalEntry(rowIndex)`
  - `lookupJadwalNik()`
  - `populateDeptFilterOptions()` — juga populate filter di REVISI tab
- GAS endpoints:
  - `getJadwalShift(deptFilter)`
  - `saveJadwalShift(nik, shift, tanggalMulai, tanggalSelesai)`
  - `deleteJadwalShift(rowIndex)`
  - `bulkSaveJadwalShift(items)` — bulk import
- Internal GAS dependency:
  - `getKaryawanByNIK(nik)` — auto-fill nama/dept dari NIK
  - `withDocumentLock()` — semua write path dibungkus lock
- Sheet utama:
  - `JADWAL_SHIFT` (read + write)
  - `KARYAWAN` (read, lookup)
- Output:
  - daftar jadwal aktif per dept
  - upsert entry by NIK + shift combination
  - expected count input untuk coverage % di Dashboard Kehadiran
- Schema JADWAL_SHIFT: `NIK | NAMA | DEPT | SHIFT | TANGGAL_MULAI | TANGGAL_SELESAI`
  - `TANGGAL_SELESAI` kosong = jadwal permanen (diperlakukan sebagai `99991231`)

### 9. Storage Neuron

- Spreadsheet ID dikunci di `SharedLib.gs`
- Semua akses sheet dipusatkan lewat `getSheet(name)`
- Header enforcement:
  - `ensureHeader()`
  - `ensureOptionalHeaders()`
- Sheet baru ditambahkan via `SHEET_HEADERS` di `SharedLib.gs` (termasuk `JADWAL_SHIFT`)
- Shift config constants (SharedLib.gs):
  - `SHIFT_CONFIG`: startTotal/endTotal per shift dalam menit dari 00:00
  - Shift 1: 361–840 mnt, Shift 2: 841–1320 mnt, Shift 3: 1321–360 mnt (cross-midnight)
  - Utilities: `timeStrToMinutes`, `getLateMinutes`, `getLateCategory`, `getOvertimeMinutes`, `formatDurationMinutes`
- Deployment registry sync:
  - `scripts/update_config_sheet.py`
  - `scripts/push-all.js`
- Dampak:
  - semua domain function bergantung pada definisi header canonical
  - mismatch header bisa menjatuhkan flow walau fungsi bisnisnya benar

## Flow Utama

### Flow 1. Bootstrap Session

```text
User buka HOME_PORTAL
  -> Index.html load style + app
  -> DOMContentLoaded
  -> baca dam_session di localStorage
  -> restoreSavedSession() → hydrateAuthenticatedUser()
  -> applyRolePermissions(role)
     -> null-safe DOM manipulation (tidak throws ke try-catch)
     -> page-login.classList.remove('active') + style.removeProperty('display')
     -> CSS #page-login.active { display:flex } yang kendalikan visibility
  -> tab aktif ditentukan lokal
```

Input:
- browser localStorage
- `KARYAWAN`

Output:
- session tervalidasi
- role, dept, availableDepts
- visibilitas tab sesuai role
- login page tersembunyi via CSS class

### Flow 2. Login

```text
handleLoginSubmit()
  -> verifyLogin(nik, password)
  -> getKaryawanMapByNIK()
  -> KARYAWAN
  -> simpan dam_session
```

Input:
- NIK
- password
- `KARYAWAN`

Output:
- user payload
- daftar departemen
- status login

### Flow 3. Masuk Pabrik

```text
doSearch()
  -> searchKaryawan()
scan kartu / pilih NIK
  -> confirmMasuk()
  -> bindKartu(noKartuMK, nik, loker)
  -> cek recap + binding + master karyawan
  -> tulis log masuk
  -> update recap
```

Input:
- NIK terpilih
- kartu MK atau NIK internal
- no loker opsional
- `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`

Output:
- write ke `REGISTRASI SAAT MASUK PABRIK`
- write/update `BINDING_KARTU_MK`
- write/update `ABSEN IN OUT MK`
- pesan sukses/gagal ke UI

### Flow 4. Keluar Pabrik

```text
scan serial keluar
  -> getBindingStatus(serial)
  -> confirmKeluar()
  -> releaseKartu(noKartuMK, loker)
  -> cek binding + recap
  -> tulis log keluar
  -> update recap
```

Input:
- kartu MK atau NIK internal
- no loker opsional
- `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`

Output:
- write ke `REGISTRASI SAAT KELUAR PABRIK`
- update release status di `BINDING_KARTU_MK`
- update `ABSEN IN OUT MK`

### Flow 5. Scan Area Kerja

```text
set area
scan serial
  -> scanAreaKerja(serial, area, reason, forceMode)
  -> cek master / binding
  -> cek status di recap pabrik
  -> tentukan IN/OUT
  -> tulis log area
  -> refresh recent logs
```

Input:
- serial
- area
- alasan scan
- mode `AUTO|IN|OUT`
- `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`

Output:
- write ke `REGISTRASI MASUK KELUAR AREA KERJA`
- status area IN/OUT ke UI

### Flow 6. Dashboard Operasional

```text
loadDashboard()
  -> getDashboardData(basis, basisValue, deptFilter, typeFilter)
  -> baca recap terbaru per nik
  -> baca log area terbaru
  -> filter dept/type jika ada
  -> bentuk area population + kanban + summary + shiftCoverage
  -> populateDeptFilterOptions()
  -> loadKehadiranDashboard()   ← paralel background
```

Input:
- basis waktu dashboard
- deptFilter (opsional)
- typeFilter (opsional)
- `ABSEN IN OUT MK`
- `REGISTRASI MASUK KELUAR AREA KERJA`
- `KARYAWAN`

Output:
- headline dashboard
- inside/scanned/unscanned counts
- daftar area aktif + bound list
- `shiftCoverage[]`: hadir/terlambat/lembur per Shift 1/2/3
- 3 KPI baru: db-terlambat / db-lembur / db-anomali

Sub-tab dalam DASHBOARD:
- **Operasional** (default) — area population, kanban area, shift coverage panel
- **Kehadiran** — kanban 4 kolom per presenceStatus
- **Keterlambatan** — kanban 4 kolom per lateCategory
- **Lembur** — kanban 3 kolom per durasi lembur

### Flow 7. Report Absen

```text
processAbsenReport()
  -> getAbsenReport(nik, deptFilter, periodType, periodValue)
  -> filter recap by periode / nik / dept
  -> renderAbsenReport()
  -> exportAbsenReport() opsional
```

Input:
- nik opsional tergantung role
- dept filter
- tipe periode
- `ABSEN IN OUT MK`

Output:
- tabel report absen
- count total/complete/active
- CSV export client-side

### Flow 8. Report Aktivitas Area

```text
processAreaReport()
  -> getAreaActivityReport(nik, deptFilter, periodType, periodValue)
  -> baca log area
  -> enrich dari master karyawan
  -> renderAreaReport()
```

Input:
- nik opsional tergantung role
- dept filter
- tipe periode
- `REGISTRASI MASUK KELUAR AREA KERJA`
- `KARYAWAN`

Output:
- tabel aktivitas area
- count IN/OUT

### Flow 9. Dashboard Kehadiran

```text
loadKehadiranDashboard()       ← dipanggil dari loadDashboard() atau switchDashboardSubtab()
  -> getKehadiranDashboard(tanggal, shiftFilter, deptFilter, typeFilter)
     -> baca ABSEN IN OUT MK untuk tanggal
     -> enrich dari KARYAWAN
     -> getLateMinutes / getLateCategory / getOvertimeMinutes per baris
     -> deteksi anomali: DI_DALAM_TERLALU_LAMA (>10j) / KELUAR_TANPA_MASUK
     -> getKaryawanExpectedForDate(tanggal) ← baca JADWAL_SHIFT
     -> hitung expected, coverage_pct per shift
  -> updateKehadiranKPI(summary)
  -> renderShiftCoverage(shiftCoverage)   ← panel di sub-tab Operasional
  -> renderKehadiranKanban(kehadiranList) ← sub-tab Kehadiran
  -> renderKeterlambatanKanban(list)      ← sub-tab Keterlambatan
  -> renderLemburKanban(list)             ← sub-tab Lembur
```

Input:
- tanggal target (opsional, default hari ini)
- shiftFilter, deptFilter, typeFilter
- `ABSEN IN OUT MK`
- `KARYAWAN`
- `JADWAL_SHIFT`

Output:
- summary KPI: totalHadir, totalTerlambat (ringan/sedang/berat), totalLembur, totalAnomali
- coverage % per shift vs expected dari jadwal
- 3 kanban terisi di sub-tabs kehadiran/keterlambatan/lembur

### Flow 10. Jadwal Shift CRUD

```text
[Tab REVISI → section Manajemen Jadwal Shift]

Cari NIK:
  lookupJadwalNik()
  -> searchKaryawan(nik) atau getKaryawanByNIK(nik)

Simpan jadwal:
  saveJadwalEntry()
  -> saveJadwalShift(nik, shift, tanggalMulai, tanggalSelesai)
     -> getKaryawanByNIK(nik)    ← auto-fill nama/dept
     -> withDocumentLock()
     -> upsert row di JADWAL_SHIFT (match by NIK + shift)

Hapus jadwal:
  deleteJadwalEntry(rowIndex)
  -> deleteJadwalShift(rowIndex)
     -> withDocumentLock()
     -> hapus row by 1-based index

Muat tabel jadwal:
  loadJadwalShift()
  -> getJadwalShift(deptFilter)
  -> renderJadwalTable(data)
```

Input:
- NIK karyawan
- shift label (Shift 1 / Shift 2 / Shift 3)
- tanggal mulai (YYYY-MM-DD)
- tanggal selesai (opsional, kosong = permanen)
- `KARYAWAN`
- `JADWAL_SHIFT`

Output:
- write/update `JADWAL_SHIFT`
- coverage % di Dashboard Kehadiran akan otomatis terisi setelah ada jadwal

## Frontend -> GAS -> Sheet Matrix

| Use case | Frontend entry | GAS function | Backend file | Read sheets | Write sheets | Output utama |
|---|---|---|---|---|---|---|
| Validasi login | `handleLoginSubmit()` | `verifyLogin()` | `SharedLib.gs` | `KARYAWAN` | - | payload user + depts |
| Re-hydrate session | `restoreSavedSession()` | `verifySession()` | `SharedLib.gs` | `KARYAWAN` | - | payload user + depts |
| Cari karyawan | `doSearch()` | `searchKaryawan()` | `SharedLib.gs` | `KARYAWAN` | - | daftar kandidat |
| Cek status kartu | `onSerialScanned('keluar')` | `getBindingStatus()` | `GateFunctions.gs` | `BINDING_KARTU_MK`, `ABSEN IN OUT MK`, `KARYAWAN` | - | status `FREE/BOUND` |
| Masuk pabrik | `confirmMasuk()` | `bindKartu()` | `GateFunctions.gs` | `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | `REGISTRASI SAAT MASUK PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | status masuk + payload scan |
| Keluar pabrik | `confirmKeluar()` | `releaseKartu()` | `GateFunctions.gs` | `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | `REGISTRASI SAAT KELUAR PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | status keluar + payload scan |
| Scan area | `onSerialScanned('security')` | `scanAreaKerja()` | `AreaFunctions.gs` | `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`, `REGISTRASI MASUK KELUAR AREA KERJA` | `REGISTRASI MASUK KELUAR AREA KERJA` | status IN/OUT area |
| Dashboard operasional | `loadDashboard()` | `getDashboardData(basis, value, dept, type)` | `AreaFunctions.gs` | `KARYAWAN`, `ABSEN IN OUT MK`, `REGISTRASI MASUK KELUAR AREA KERJA` | - | summary + area population + shiftCoverage |
| Dashboard kehadiran | `loadKehadiranDashboard()` | `getKehadiranDashboard(tgl, shift, dept, type)` | `AreaFunctions.gs` | `KARYAWAN`, `ABSEN IN OUT MK`, `JADWAL_SHIFT` | - | kanban kehadiran/keterlambatan/lembur + KPI |
| Log terbaru area | `loadRecentLogs()` | `getRecentAreaLogs()` | `AreaFunctions.gs` | `REGISTRASI MASUK KELUAR AREA KERJA` | - | recent area log |
| Report absen | `processAbsenReport()` | `getAbsenReport()` | `ReportFunctions.gs` | `ABSEN IN OUT MK` | - | tabel absen + summary |
| Report area | `processAreaReport()` | `getAreaActivityReport()` | `ReportFunctions.gs` | `REGISTRASI MASUK KELUAR AREA KERJA`, `KARYAWAN` | - | tabel area + summary |
| Lihat jadwal shift | `loadJadwalShift()` | `getJadwalShift(dept)` | `JadwalFunctions.gs` | `JADWAL_SHIFT`, `KARYAWAN` | - | daftar jadwal aktif |
| Simpan jadwal shift | `saveJadwalEntry()` | `saveJadwalShift(nik, shift, mulai, selesai)` | `JadwalFunctions.gs` | `KARYAWAN`, `JADWAL_SHIFT` | `JADWAL_SHIFT` | upsert by NIK+shift |
| Hapus jadwal shift | `deleteJadwalEntry(rowIndex)` | `deleteJadwalShift(rowIndex)` | `JadwalFunctions.gs` | - | `JADWAL_SHIFT` | hapus baris |
| Routing legacy | frontend legacy modul | `getModuleUrls()` | `SharedLib.gs` | `CONFIG_MODUL` | - | URL modul cadangan |

## Google Sheet Dependency Map

| Sheet | Fungsi utama | Dipakai oleh |
|---|---|---|
| `KARYAWAN` | master identitas, role, password, dept, jabatan, type | auth, search, gate, area, report enrichment, dashboard, jadwal lookup |
| `REGISTRASI SAAT MASUK PABRIK` | log masuk pabrik | `bindKartu()` |
| `REGISTRASI SAAT KELUAR PABRIK` | log keluar pabrik | `releaseKartu()` |
| `REGISTRASI MASUK KELUAR AREA KERJA` | log area IN/OUT | `scanAreaKerja()`, `getRecentAreaLogs()`, `getDashboardData()`, `getAreaActivityReport()` |
| `BINDING_KARTU_MK` | status binding kartu eksternal | `getBindingStatus()`, `bindKartu()`, `releaseKartu()` |
| `ABSEN IN OUT MK` | recap harian masuk/keluar | `getFactoryRecapStatus()`, `bindKartu()`, `releaseKartu()`, `getAbsenReport()`, `getDashboardData()`, `getKehadiranDashboard()` |
| `JADWAL_SHIFT` | jadwal shift per karyawan — input expected count untuk coverage % | `getKaryawanExpectedForDate()`, `getJadwalShift()`, `saveJadwalShift()`, `deleteJadwalShift()` |
| `CONFIG_MODUL` | URL modul cadangan | `getModuleUrls()`, deploy update script |

## Visibility Warnings

### 1. Audit Masih Melihat Jalur Legacy

`reports/function_inventory.md` dan `reports/GAS_RUNTIME_AUDIT.md` masih bisa menampilkan call dari:

- `active/MODUL_AREA_KERJA/app.html`
- `active/MODUL_GATE_PABRIK/app.html`
- `active/MODUL_REPORT/app.html`

Itu berguna untuk backward visibility, tetapi flow operasional normal tetap harus dipusatkan ke `active/HOME_PORTAL/`.

### 2. Header Sheet Adalah Dependency Runtime Kritis

Semua akses sheet lewat `getSheet()` dan `ensureHeader()`. Artinya:

- header salah bisa menjatuhkan flow walau fungsi bisnis benar
- perubahan struktur sheet wajib disertai update `SHEET_HEADERS` di `SharedLib.gs`
- `JADWAL_SHIFT` header: `['NIK','NAMA','DEPT','SHIFT','TANGGAL_MULAI','TANGGAL_SELESAI']`

### 3. Locking Menjadi Guard untuk Write Path

Write path utama dibungkus `withDocumentLock()`:

- `bindKartu()` — gate masuk
- `releaseKartu()` — gate keluar
- `scanAreaKerja()` — scan area
- `saveJadwalShift()` — upsert jadwal
- `deleteJadwalShift()` — hapus jadwal

Kalau locking rusak, race condition akan langsung memukul binding, recap, log area, dan data jadwal.

### 4. SHIFT_CONFIG Adalah Contract Bersama

`SHIFT_CONFIG` di `SharedLib.gs` dipakai oleh:
- `getLateMinutes()` — hitung keterlambatan
- `getOvertimeMinutes()` — hitung lembur
- `getKehadiranDashboard()` — summary per shift

Jika jam standar shift berubah, **hanya `SHIFT_CONFIG` yang perlu diubah** — semua fungsi downstream ikut otomatis.

Shift 3 cross-midnight: `effectiveEnd = 6*60 = 360`, dikonversi ke `360 + 1440 = 1800` untuk aritmetika yang benar.

### 5. Login Page Display Contract

- CSS: `#page-login { display: none }` + `#page-login.active { display: flex }`
- JS `setLoginUiMode`: menambah class `active` (tidak set inline style)
- JS `applyRolePermissions`: menghapus class `active` + `style.removeProperty('display')`
- JS `handleLogout`: menghapus class `active` + `style.removeProperty('display')` sebelum `setLoginUiMode`
- Invariant: **inline style pada `#page-login` selalu dibersihkan sebelum transisi** — CSS class yang menjadi single source of truth visibility

### 6. Query Graph GitNexus Perlu Rebuild Setelah Penambahan Fungsi Besar

Setelah penambahan FASE 1-8 + login fix, jalankan re-index:
```
npx gitnexus analyze
```

### 7. CONFIG_MODUL Hanya Ditulis oleh npm run deploy

`setupModuleUrls()` di `SharedLib.gs` sudah dihapus (FASE 37). Fungsi itu adalah satu-satunya jalur yang bisa merusak CONFIG_MODUL dari GAS Editor. Sekarang:

- CONFIG_MODUL ditulis **eksklusif** oleh `npm run deploy` via `scripts/update_config_sheet.py`
- Pre-deploy guard di `push-all.js` mencegah deploy tanpa `deploymentId`
- `npm run verify` tersedia untuk audit lokal kapan saja
- `scripts/verify-config.js` sekarang memvalidasi bahwa `HOME_PORTAL` punya deployment aktif dan child module tanpa binding lokal diperlakukan sebagai warning compatibility

### 8. Bug Fixes Pasca-Blast Radius Analysis (FASE 38)

Dua bug ditemukan dari analisis manual (GitNexus tidak dapat mengindeks `.gs`):

**Bug 1 — typeCounts/deptCounts salah setelah filter (`AreaFunctions.gs`)**
`typeCounts` dan `deptCounts` dibangun sebelum loop filter splice. Setelah fix: kedua map direbuild dari `boundList` yang sudah difilter, sehingga kartu ringkasan dashboard menampilkan jumlah yang benar saat filter aktif.

**Bug 2 — renderShiftCoverage tidak pernah tampil coverage_pct (`app.html`)**
`renderShiftCoverage` di `loadDashboard()` dipanggil dengan data dari `getDashboardData().shiftCoverage` yang tidak punya `coverage_pct`. Setelah fix: `loadKehadiranDashboard()` success handler juga mengupdate panel `#db-shift-coverage` menggunakan `res.summary.byShift` yang punya `coverage_pct` dari JADWAL_SHIFT.

## Snapshot Audit 2026-06-09

> Catatan: angka berikut adalah estimasi berdasarkan inspeksi langsung. Untuk angka pasti, jalankan `python scripts/audit_project.py`.

- Scanned files: ~46 (bertambah dari 44 setelah `JadwalFunctions.gs`)
- GAS backend functions aktif: ~70 (bertambah dari 62: +5 Jadwal, +1 getKehadiranDashboard, +5 shift utils)
- Frontend functions: ~416 (bertambah dari 399: +17 fungsi dashboard kehadiran dan jadwal)
- Frontend `google.script.run` calls: ~65+, unique ~17 (bertambah dari 12: +getKehadiranDashboard, +getJadwalShift, +saveJadwalShift, +deleteJadwalShift, ±getDashboardData signature update)
- Sheet constants: 32 (bertambah dari 30: + `SHEET_JADWAL`)
- Missing runtime functions: 0
- Broken dependencies statis: 0

## Cara Pakai Dokumen Ini

Saat mau mengubah flow:

1. Tentukan neuron yang disentuh: session, gate, area, dashboard kehadiran, jadwal, atau report.
2. Baca tabel `Frontend -> GAS -> Sheet`.
3. Validasi sheet yang dibaca/ditulis.
4. Cocokkan lagi dengan `reports/GAS_RUNTIME_AUDIT.md` jika ada keraguan caller aktif.
5. Jika flow menyentuh write path, audit recap dan header sheet sebelum deploy.
6. Jika mengubah SHIFT_CONFIG, verifikasi `getLateMinutes`, `getOvertimeMinutes`, dan semua kanban downstream.
7. Jika mengubah `applyRolePermissions` atau `setLoginUiMode`, jaga invariant: **CSS class `.active` adalah satu-satunya kontrol visibility login page**.

## Automated Graphify Dependency Map

Berikut adalah *knowledge graph* dan ketergantungan otomatis (dependency map) yang diekstrak secara struktural dan semantik oleh **Graphify** pada pemindaian terakhir:

### 1. Function Call Chains (Mapping Fungsi Internal)
Graphify memetakan pemanggilan fungsi di dalam *source code* secara otomatis. Beberapa rantai eksekusi penting yang ditemukan:
- **Gate Pabrik**: `bindKartu()` & `releaseKartu()` -> `safeUpdateRecapAbsen()` -> `updateRecapAbsen()`. Kedua fungsi gate tersebut juga memanggil `getBindingStatus()`.
- **Area Kerja**: `scanAreaKerja()` memanggil `getBindingStatus()` untuk mengecek validitas sebelum memproses log.
- **Report**: `getAbsenReport()` memanggil `toDateKey()` dan `buildAbsenReportCacheKey()`.
- **Python Automation Scripts**: 
  - `main()` di `audit_project.py` mengatur alur kerja utama dengan memanggil fungsi utilitas di `common_audit.py` (`scan_project()`, `names()`, `ensure_reports_dir()`).
  - Skrip `update_config_sheet.py` memiliki hierarki *retry* token otomatis: `request_json_with_retry()` memanggil `load_access_token()` yang jika perlu memanggil `refresh_access_token()` dan berinteraksi dengan konfigurasi *clasprc*.

### 2. Hierarchy & HTML Includes (Workflow UI)
Sistem UI memiliki alur kebergantungan modular lintas komponen:
- `app.html` dari `HOME_PORTAL` di-inject ke `Index.html`, yang mana `Index.html` tersebut bergantung pada `style.html`.
- Pola yang identik direplikasi di modul cadangan (`MODUL_AREA_KERJA`, `MODUL_GATE_PABRIK`, `MODUL_REPORT`), di mana `app.html` memanggil backend GAS dan menggunakan komponen `style.html`.

### 3. Data & IO Dependencies (Inferred & Structural)
- **Conceptual Data Sharing**: Graphify (lewat model LLM) mendeteksi bahwa berkas referensi `EMPLOYEE DATA` membagikan konteks struktur datanya dengan `GAS_ARCHITECTURE.md`.
- **Backend Coupling**: `app.html` di berbagai *fallback modules* tertaut secara logis dengan dokumentasi *Google Apps Script Backend* di `README.md`.
- File manifest `appsscript.json` setiap modul mendefinisikan *dependency* secara terstruktur seperti `timeZone`, `executionApi`, `webapp`, dan `exceptionLogging`.

### 4. Communities
Graphify mengelompokkan keseluruhan sistem ke dalam 21 komunitas logis. Misalnya:
- **Community 3**: Klaster khusus pengelolaan status masuk/keluar yang berisi fungsi gate: `bindKartu()`, `getBindingStatus()`, `releaseKartu()`, `safeUpdateRecapAbsen()`, `scanAreaKerja()`, dan `updateRecapAbsen()`.
- **Community 12**: Klaster report absensi yang memuat `buildAbsenReportCacheKey()`, `getAbsenReport()`, `toDateKey()`.
- **Community 13**: Klaster Python untuk autodeploy watcher yang mengelompokkan fungsi `build_snapshot()`, `find_changed_paths()`, `iter_watched_files()`, `run_deploy()`.
