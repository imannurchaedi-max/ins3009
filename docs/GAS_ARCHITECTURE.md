# GAS Architecture

## Ringkasan

Project ini adalah web app Google Apps Script untuk access control dan absensi karyawan berbasis kartu MK. Arsitekturnya terdiri dari backend GAS di `Code.gs`, UI shell di `Index.html`, logic frontend di `app.html`, styling di `style.html`, dan Google Sheets sebagai storage operasional.

## Komponen Utama

- `Code.gs`
  Menangani rendering web app, validasi sheet, lookup karyawan, binding kartu, log masuk/keluar, log area kerja, recap absen, dashboard, dan report.
- `Index.html`
  Menyusun struktur halaman login, tab aplikasi, card laporan, dan include file `style` + `app`.
- `app.html`
  Menyimpan state frontend, event binding, proses scan/manual input, render hasil, dashboard, dan call `google.script.run`.
- `style.html`
  Berisi seluruh CSS tampilan mobile-first untuk login, tab, result card, report list, dan komponen scanner.
- `scripts/*.py`
  Tool audit statis untuk memetakan fungsi, caller frontend, dan dependensi sheet.

## Workflow Aplikasi

1. User membuka web app hasil deploy `doGet()`.
2. `Index.html` memuat `style.html` dan `app.html`.
3. User login lewat `handleLoginSubmit()`.
4. Frontend memanggil `verifyLogin()` di GAS.
5. Jika berhasil, role menentukan tab yang terlihat melalui `applyRolePermissions()`.
6. Tab `MASUK` memproses kartu melalui `bindKartu()`.
7. Tab `KELUAR` memproses release melalui `getBindingStatus()` lalu `releaseKartu()`.
8. Tab `SCAN AREA` mencatat pergerakan area melalui `scanAreaKerja()`.
9. Tab `DASHBOARD` membaca ringkasan melalui `getDashboardData()` dan `getRecentAreaLogs()`.
10. Tab `CEK ABSEN` dan `CEK AREA` membaca report dari sheet recap dan log area.

## Google Sheet yang Dipakai

- `KARYAWAN`
  Master identitas dan role user.
- `REGISTRASI SAAT MASUK PABRIK`
  Log saat kartu di-bind untuk masuk pabrik.
- `REGISTRASI SAAT KELUAR PABRIK`
  Log saat kartu di-release untuk keluar pabrik.
- `REGISTRASI MASUK KELUAR AREA KERJA`
  Log toggle `IN` dan `OUT` area kerja.
- `BINDING_KARTU_MK`
  Status kartu aktif `BOUND` atau `FREE`.
- `ABSEN IN OUT MK`
  Recap harian hasil gabungan log masuk dan keluar.

## Fungsi Backend `Code.gs`

### Entry point dan include

- `doGet`
  Render web app `Index`.
- `onOpen`
  Menambahkan menu spreadsheet untuk regenerate recap.
- `include`
  Mengambil isi file HTML partial.

### Utilitas umum

- `asText`
  Konversi aman ke string.
- `normalizeHeader`
  Menyamakan format header untuk validasi sheet.
- `normalizeCard`
  Menyamakan format nomor kartu.
- `getSpreadsheet`
  Membuka spreadsheet sumber.
- `ensureHeader`
  Memastikan header wajib ada dan urutannya benar.
- `ensureOptionalHeaders`
  Menambahkan header opsional jika belum ada.
- `getHeaderIndex`
  Mencari posisi kolom berdasarkan nama header.
- `getSheet`
  Mengambil atau membuat sheet lalu memvalidasi header.
- `nowWIB`
  Mengambil waktu saat ini.
- `formatDate`
  Format tanggal `dd/MM/yyyy`.
- `formatTime`
  Format jam `HH:mm:ss`.
- `formatDateTime`
  Format tanggal dan waktu lengkap.
- `parseIsoDate`
  Parse input `YYYY-MM-DD`.
- `parseSheetDate`
  Parse nilai tanggal dari sheet.
- `formatDateForSort`
  Membuat key sorting berbasis tanggal.
- `getPeriodRange`
  Menghitung awal dan akhir periode `date`, `week`, atau `month`.
- `isDateInRange`
  Mengecek apakah tanggal berada dalam range.
- `detectShift`
  Menentukan shift berdasarkan jam.
- `withDocumentLock`
  Mencegah race condition pada operasi tulis.
- `assertCard`
  Validasi nomor kartu tidak kosong.

### Data karyawan dan autentikasi

- `getKaryawanMapByNIK`
  Membuat map master karyawan berdasarkan NIK.
- `verifyLogin`
  Login user dan mengembalikan data role serta identitas.
- `searchKaryawan`
  Pencarian karyawan berdasarkan NIK atau nama.
- `getKaryawanByNIK`
  Lookup satu karyawan berdasarkan NIK.

### Recap absen

- `getRecapStatus`
  Menentukan status recap dari kombinasi jam masuk/keluar.
- `makeRecapKey`
  Membuat key unik `tanggal|nik`.
- `updateRecapAbsen`
  Insert atau update recap harian.
- `safeUpdateRecapAbsen`
  Wrapper aman untuk update recap.
- `rebuildRecapAbsenInOutMK`
  Bangun ulang recap dari log historis.
- `syncRecapAbsenInOutMK`
  Alias ke rebuild recap.
- `getAbsenReport`
  Membaca report recap absen per NIK dan periode.

### Binding dan area kerja

- `getBindingStatus`
  Cek status kartu dan siapa pemilik binding aktif.
- `bindKartu`
  Ikat kartu ke karyawan, catat log masuk, update recap.
- `releaseKartu`
  Lepas kartu dari karyawan, catat log keluar, update recap.
- `scanAreaKerja`
  Toggle `IN` atau `OUT` area kerja berdasarkan log terakhir.
- `getAreaActivityReport`
  Membaca report log area kerja per NIK dan periode.

### Dashboard

- `getDashboardData`
  Menghitung jumlah kartu yang masih terikat dan jumlah log area hari ini.
- `getRecentAreaLogs`
  Mengambil log area terbaru untuk monitor security.

## Fungsi Frontend `app.html`

### Auth dan navigasi

- `applyRolePermissions`
  Menampilkan tab sesuai role user.
- `handleLoginSubmit`
  Mengirim login ke backend.
- `switchTab`
  Pindah halaman/tab aktif dan refresh data terkait.

### Search dan pemilihan karyawan

- `debounceSearch`
  Menunda request search.
- `doSearch`
  Memanggil `searchKaryawan`.
- `renderList`
  Render hasil autocomplete.
- `closeList`
  Menutup list autocomplete.
- `selectKaryawan`
  Menyimpan karyawan terpilih ke state frontend.

### Proses scan dan serial

- `submitSerial`
  Validasi input serial manual.
- `onSerialScanned`
  Entry point setelah serial terbaca.
- `normalizeSerial`
  Normalisasi serial di frontend.
- `isValidSerial`
  Validasi format serial.
- `resetSerialInput`
  Reset serial untuk satu context.
- `resetAllSerialInputs`
  Reset serial untuk semua context.

### Flow masuk

- `checkMasukReady`
  Menentukan tombol konfirmasi masuk tampil atau tidak.
- `confirmMasuk`
  Menjalankan proses bind kartu.
- `resetMasuk`
  Membersihkan state masuk setelah sukses.

### Flow keluar

- `handleKeluarScan`
  Menampilkan data binding aktif setelah scan.
- `confirmKeluar`
  Menjalankan proses release kartu.

### Flow security

- `handleSecurityScan`
  Menampilkan hasil scan area kerja dan reload log terbaru.

### Dashboard dan log

- `loadDashboard`
  Memuat statistik dan daftar karyawan yang masih di dalam.
- `loadRecentLogs`
  Memuat log area terbaru.

### Report

- `updatePeriodInput`
  Menyesuaikan tipe input periode.
- `getDefaultPeriodValue`
  Mengisi default periode saat ini.
- `getIsoWeekValue`
  Menghitung minggu ISO.
- `processAbsenReport`
  Menjalankan query report absen.
- `renderAbsenReport`
  Menampilkan hasil report absen.
- `exportAbsenReport`
  Export report absen ke CSV.
- `csvCell`
  Escape nilai CSV.
- `downloadTextFile`
  Download file hasil export.
- `processAreaReport`
  Menjalankan query report area.
- `renderAreaReport`
  Menampilkan hasil report area.

### Helper UI

- `showResult`
  Menampilkan hasil proses per context.
- `escHtml`
  Escape HTML sederhana.
- `getErrorMessage`
  Menormalkan pesan error.
- `handleGasFailure`
  Menangani error `google.script.run`.
- `setActionBusy`
  Menandai tombol sibuk atau idle.

### Kamera dan scanner

- `batchQRDom`
  Membungkus update DOM scanner.
- `setQRDiagnostic`
  Menampilkan diagnostik scanner.
- `waitForVisibleScanner`
  Menunggu viewport scanner siap.
- `getScannerFormats`
  Daftar format scanner fallback.
- `getNativeBarcodeFormats`
  Daftar format scanner native.
- `getCameraPermissionState`
  Membaca status permission kamera jika didukung browser.
- `getCameraPolicyState`
  Membaca status permission policy kamera.
- `isTopWindow`
  Cek apakah aplikasi berjalan di window teratas.
- `buildCameraDiagnostic`
  Menyusun pesan diagnosa kamera.
- `normalizeCameraError`
  Mengubah error teknis menjadi pesan user-facing.
- `requestNativeCameraStream`
  Meminta stream kamera native.
- `startNativeCameraScanner`
  Inisialisasi scanner native.
- `showScanToast`
  Toast singkat setelah scan.
- `indicateScanSuccess`
  Feedback sukses scan.
- `stopQRScanner`
  Placeholder stop scanner aktif.
- `processQRImage`
  Membaca barcode/QR dari file kamera.
- `bindUiEvents`
  Mengikat semua event listener UI.

## Catatan Runtime Penting

- Semua write utama dibungkus `withDocumentLock()` untuk mencegah bentrok scan paralel.
- Header sheet wajib dijaga sinkron dengan `SHEET_HEADERS`.
- `ABSEN IN OUT MK` adalah recap turunan, bukan sumber data primer.
- Flow scanner yang paling jelas aktif saat ini adalah `capture=environment` + `processQRImage()`.
- Ada beberapa fungsi autocomplete/search yang masih tersedia di frontend walau UI aktif sekarang lebih mengandalkan login lalu auto-fill user.
