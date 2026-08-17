# Function Mapping — Quick Reference Index

Daftar lengkap semua fungsi backend (GAS) dan frontend di project EMPLOYEE TRACKER. Gunakan sebagai index pencarian cepat saat ingin menemukan atau memperbaiki fungsi tertentu.

**Acuan**: `reports/gas_runtime_comparison.json` (217 GAS functions, 383 frontend functions, 20 unique frontend GAS calls, 10 sheet constants) · Audit terakhir: 2026-08-17

---

## Backend Functions (GAS) — HOME_PORTAL

### Code.js — Shell Entry
| Function | Line | Description |
|---|---|---|
| `doGet()` | 12 | Entry point web app. Render Index.html |
| `onOpen()` | 20 | Trigger pas spreadsheet dibuka (legacy) |
| `searchKaryawan(query)` | 34 | Wrapper search karyawan dengan validasi query length |

### GateFunctions.gs — Gate Pabrik (Masuk/Keluar)
| Function | Line | Description |
|---|---|---|
| `updateRecapAbsen(dateKey, nik, ...)` | 9 | Update recap absen harian |
| `safeUpdateRecapAbsen(bindCtx)` | 16 | Wrapper aman untuk update recap; dipanggil di luar card lock |
| `rebuildRecapAbsenInOutMKNow_()` | 24 | Rebuild historical recap dataset (dengan global lock) |
| `rebuildRecapAbsenInOutMK()` | 44 | Trigger rebuild via progress dialog |
| `getBindingStatus(noKartuMK)` | 53 | Cek status binding kartu (FREE/BOUND) — tanpa lock |
| `bindKartu(noKartuMK, nik, loker)` | 84 | Proses masuk pabrik + binding kartu. Baca di luar lock, tulis di dalam `withCardLock` |
| `releaseKartu(noKartuMK, loker)` | 183 | Proses keluar pabrik + release kartu. Baca di luar lock, tulis di dalam `withCardLock` |

### AreaFunctions.gs — Area Kerja & Dashboard
| Function | Line | Description |
|---|---|---|
| `scanAreaKerja(serial, area, reason, forceMode)` | 9 | Scan IN/OUT area kerja |
| `getDashboardData(basis, basisValue, deptFilter, typeFilter)` | 68 | Dashboard operasional: populasi area, kanban, shift coverage |
| `parseTimeParts(value)` | inline | Helper internal parser waktu untuk dashboard |
| `toDisplayTime(value)` | inline | Helper internal formatter jam dashboard |
| `buildDateTimeKey(date, timeStr)` | inline | Helper internal key sortir dashboard |
| `isDateWithinRange(d, start, end)` | inline | Helper internal range filter dashboard |
| `getCurrentShiftLabel()` | inline | Helper internal label shift aktif |
| `getIsoWeekCode(date)` | inline | Helper internal kode ISO week |
| `isTimeInShift(d, shift)` | inline | Helper internal filter shift dashboard |
| `buildBasisConfig(basis, basisValue)` | inline | Helper internal konfigurasi basis waktu |
| `getRecentAreaLogs()` | 461 | Ambil 20 log area terbaru |
| `getKehadiranDashboard(tanggal, shiftFilter, deptFilter, typeFilter)` | ~FASE35 | Dashboard kehadiran/keterlambatan/lembur |

### AndroidDiagnostics.gs — Android Gateway Warmup & Telemetry
| Function | Line | Description |
|---|---|---|
| `pingAndroidGateway(payload)` | 53 | Warmup jalur Android ke GAS tanpa mutasi |
| `logAndroidDiagnostics(payload)` | 65 | Simpan batch diagnostik Android ke sheet audit |

### ReportFunctions.gs — Report & Export
| Function | Line | Description |
|---|---|---|
| `toDateKey(date)` | 9 | Konversi Date ke YYYYMMDD |
| `buildAbsenReportCacheKey(nik, dept, periodType, periodValue)` | 21 | Key untuk cache report absen |
| `getAbsenReport(nik, deptFilter, periodType, periodValue)` | 26 | Generate report absen |
| `getAreaActivityReport(nik, deptFilter, periodType, periodValue)` | 83 | Generate report aktivitas area |

### JadwalFunctions.gs — Jadwal Shift CRUD
| Function | Line | Description |
|---|---|---|
| `saveJadwalShift(nik, shift, tanggalMulai, tanggalSelesai)` | - | Simpan/update jadwal shift (upsert by NIK+shift) |
| `deleteJadwalShift(rowIndex)` | - | Hapus jadwal shift by row index |
| `getJadwalShift(deptFilter)` | - | Ambil daftar jadwal shift (opsional filter dept) |
| `bulkSaveJadwalShift(items)` | - | Bulk import jadwal shift |
| `getKaryawanExpectedForDate(tanggal)` | - | Hitung expected count per shift untuk tanggal (internal) |

### SharedLib.gs — Shared Utilities & Constants
| Function | Line | Description |
|---|---|---|
| `asText(value)` | 34 | Safe convert to string |
| `escHtml(value)` | 44 | Escape HTML entities |
| `normalizeHeader(header)` | 53 | Normalisasi string header |
| `normalizeCard(card)` | 62 | Normalisasi nomor kartu |
| `getSpreadsheet()` | 73 | Buka spreadsheet by ID |
| `ensureHeader(sheet, name)` | 81 | Validasi/pasang header sheet |
| `ensureOptionalHeaders(sheet, name)` | 121 | Tambah kolom opsional jika kosong |
| `getHeaderIndex(sheet, headerName)` | 136 | Cari indeks kolom |
| `getSheet(name)` | 142 | Buka sheet + enforce header |
| `nowWIB()` | 160 | Timestamp WIB saat ini |
| `formatDate(d)` | 164 | Format YYYY-MM-DD |
| `formatTime(d)` | 174 | Format HH:mm:ss |
| `formatDateTime(d)` | 184 | Format YYYY-MM-DD HH:mm:ss |
| `parseIsoDate(str)` | 194 | Parse ISO date string |
| `parseSheetDate(v)` | 205 | Parse date value dari sheet |
| `formatDateForSort(date, sheetDate)` | 231 | Format date untuk sortir |
| `getPeriodRange(periodType, periodValue)` | 241 | Hitung range tanggal untuk filter periode |
| `isDateInRange(date, startStr, endStr)` | 280 | Cek apakah date dalam range string |
| `detectShift(date, eventType)` | 290 | Deteksi shift berdasarkan waktu (1/2/3); jam 00:00–07:59 pada event keluar diprioritaskan Shift 3 |
| `timeStrToMinutes(ts)` | ~300 | Konversi HH:mm ke menit dari 00:00 |
| `withDocumentLock(fn)` | 955 | Global lock wrapper; retry 3x, wait 30 detik. Hanya untuk operasi berat: repair, rebuild recap, jadwal write |
| `withCardLock(cardNo, fn)` | 980 | Per-kartu lock via PropertiesService. Global lock hanya ~200ms. Kartu berbeda berjalan paralel. Auto-expire 90 detik. Dipakai di gate scan |
| `assertCard(serial)` | 317 | Validasi format kartu |
| `isExternalKaryawan(row)` | 326 | Cek apakah karyawan eksternal |
| `makeKaryawanPayload(row)` | 348 | Bangun payload user untuk session |
| `getAvailableDepts()` | 361 | Ambil daftar departemen unik |
| `getFactoryRecapStatus(nik, dateKey)` | 375 | Cek status recap pabrik |
| `getRecapStatus(row)` | 395 | Parse status dari row recap |
| `makeRecapKey(tanggal, nik)` | 402 | Buat key recap |
| `getKaryawanMapByNIK()` | 408 | Load semua karyawan jadi map by NIK |
| `getKaryawanByNIK(nik)` | 430 | Lookup single karyawan by NIK |
| `searchKaryawan(query)` | 451 | Search karyawan by NIK/nama |
| `requireRole(nik, ...roles)` | 486 | Verifikasi role user |
| `guardAdmin()` | 514 | Guard admin-only access |
| `verifyLogin(nik, password)` | 522 | Verifikasi kredensial login |
| `verifySession(nik)` | 545 | Verifikasi session existing |
| `include(filename)` | 566 | Include HTML template |
| `setupModuleUrls()` | 581 | ⚠️ DELETED (FASE 37) — Konfigurasi URL modul |
| `getModuleUrls()` | 615 | Ambil URL modul cadangan dari CONFIG_MODUL |
| `getLateMinutes(shiftLabel, jamMasuk)` | ~FASE35 | Hitung menit keterlambatan |
| `getLateCategory(minutes)` | ~FASE35 | Kategori keterlambatan (ontime/ringan/sedang/berat) |
| `getOvertimeMinutes(shiftLabel, jamKeluar)` | ~FASE35 | Hitung menit lembur |
| `formatDurationMinutes(minutes)` | ~FASE35 | Format menit ke string durasi |

### Constants (SharedLib.gs)
| Constant | Line | Description |
|---|---|---|
| `SPREADSHEET_ID` | 9 | ID Google Spreadsheet utama |
| `SHEET_KARYAWAN` | 10 | Sheet KARYAWAN |
| `SHEET_MASUK_PABRIK` | 11 | Sheet REGISTRASI SAAT MASUK PABRIK |
| `SHEET_KELUAR_PABRIK` | 12 | Sheet REGISTRASI SAAT KELUAR PABRIK |
| `SHEET_AREA_KERJA` | 13 | Sheet REGISTRASI MASUK KELUAR AREA KERJA |
| `SHEET_BINDING` | 14 | Sheet BINDING_KARTU_MK |
| `SHEET_RECAP_ABSEN` | 15 | Sheet ABSEN IN OUT MK |
| `SHEET_JADWAL` | 16 | Sheet JADWAL_SHIFT |
| `SHEET_HEADERS` | 18 | Definisi header untuk semua sheet |
| `SHIFT_CONFIG` | ~FASE35 | Konfigurasi jam 3 shift |

---

## Backend Functions (GAS) — Child Modules

### MODUL_GATE_PABRIK/Code.js
| Function | Line | Description |
|---|---|---|
| `doGet()` | 12 | Entry point modul gate |
| `updateRecapAbsen()` | 36 | Recap absen (duplikat) |
| `safeUpdateRecapAbsen()` | 80 | Wrapper recap safe (duplikat) |
| `getBindingStatus()` | 91 | Cek binding (duplikat) |
| `bindKartu()` | 140 | Masuk pabrik (duplikat) |
| `releaseKartu()` | 244 | Keluar pabrik (duplikat) |
| `scanAreaKerja()` | 323 | Scan area (duplikat) |
| `getDashboardData()` | 393 | Dashboard (duplikat) |
| `getRecentAreaLogs()` | 428 | Recent logs (duplikat) |

### MODUL_AREA_KERJA/Code.js
| Function | Line | Description |
|---|---|---|
| `doGet()` | 12 | Entry point modul area |
| `getBindingStatus()` | 36 | Cek binding (duplikat) |
| `scanAreaKerja()` | 72 | Scan area (duplikat) |
| `getDashboardData()` | 148 | Dashboard (duplikat) |
| `getRecentAreaLogs()` | 183 | Recent logs (duplikat) |

### MODUL_REPORT/Code.js
| Function | Line | Description |
|---|---|---|
| `doGet()` | 12 | Entry point modul report |
| `toDateKey()` | 36 | Konversi date (duplikat) |
| `buildAbsenReportCacheKey()` | 51 | Cache key (duplikat) |
| `getAbsenReport()` | 61 | Report absen (duplikat) |
| `getAreaActivityReport()` | 142 | Report area (duplikat) |

> **Catatan**: Child modules (MODUL_GATE_PABRIK, MODUL_AREA_KERJA, MODUL_REPORT) berisi duplikat fungsi dari HOME_PORTAL. Source of truth untuk runtime aktif adalah `active/HOME_PORTAL/`. Child modules hanya untuk compatibility deployment dan fallback.

---

## Frontend Functions — HOME_PORTAL/app.html

### Session & Auth
| Function | Line | Description |
|---|---|---|
| `detectClientShiftLabel()` | 49 | Deteksi shift client-side |
| `buildSecurityAreaStorageKey()` | 56 | Build key untuk security area storage |
| `applySecurityAreaUiState()` | 65 | Apply area UI state |
| `syncSecurityAreaShift()` | 86 | Sinkronisasi shift security |
| `saveSecurityAreaShift()` | 95 | Simpan shift security ke localStorage |
| `getIncomingSessionNik()` | 118 | Baca NIK dari URL param (?nik=) |
| `setLoginUiMode(mode)` | 130 | Set tampilan login page |
| `hydrateAuthenticatedUser(user, depts)` | 151 | Isi UI dengan data user terautentikasi |
| `restoreSavedSession()` | 205 | Restore session dari localStorage |
| `refreshSessionCatalog()` | 229 | Refresh katalog session |
| `beginModuleAutoLogin()` | 242 | Auto-login antar modul (legacy) |
| `applyRolePermissions(role, fromLogin)` | 272 | Apply visibilitas tab per role |
| `handleLoginSubmit()` | 360 | Handler submit form login |
| `applyAuthenticatedSession(payload)` | 394 | Apply session yang sudah diverifikasi |
| `buildModuleTokenParams(nik)` | 398 | Build token param antar modul |
| `handleLogout()` | 2589 | Handler logout |

### Navigation & Search
| Function | Line | Description |
|---|---|---|
| `switchTab(tabId)` | 411 | Pindah tab (fully local) |
| `debounceSearch()` | 442 | Debounce input search |
| `doSearch(q, context)` | 448 | Jalankan search karyawan |
| `renderList(results, container)` | 455 | Render hasil search |
| `closeList()` | 478 | Tutup dropdown search |
| `selectKaryawan(nik, nama, ...)` | 483 | Pilih karyawan dari search |
| `submitSerial()` | 521 | Submit serial number manual |
| `isExternalUser()` | 586 | Cek apakah user eksternal |
| `isInternalUser()` | 592 | Cek apakah user internal |

### Gate — Masuk & Keluar
| Function | Line | Description |
|---|---|---|
| `onSerialScanned(context, serial)` | 529 | Handler scan serial (masuk/keluar/security) |
| `updateMasukScannerVisibility()` | 596 | Update visibilitas scanner masuk |
| `checkMasukReady()` | 606 | Validasi kesiapan flow masuk |
| `confirmMasuk()` | 618 | Konfirmasi masuk pabrik |
| `resetMasuk()` | 692 | Reset flow masuk |
| `resetKeluarUi()` | 705 | Reset UI keluar |
| `handleKeluarScan(serial)` | 723 | Handler scan keluar |
| `confirmKeluar()` | 758 | Konfirmasi keluar pabrik |

### Area Kerja
| Function | Line | Description |
|---|---|---|
| `handleSecurityScan(res)` | 796 | Handler hasil scan area |
| `loadRecentLogs()` | 1231 | Load log area terbaru |

### Dashboard
| Function | Line | Description |
|---|---|---|
| `loadDashboard()` | 818 | Load dashboard operasional |
| `renderAreaChart(boundList)` | 892 | Render chart area population |
| `renderAreaDetail(area, people)` | 921 | Render detail per area |
| `renderPopulation(counts, title, ...)` | 959 | Render populasi |
| `renderDeptPopulation()` | 969 | Render populasi per dept |
| `renderDeptDetail()` | 979 | Render detail per dept |
| `selectDashboardArea(areaName)` | 1061 | Klik bar area di dashboard |
| `renderSelectedDeptPanel(dept)` | 1094 | Render panel dept terpilih |
| `selectDashboardDept(dept)` | 1138 | Klik bar dept |
| `setDashboardBasis(basis)` | 1145 | Set basis waktu dashboard |
| `applyDashboardFilter()` | 1150 | Apply filter dashboard |
| `getDashboardBasisValue()` | 1154 | Ambil basis value saat ini |
| `updateDashboardFilterControls()` | 1171 | Update kontrol filter |
| `handleDashboardFilterInput()` | 1193 | Handler input filter |
| `renderDashboardKanban(data)` | 1207 | Render kanban dashboard |
| `switchDashboardSubtab(subtab)` | ~FASE35 | Pindah sub-tab dashboard (Operasional/Kehadiran/Keterlambatan/Lembur) |
| `loadKehadiranDashboard()` | ~FASE35 | Load dashboard kehadiran |
| `updateKehadiranKPI(summary)` | ~FASE35 | Update KPI cards |
| `renderKehadiranKanban(list)` | ~FASE35 | Render kanban kehadiran (4 kolom) |
| `renderKeterlambatanKanban(list)` | ~FASE35 | Render kanban keterlambatan (4 kolom) |
| `renderLemburKanban(list)` | ~FASE35 | Render kanban lembur (3 kolom) |
| `renderShiftCoverage(shiftCoverage)` | ~FASE35 | Render panel shift coverage |

### Report
| Function | Line | Description |
|---|---|---|
| `updatePeriodInput()` | 1263 | Update input berdasarkan tipe periode |
| `getDefaultPeriodValue()` | 1272 | Ambil default value periode |
| `getIsoWeekValue()` | 1283 | Hitung ISO week value |
| `processAbsenReport()` | 1292 | Proses report absen |
| `renderAbsenReport(data, periodType, ...)` | 1330 | Render tabel report absen |
| `exportAbsenReport()` | 1402 | Export CSV report absen |
| `csvCell(val)` | 1435 | Format cell CSV |
| `downloadTextFile(content, filename)` | 1440 | Download file teks (CSV) |
| `processAreaReport()` | 1455 | Proses report area |
| `syncAreaDeptFilterOptions()` | 1481 | Sinkronisasi opsi filter dept |
| `renderAreaReport(data, periodType, ...)` | 1503 | Render tabel report area |

### Jadwal Shift
| Function | Line | Description |
|---|---|---|
| `loadJadwalShift()` | ~FASE35 | Load data jadwal shift |
| `renderJadwalTable(data)` | ~FASE35 | Render tabel jadwal |
| `saveJadwalEntry()` | ~FASE35 | Simpan entry jadwal |
| `deleteJadwalEntry(rowIndex)` | ~FASE35 | Hapus entry jadwal |
| `lookupJadwalNik()` | ~FASE35 | Lookup NIK untuk jadwal |
| `populateDeptFilterOptions()` | ~FASE35 | Populate filter dept |

### Scanner & Camera
| Function | Line | Description |
|---|---|---|
| `normalizeSerial(raw)` | 1625 | Normalisasi serial number |
| `isValidSerial(serial)` | 1629 | Validasi format serial |
| `resetSerialInput(input)` | 1633 | Reset input serial |
| `resetAllSerialInputs()` | 1661 | Reset semua input serial |
| `forceClearSerialInputs()` | 1665 | Force clear semua input |
| `batchQRDom()` | 1675 | Batch update elemen QR |
| `setQRDiagnostic(msg)` | 1685 | Set pesan diagnostik |
| `setRescanVisibility(visible)` | 1692 | Toggle tombol scan ulang |
| `waitForVisibleScanner(el, timeout)` | 1698 | Tunggu elemen scanner visible |
| `getScannerFormats()` | 1713 | Format barcode yang didukung (html5-qrcode) |
| `getNativeBarcodeFormats()` | 1733 | Format barcode native BarcodeDetector |
| `getImageSourceSize(src)` | 1761 | Ambil dimensi gambar |
| `buildProcessedCanvas(img, variants)` | 1768 | Preprocessing gambar (crop, rotate, upscale, grayscale, threshold) |
| `buildBarcodeScanVariants(canvas)` | 1830 | Build varian scan barcode dari canvas |
| `buildOcrVariants(canvas)` | 1849 | Build varian OCR |
| `extractSerialFromText(text)` | 1863 | Ekstrak serial dari teks OCR |
| `loadImageFromFile(file)` | 1887 | Load gambar dari file |
| `ensureTesseract()` | 1903 | Load Tesseract OCR |
| `detectBarcodeFromSource(source)` | 1927 | Deteksi barcode dari image source |
| `detectTextSerialFromSource(source)` | 1952 | Deteksi teks serial dari image source |
| `getCameraPermissionState()` | 1976 | Cek status izin kamera |
| `getCameraPolicyState()` | 1986 | Cek kebijakan kamera (iframe allow) |
| `isTopWindow()` | 2000 | Cek apakah ini top window |
| `buildCameraDiagnostic(err)` | 2008 | Bangun pesan diagnostik kamera |
| `normalizeCameraError(err)` | 2019 | Normalisasi error kamera |
| `requestNativeCameraStream()` | 2078 | Request native camera stream |
| `startNativeCameraScanner()` | 2097 | Start native camera scanner |
| `tick()` | 2132 | Scanner tick loop |
| `showScanToast(msg, type)` | 2166 | Tampilkan toast scan |
| `indicateScanSuccess()` | 2175 | Indikator sukses scan |
| `startHtml5CameraScanner()` | 2183 | Start html5-qrcode scanner |
| `cleanupNativeScanner()` | 2225 | Stop native scanner |
| `prefersDirectCaptureFallback()` | 2244 | Deteksi fallback capture langsung |
| `openDirectCaptureFallback()` | 2250 | Buka capture fallback |
| `syncScanButtonMode()` | 2259 | Sinkron mode tombol scan |
| `ensureFileScanner()` | 2266 | Setup file scanner |
| `showScannerFailure(err, context)` | 2285 | Tampilkan error scanner |

### Utilities & Events
| Function | Line | Description |
|---|---|---|
| `showResult(ok, htmlMsg, ...)` | 1591 | Tampilkan hasil operasi |
| `escHtml(str)` | 1598 | Escape HTML (frontend) |
| `getErrorMessage(err)` | 1602 | Ekstrak pesan error |
| `handleGasFailure(err, context)` | 1606 | Handler gagal GAS call |
| `setActionBusy(el, busy)` | 1610 | Set status busy tombol |
| `bindUiEvents()` | 2446 | Bind semua event listener UI (event delegation) |

---

## Frontend → GAS Call Matrix (HOME_PORTAL only)

| Frontend Function | GAS Function | Line | Context |
|---|---|---|---|
| `restoreSavedSession()` | `verifySession(nik)` | 239, 266 | Session restore (2 calls) |
| `handleLoginSubmit()` | `verifyLogin(nik, pass)` | 391 | Login |
| `doSearch()` | `searchKaryawan(query)` | 452 | Search |
| `onSerialScanned('keluar')` | `getBindingStatus(serial)` | 559 | Cek status kartu |
| `onSerialScanned('security')` | `scanAreaKerja(...)` | 581 | Scan area |
| `confirmMasuk()` | `bindKartu(...)` | 658 | Masuk pabrik |
| `confirmKeluar()` | `releaseKartu(...)` | 679, 792 | Keluar pabrik (2 calls) |
| `loadRecentLogs()` | `getRecentAreaLogs()` | 1259 | Log area |
| `processAbsenReport()` | `getAbsenReport(...)` | 1327 | Report absen |
| `processAreaReport()` | `getAreaActivityReport(...)` | 1478 | Report area |
| `loadDashboard()` | `getDashboardData(...)` | 818 | Dashboard ops |
| `loadKehadiranDashboard()` | `getKehadiranDashboard(...)` | ~FASE35 | Dashboard kehadiran |
| `loadJadwalShift()` | `getJadwalShift(dept)` | ~FASE35 | Load jadwal |
| `saveJadwalEntry()` | `saveJadwalShift(...)` | ~FASE35 | Save jadwal |
| `deleteJadwalEntry()` | `deleteJadwalShift(idx)` | ~FASE35 | Delete jadwal |

---

## HTML Include Structure

| Host | Included File | Line |
|---|---|---|
| `HOME_PORTAL/Index.html` | `style.html` | 13 |
| `HOME_PORTAL/Index.html` | `app.html` | 439 |
| `MODUL_AREA_KERJA/Index.html` | `style.html` | 18 |
| `MODUL_AREA_KERJA/Index.html` | `app.html` | 440 |
| `MODUL_GATE_PABRIK/Index.html` | `style.html` | 18 |
| `MODUL_GATE_PABRIK/Index.html` | `app.html` | 448 |
| `MODUL_REPORT/Index.html` | `style.html` | 18 |
| `MODUL_REPORT/Index.html` | `app.html` | 414 |

---

## Graphify Communities (Historical / Local Regeneration)

| Community | Coverage | Key Nodes |
|---|---|---|
| C0 — Audit tools | 18 nodes | `scan_project()`, `main()`, `extract_google_script_run_calls()` |
| C1 — Deploy pipeline | 22 nodes | `fallback_update_via_temp_deploy()`, `load_access_token()`, `update_sheet()` |
| C2 — Documentation & Data | 13 nodes | `GAS Architecture`, `EMPLOYEE DATA`, `Deployment Guide` |
| C3 — Gate Pabrik cluster | 6 nodes | `bindKartu()`, `releaseKartu()`, `getBindingStatus()`, `scanAreaKerja()` |
| C4 — npm scripts | 10 nodes | `deploy`, `push`, `verify`, `watch:deploy` |
| C5 — HTML/UI templates | 10 nodes | `HOME_PORTAL app.html/Index.html/style.html`, child module templates |
| C6-10 — appsscript.json configs | 4x7 nodes | Module manifest: `timeZone`, `webapp`, `executionApi` |
| C12 — Report cluster | 3 nodes | `buildAbsenReportCacheKey()`, `getAbsenReport()`, `toDateKey()` |
| C13 — Auto-deploy watcher | 5 nodes | `build_snapshot()`, `find_changed_paths()`, `run_deploy()` |
| C14 — Code.js entry | 4 nodes | `doGet()`, `onOpen()`, `searchKaryawan()` |

---

## Cara Menggunakan Dokumen Ini

1. **Cari fungsi backend**: Gunakan daftar "Backend Functions" untuk menemukan lokasi file dan line.
2. **Cari fungsi frontend**: Gunakan daftar "Frontend Functions" untuk menemukan handler UI.
3. **Trace call chain**: Gunakan "Frontend → GAS Call Matrix" untuk melihat koneksi frontend-backend.
4. **Cek dependensi**: Buka `BLAST_RADIUS.md` untuk analisis dampak sebelum mengedit fungsi.
5. **Pahami workflow**: Buka `NEURAL_MAPPING.md` untuk flow eksekusi lengkap per domain.

---

**Last updated**: 2026-08-17  
**Data source**: `reports/gas_runtime_comparison.json`, `reports/function_inventory.md`, `docs/NEURAL_MAPPING.md`, hasil GitNexus, dan Graphify lokal bila diregenerate
