# Rekam Jejak Proyek & Post-Mortem

Dokumen ini mencatat evolusi sistem dari fase awal sampai runtime aktif terbaru, termasuk bug penting, akar masalah, dan keputusan arsitektur yang dipakai untuk menstabilkan aplikasi.

Dokumen ini adalah arsip historis. Untuk arsitektur aktif dan peta runtime saat ini, gunakan:

- `docs/GAS_ARCHITECTURE.md`
- `docs/NEURAL_MAPPING.md`
- `docs/DEPLOYMENT_GUIDE.md`

---

## FASE 1: Restrukturisasi Frontend

**Kondisi awal**
Seluruh HTML, CSS, dan JavaScript frontend menumpuk di satu file besar.

**Masalah**
- Sulit ditelusuri saat bug muncul.
- Risiko edit satu titik merusak area lain sangat tinggi.

**Solusi**
- Memecah runtime menjadi:
  - `Index.html`
  - `style.html`
  - `app.html`

## FASE 2: Modernisasi UI

**Kondisi awal**
UI terasa kaku dan feedback proses minim.

**Solusi**
- Adopsi layout dan styling yang lebih modern.
- Menambah pulse loading, skeleton loader, dan feedback hasil proses.

## FASE 3: Stabilitas Mobile Navigation

**Kondisi awal**
Menu hamburger sempat hilang di mobile.

**Akar masalah**
- Inline style pada tombol hamburger mengalahkan media query.

**Solusi**
- Membersihkan inline style dan merapikan alur tampil halaman awal.

## FASE 4: Stabilitas Handler Login

**Kondisi awal**
Saat transisi animasi login, tombol bisa macet atau request backend putus.

**Akar masalah**
- Blok handler sukses/gagal sempat rusak karena edit sintaks yang tidak aman.

**Solusi**
- Menulis ulang alur `withSuccessHandler` dan `withFailureHandler`.
- Memastikan state busy dilepas di semua cabang.

## FASE 5: Role Routing dan Privasi Data

**Kondisi awal**
Semua user melihat flow seragam, termasuk akses yang tidak relevan.

**Solusi**
- Menambah `applyRolePermissions()`.
- Menentukan default tab berdasarkan role.
- Membatasi report sesuai departemen untuk role tertentu.

## FASE 6: Report Lebih Padat dan Relevan

**Kondisi awal**
Report terlalu berbasis card dan kurang cocok untuk baca banyak data.

**Solusi**
- Memadatkan layout report.
- Menambah kolom operasional penting seperti nomor kartu dan loker.

## FASE 7: Dependensi Binding Kartu Dijelaskan Ulang

**Kondisi awal**
Kartu bisa terlihat "tidak dikenal" walau user merasa sudah pernah masuk.

**Akar masalah**
- Sheet `BINDING_KARTU_MK` dibersihkan manual, tetapi log historis masih ada.

**Solusi**
- Menegaskan bahwa kartu aktif hanya dianggap valid jika status binding masih `BOUND`.

## FASE 8: Override Operasional untuk Security

**Kondisi awal**
Mode auto-toggle area kerja tidak cukup untuk kondisi lapangan.

**Solusi**
- Menambah mode paksa `AUTO`, `IN`, dan `OUT`.
- Mengurangi ketergantungan pada asumsi status terakhir.

## FASE 9: Rekap Area di Sisi Klien

**Kondisi awal**
Pengawas kesulitan melihat pola frekuensi IN/OUT dari log mentah.

**Solusi**
- Memindahkan sebagian pengelompokan dan rekap ringan ke frontend.

## FASE 10: Arsitektur Multi-Modul

**Kondisi awal**
Aplikasi masih monolit dan tiap perubahan memengaruhi seluruh permukaan.

**Solusi**
- Memecah runtime menjadi:
  - `HOME_PORTAL`
  - `MODUL_GATE_PABRIK`
  - `MODUL_AREA_KERJA`
  - `MODUL_REPORT`
- Menggunakan `CONFIG_MODUL` sebagai registry URL aktif.

## FASE 11: Live Camera dan Fallback

**Kondisi awal**
Scanner live sempat terganggu oleh keterbatasan iframe GAS di beberapa browser mobile.

**Solusi**
- Menambah fallback kamera native dan jalur pembacaan gambar.

## FASE 12: Force Release

**Kondisi awal**
Kartu bisa tertahan dalam state aktif jika user lupa scan keluar.

**Solusi**
- Menambah flow pembersihan status untuk security tanpa perlu edit sheet manual.

## FASE 13: Sinkronisasi Auth Antar Modul

**Tanggal**
2026-06-03 sampai 2026-06-04

**Kondisi awal**
User mitra atau external bisa login di `HOME_PORTAL`, masuk ke modul gate, lalu dilempar balik ke login atau membuka terlalu banyak tahap.

**Akar masalah**
- Bootstrap session antar modul tidak konsisten.
- Perpindahan dari `HOME_PORTAL` ke modul lain masih menyisakan perilaku tab baru dan relogin tidak mulus.

**Solusi**
- Menyamakan flow auth lintas `HOME_PORTAL`, `MODUL_GATE_PABRIK`, `MODUL_AREA_KERJA`, dan `MODUL_REPORT`.
- Menormalkan bootstrap `?nik=...`.
- Membersihkan UI gate dari karakter rusak pada string user-facing.

## FASE 14: Hardening Internal/External dan Recap Header

**Tanggal**
2026-06-04

**Kondisi awal**
- Flow external bisa kehilangan scanner karena klasifikasi user tidak konsisten.
- Sheet `ABSEN IN OUT MK` bisa gagal dibaca jika header kolom baru masih kosong.

**Akar masalah**
- Sumber penentu `internal/external` tersebar dan tidak seragam.
- Validasi header recap terlalu ketat terhadap sheet lama yang belum punya header lengkap.

**Solusi**
- Menegaskan tipe karyawan sebagai sinyal klasifikasi utama untuk flow internal vs external.
- Menambah auto-heal header recap agar `NO KARTU MK` dan `NO LOKER` diisi otomatis jika kosong.

## FASE 15: Canonical Source Berpindah ke `active/`

**Tanggal**
2026-06-04

**Kondisi awal**
Dokumentasi dan sebagian asumsi repo masih menganggap file root sebagai source utama.

**Akar masalah**
- Evolusi runtime ke multi-modul aktif tidak diikuti pembaruan dokumentasi secara penuh.

**Solusi**
- Menetapkan `active/` sebagai source of truth untuk audit, deploy, dan maintenance.
- Menyinkronkan `README`, arsitektur, panduan deploy, dan catatan hardening dengan struktur repo aktif.

---

## Status Saat Ini

- Runtime aktif berbasis `active/`.
- Auth lintas modul lebih konsisten.
- Flow `MASUK`, `KELUAR`, `SCAN AREA`, dan `REPORT` sudah dipisah per modul.
- `CONFIG_MODUL` tetap menjadi pusat registry URL deploy aktif.
- Tool audit Python dipakai sebagai baseline pengecekan dependency sebelum deploy.

## FASE 16: Pengurangan Noise Repo dan Jalur Baca Kanonik

**Tanggal**
2026-06-04

**Kondisi awal**
Repo masih memuat terlalu banyak artifact audit lama, wrapper tooling yang duplikatif, dan helper eksperimen yang tidak lagi dipakai operasional.

**Risiko**
- Agent atau developer baru mudah membaca dokumen atau report yang salah.
- Audit lama bisa terlihat seperti sumber kebenaran walau sudah tidak relevan.
- Tooling pendukung terasa lebih banyak dari yang benar-benar dibutuhkan.

**Solusi**
- Menyisakan hanya script audit dan deploy yang benar-benar operasional.
- Menghapus wrapper dan eksperimen yang tidak lagi dipakai.
- Menegaskan `reports/` sebagai generated artifact, bukan dokumentasi arsitektur.
- Menambahkan urutan baca kanonik di `README` dan dokumen arsitektur.

## FASE 17: Hardening Scanner Kamera di Modul Gate

**Tanggal**
2026-06-04

**Kondisi awal**
Flow scanner kamera di web app sering gagal di Chrome mobile karena jalur aktif langsung bergantung ke `html5-qrcode`, sementara precheck izin/policy dan jalur native belum benar-benar dipakai.

**Akar masalah**
- `startNativeCameraScanner()` masih stub.
- `openLiveScanner()` melewati helper permission/policy yang sudah ada.
- fallback foto bergantung pada instance scanner live.
- tombol tutup overlay scanner belum benar-benar tertangani di event binding.

**Solusi**
- Mengaktifkan jalur native live scan berbasis `getUserMedia + BarcodeDetector` sebagai prioritas pertama.
- Menjadikan `html5-qrcode` sebagai fallback live scan.
- Membuat fallback foto independen dari instance scanner live.
- Menyambungkan aksi `close-qr` ke `stopQRScanner()`.

## FASE 18: Fallback Kamera Foto Satu Tap untuk Chrome Mobile

**Tanggal**
2026-06-04

**Kondisi awal**
Walau jalur scanner sudah dihardening, web app GAS di Chrome mobile tetap bisa gagal membuka live camera karena sandbox wrapper host tidak mengizinkan fitur kamera di iframe.

**Akar masalah**
- Halaman Apps Script dibungkus iframe host yang tidak membawa izin `camera` pada attribute `allow`.
- Akibatnya `getUserMedia` bisa gagal konsisten walau user membuka URL `/exec` langsung.

**Solusi**
- Menambahkan deteksi device mobile + policy block.
- Mengalihkan tombol scan ke `capture="environment"` secara satu tap pada browser yang memang tidak bisa live scan.
- Tetap mempertahankan jalur native live scan untuk browser yang mendukungnya.

## FASE 19: Hotfix Helper Recap di Modul Gate

**Tanggal**
2026-06-05

**Kondisi awal**
Setelah scan kartu di gate, UI menampilkan error `safeUpdateRecapAbsen is not defined`.

**Akar masalah**
- `MODUL_GATE_PABRIK` memanggil helper recap yang hanya tersedia di runtime root lama.
- Saat project dipecah per modul, helper itu tidak ikut termuat di project gate.

**Solusi**
- Menambahkan helper recap yang diperlukan langsung ke runtime `MODUL_GATE_PABRIK`.
- Redeploy modul gate dan sinkronkan kembali `CONFIG_MODUL`.

## FASE 20: Re-Scan Sebelum Konfirmasi Gate

**Tanggal**
2026-06-05

**Kondisi awal**
User bisa salah scan kartu, sementara flow gate belum memberi jalur koreksi yang jelas sebelum submit.

**Akar masalah**
- `MASUK` external melakukan auto-submit setelah scan.
- `KELUAR` belum punya aksi reset yang eksplisit setelah kartu terbaca.

**Solusi**
- Menonaktifkan auto-submit setelah scan di `MASUK`.
- Menambahkan tombol `SCAN ULANG KARTU` untuk `MASUK` dan `KELUAR`.
- Menjaga state scan tetap bisa dibersihkan tanpa reload halaman.

## FASE 21: Hotfix Helper HTML Escape di Backend Gate

**Tanggal**
2026-06-05

**Kondisi awal**
Saat flow kartu bentrok atau force release dipicu, gate bisa memunculkan error `escHtml is not defined`.

**Akar masalah**
- Backend `MODUL_GATE_PABRIK` membentuk `htmlMsg` dengan helper `escHtml()`.
- Helper itu hanya tersedia di frontend, bukan di runtime GAS backend modul gate.

**Solusi**
- Menambahkan helper `escHtml()` langsung ke backend `MODUL_GATE_PABRIK`.
- Redeploy gate dan sinkronkan ulang `CONFIG_MODUL`.

## FASE 22: Blast Helper Escape Backend

**Tanggal**
2026-06-05

**Kondisi awal**
Error `escHtml is not defined` muncul di gate, dan pola yang sama berpotensi muncul lagi kalau backend modul lain membangun `htmlMsg` tanpa util escape bersama.

**Akar masalah**
- Helper `escHtml()` sebelumnya hidup di frontend dan sempat ditambal lokal di backend gate.
- Runtime aktif belum punya util escape HTML yang konsisten di `SharedLib.gs`.
- Beberapa `htmlMsg` backend masih menyisipkan nilai mentah seperti nomor kartu.

**Solusi**
- Menambahkan `escHtml()` ke seluruh `SharedLib.gs` pada runtime aktif dan submodule aktif.
- Menghapus helper duplikat dari backend gate agar kembali mengandalkan util bersama.
- Menyelaraskan pesan `htmlMsg` backend yang masih memakai nilai mentah menjadi tersanitasi.

## FASE 23: Hardening Scanner Barcode Kartu

**Tanggal**
2026-06-05

**Kondisi awal**
Barcode 1D pada kartu identitas sering gagal terbaca, terutama saat foto miring, barcode kecil, atau kontras cetak rendah.

**Akar masalah**
- Format barcode yang didukung scanner masih sempit.
- Fallback foto hanya mencoba decode gambar mentah tanpa preprocessing.
- Saat barcode gagal, tidak ada fallback untuk membaca NIK/serial yang tercetak di kartu.

**Solusi**
- Memperluas format barcode native dan `html5-qrcode` untuk barcode 1D/2D yang lebih banyak.
- Menambahkan preprocessing gambar berbasis crop, rotasi, upscale, grayscale, dan threshold sebelum decode barcode.
- Menambahkan fallback OCR berbasis `tesseract.js` untuk mengekstrak NIK/serial dari teks kartu bila barcode tetap gagal.

## FASE 24: Kunci Release Binding ke Security

**Tanggal**
2026-06-05

**Kondisi awal**
Karyawan mitra yang masih terikat kartu lama masih bisa melihat jalur release paksa dari flow masuk, sehingga mereka bisa mencoba melepas binding sendiri.

**Akar masalah**
- `bindKartu()` membangun tombol `RELEASE PAKSA` langsung di `htmlMsg` konflik kartu/NIK.
- Frontend gate masih memiliki handler global `forceReleaseOldCard()` yang benar-benar memanggil `releaseKartu(..., 'FORCE_RELEASE')`.

**Solusi**
- Menghapus tombol release paksa dari respons konflik masuk dan menggantinya dengan instruksi datang ke Security dengan kartu fisik.
- Memblokir request `FORCE_RELEASE` di backend `releaseKartu()`.
- Meng-override handler lama di frontend agar semua jalur release mandiri diarahkan ke Security.

## FASE 25: Optimasi Cek Absen

**Tanggal**
2026-06-05

**Kondisi awal**
Fitur `Cek Absen` bisa loading sangat lama pada recap yang sudah besar, dan user hanya melihat skeleton tanpa kepastian progres.

**Akar masalah**
- Backend `getAbsenReport()` membaca seluruh recap dengan `getDataRange()` lalu mem-parse tanggal baris per baris.
- Tidak ada cache singkat untuk request periode yang sama.
- Frontend belum memberi status tambahan saat proses report memang berat.

**Solusi**
- Mengoptimalkan `getAbsenReport()` dengan pembacaan range terukur, filtering tanggal berbasis key string, dan cache singkat.
- Menambahkan status frontend setelah 8 detik agar user tahu data masih diproses, bukan diam menggantung.

## FASE 26: Paksa Jalur Report ke Modul REPORT

**Tanggal**
2026-06-05

**Kondisi awal**
Tab `Cek Absen` masih bisa dibuka sebagai halaman lokal di `HOME_PORTAL`, `GATE_PABRIK`, dan `AREA_KERJA`, padahal backend report aktif berada di modul `REPORT`.

**Akar masalah**
- Struktur shell frontend masih membawa halaman report lokal dari template bersama.
- Logika `switchTab()` memilih mode lokal hanya karena `page-cek-absen` ada di DOM.

**Solusi**
- Mengubah `switchTab()` pada `HOME_PORTAL`, `MODUL_GATE_PABRIK`, dan `MODUL_AREA_KERJA` agar tab report selalu diarahkan ke URL modul `REPORT` lengkap dengan parameter `tab`.
- Mengubah `processAbsenReport()` lokal di modul non-report menjadi redirect ke `MODUL_REPORT` dengan filter NIK/periode yang sudah dipilih user.
- Menambahkan pembaca route parameter di `MODUL_REPORT` agar filter terisi otomatis dan query report bisa langsung jalan setelah user dialihkan.

**Status verifikasi**
- Jalur `Cek Absen` untuk role `KARYAWAN` dinyatakan cukup oleh user setelah routing dipaksa ke `MODUL_REPORT`.
- Tidak ada perubahan lanjutan yang diminta untuk flow `KARYAWAN` pada tahap ini.

## FASE 27: Area Shift untuk Security dan Pengawas

**Tanggal**
2026-06-05

**Kondisi awal**
Petugas `SECURITY` dan `PENGAWAS` belum punya konteks area tetap di awal shift, sehingga scan area kerja belum mengikat log ke area pengawasan tertentu.

**Solusi**
- Menambahkan dropdown `Area yang Diawasi` pada halaman `security` di `MODUL_AREA_KERJA`.
- Area dipilih sekali di awal shift dan disimpan per user-per-shift di browser, lalu otomatis dipakai untuk semua scan berikutnya.
- Role `PENGAWAS` sekarang juga langsung mendarat ke halaman `security` saat masuk modul area kerja.
- Log `REGISTRASI MASUK KELUAR AREA KERJA` kini menulis `TUJUAN` sebagai area pengawasan dan `CATATAN` sebagai alasan scan.
- Report aktivitas area dan log terbaru ikut menampilkan area yang diawasi.

## FASE 28: Konsolidasi True Shell — Single URL Architecture

**Tanggal**
2026-06-06

**Kondisi awal**
HOME_PORTAL berfungsi sebagai redirect shell: setelah login, user langsung dipental ke URL modul lain (GATE_PABRIK, AREA_KERJA, REPORT). Setiap navigasi tab mengubah URL di browser, back button rusak, dan session localStorage tidak konsisten antar modul karena GAS app masing-masing berjalan di context iframe berbeda.

**Akar masalah**
- `switchTab()` di semua modul memanggil `getModuleUrls()` dan melakukan `window.top.location.href` ke URL modul lain.
- `processAbsenReport()` di GATE_PABRIK/AREA_KERJA tidak memanggil `getAbsenReport()` langsung, melainkan redirect ke REPORT URL.
- `HOME_PORTAL/app.html` berisi 133 baris kode lama terpotong di bagian atas file yang menyebabkan `SyntaxError` (deklarasi `const QR`, `const STATE` ganda).
- `getIncomingSessionNik()` bergantung pada template injection server-side `<?= sessionNik ?>` yang bisa gagal akibat browser cache.

**Solusi**
- Semua halaman (`page-masuk`, `page-keluar`, `page-security`, `page-dashboard`, `page-cek-absen`, `page-cek-area`, dst.) dipindah ke `HOME_PORTAL/Index.html`.
- Semua backend functions dari 3 modul dikonsolidasi ke HOME_PORTAL:
  - `GateFunctions.gs` — bindKartu, releaseKartu, getBindingStatus, updateRecapAbsen
  - `AreaFunctions.gs` — scanAreaKerja, getDashboardData, getRecentAreaLogs
  - `ReportFunctions.gs` — getAbsenReport, getAreaActivityReport
- `switchTab()` diubah menjadi fully local — tidak ada GAS call, tidak ada URL change.
- `processAbsenReport()` memanggil `google.script.run.getAbsenReport()` langsung.
- `getIncomingSessionNik()` membaca `?nik=` dari `window.location.search` client-side (tidak bergantung template server).
- `DOMContentLoaded` HOME_PORTAL hanya cek `dam_session` localStorage; tidak ada `beginModuleAutoLogin`.
- Hapus `Functions.gs` lama (digantikan 3 file domain-specific).
- Semua navigasi antar modul menggunakan `location.replace()` (bukan `href`) sehingga back button tidak menumpuk history modul.

**Hasil**
- Satu URL permanen untuk semua user.
- Tab switching instan tanpa page reload.
- Back button berfungsi normal (hanya satu entry di history).
- Session tidak perlu divalidasi ulang saat pindah tab.

---

## FASE 29: Role-Based Redirect Setelah Login

**Tanggal**
2026-06-06

**Kondisi awal**
Setelah login, semua user mendarat di halaman yang sama tanpa mempertimbangkan role.

**Solusi**
- `applyRolePermissions()` diberi parameter `fromLogin` (boolean).
- Saat login baru (`fromLogin = true`): redirect ke default tab per role.
  - KARYAWAN → tab MASUK
  - SECURITY / PENGAWAS → tab SCAN AREA
  - ADMINISTRATOR → tab DASHBOARD
- Saat session restore (`fromLogin = false`): tampil home tiles tanpa redirect.

---

## FASE 30: CEK ABSEN — NIK Opsional untuk Non-Karyawan

**Tanggal**
2026-06-06

**Kondisi awal**
CEK ABSEN selalu memvalidasi NIK wajib diisi, sehingga SECURITY dan ADMINISTRATOR tidak bisa melihat data semua karyawan tanpa mengetik NIK satu per satu.

**Akar masalah**
- Validasi `if (!nik && !deptFilter)` di frontend dan backend tidak mempertimbangkan role.

**Solusi**
- Frontend: NIK hanya wajib untuk role KARYAWAN. SECURITY dan ADMINISTRATOR boleh kosong.
- Backend `ReportFunctions.gs`: hapus validasi wajib nik+deptFilter — jika keduanya kosong, return semua data periode.
- Perilaku per role:
  - KARYAWAN: wajib isi NIK, hanya lihat data sendiri
  - SECURITY / ADMINISTRATOR: NIK opsional, lihat semua
  - PENGAWAS: NIK opsional, auto-filter by dept sendiri

---

## FASE 31: Opsi Periode Hari di CEK ABSEN

**Tanggal**
2026-06-06

**Kondisi awal**
Dropdown periode CEK ABSEN hanya punya pilihan Minggu dan Bulan. Tidak bisa filter per tanggal tertentu.

**Solusi**
- Menambahkan opsi `Hari` (value: `date`) sebagai pilihan pertama di dropdown periode CEK ABSEN.
- Konsisten dengan CEK AREA yang sudah punya opsi Tanggal/Minggu/Bulan.

---

## FASE 32: Dashboard Populasi Area dan Jenis Karyawan

**Tanggal**
2026-06-06

**Kondisi awal**
Dashboard masih terlalu global: hanya menampilkan jumlah orang di dalam pabrik dan scan area hari ini, tetapi belum memberi gambaran cepat populasi karyawan per area kerja dan per jenis karyawan.

**Akar masalah**
- Basis dashboard masih berorientasi daftar binding / list mentah.
- Tidak ada turunan status area terakhir per karyawan untuk menghitung populasi area aktif.
- Komposisi jenis karyawan belum dirangkum menjadi angka operasional.

**Solusi**
- Mengubah basis populasi dashboard ke recap `ABSEN IN OUT MK` dengan status `DI DALAM`.
- Menambahkan ringkasan populasi `per area kerja` dari status scan area terakhir pada hari yang sama.
- Menambahkan ringkasan populasi `per jenis karyawan`.
- Tetap mempertahankan daftar detail karyawan yang sedang berada di dalam pabrik.

---

## FASE 33: Dashboard Operasional yang Lebih Tegas

**Tanggal**
2026-06-06

**Kondisi awal**
Dashboard menampilkan terlalu banyak metrik campuran di bagian atas. Secara visual angkanya benar, tetapi pesan utamanya bias: user sulit menangkap apakah dashboard ini sedang menjelaskan orang di dalam pabrik, scan area, atau komposisi data.

**Akar masalah**
- Kartu utama mencampur `status operasional` dengan `komposisi departemen / jenis`.
- Tidak ada ringkasan satu kalimat yang menjelaskan kondisi lapangan.
- Informasi komposisi berada di level yang sama dengan informasi inti, sehingga fokus user terpecah.

**Solusi**
- Menata ulang kartu utama menjadi 5 metrik operasional: `Sedang Di Dalam`, `Sudah Scan Area`, `Belum Scan Area`, `Area Terisi`, dan `Cakupan Scan Area`.
- Menambahkan panel ringkasan operasional singkat agar dashboard langsung menjawab kondisi lapangan.
- Menurunkan `Jenis Karyawan` dan `Departemen` menjadi section komposisi pendukung, bukan metrik utama.
- Memperjelas judul section area dan kanban agar lebih mudah dibaca user operasional.

---

## FASE 34: Area Dashboard Clickable ke Daftar Nama

**Tanggal**
2026-06-06

**Kondisi awal**
Chart area baru sudah membantu melihat distribusi scan area, tetapi operator masih harus turun ke kanban untuk mencari nama orang dan jam masuk. Informasi area dan daftar orang belum terhubung langsung.

**Akar masalah**
- Bar area hanya menampilkan agregat jumlah orang.
- Detail siapa yang berada di area tersebut belum bisa dibuka langsung dari chart.
- Jam masuk masih tersebar di daftar lain, sehingga alur baca operator terputus.

**Solusi**
- Menjadikan setiap row area di dashboard sebagai elemen clickable.
- Menambahkan panel detail area yang menampilkan daftar nama, NIK, departemen, jenis karyawan, dan jam masuk.
- Menyambungkan detail area langsung dari payload dashboard yang sama agar tidak menambah query server tambahan.

---

## FASE 35: Dashboard Kehadiran, Keterlambatan, dan Lembur + JADWAL_SHIFT

**Tanggal**
2026-06-09

**Kondisi awal**
Dashboard hanya menampilkan data operasional area: populasi, kanban area, dan shift coverage kasar. Tidak ada tracking keterlambatan, lembur, atau status kehadiran per orang. Tidak ada referensi jadwal shift untuk menghitung coverage vs ekspektasi.

**Akar masalah**
- Tidak ada endpoint backend untuk kehadiran, keterlambatan, dan lembur.
- Tidak ada sheet `JADWAL_SHIFT` untuk mencatat ekspektasi per shift.
- Sub-tab dalam dashboard belum ada.

**Solusi (FASE 1–8)**

- **FASE 1 — SharedLib.gs**: Tambah `SHIFT_CONFIG` (jam standar 3 shift dalam menit dari 00:00), utility functions `timeStrToMinutes`, `getLateMinutes`, `getLateCategory`, `getOvertimeMinutes`, `formatDurationMinutes`. Shift standar: Shift 1 (06:01–14:00), Shift 2 (14:01–22:00), Shift 3 (22:01–06:00 cross-midnight).
- **FASE 2 — AreaFunctions.gs**: Tambah `getKehadiranDashboard(tanggal, shiftFilter, deptFilter, typeFilter)` — endpoint baru yang mengembalikan `kehadiranList` + `anomaliList` + `summary`. Setiap baris punya `lateMinutes`, `lateCategory`, `overtimeMinutes`, dan `presenceStatus`. Anomali: `DI_DALAM_TERLALU_LAMA` (>10 jam) dan `KELUAR_TANPA_MASUK`.
- **FASE 3 — Filter dept/type + 3 KPI baru**: Tambah filter `db-dept-filter` dan `db-type-filter` di dashboard. Tambah 3 KPI card: `db-terlambat`, `db-lembur`, `db-anomali`. Update `getDashboardData()` dengan parameter `deptFilter` dan `typeFilter` — populasi dan kanban difilter sesuai pilihan.
- **FASE 4 — Sub-tab system**: Sub-tab bar 4 tombol di dalam halaman DASHBOARD: Operasional (default) / Kehadiran / Keterlambatan / Lembur. Fungsi `switchDashboardSubtab()` dengan lazy load — sub-tab non-Operasional hanya memanggil `loadKehadiranDashboard()` saat pertama kali dibuka.
- **FASE 5 — Kanban Kehadiran**: 4 kolom: Belum Masuk / Di Dalam / Sudah Pulang / Anomali. Card per orang menampilkan nama, dept, shift, jam masuk, badge status. Klik card expand detail.
- **FASE 6 — Kanban Keterlambatan + Lembur**: Keterlambatan 4 kolom: On Time / Ringan (1–14 mnt) / Sedang (15–29 mnt) / Berat (≥30 mnt). Lembur 3 kolom: <1 Jam / 1–2 Jam / >2 Jam. Masing-masing punya summary bar hitungan di atas kanban.
- **FASE 7 — Shift Coverage Panel**: Panel 3-shift side-by-side di sub-tab Operasional menampilkan hadir/terlambat/lembur per shift dari `getDashboardData().shiftCoverage`.
- **FASE 8 — JADWAL_SHIFT + Coverage %**: Sheet baru `JADWAL_SHIFT` (NIK | NAMA | DEPT | SHIFT | TANGGAL_MULAI | TANGGAL_SELESAI, kolom selesai kosong = jadwal permanen). File baru `active/HOME_PORTAL/JadwalFunctions.gs` dengan `saveJadwalShift`, `deleteJadwalShift`, `getJadwalShift`, `bulkSaveJadwalShift`. Fungsi `getKaryawanExpectedForDate(tanggal)` dipanggil dari dalam `getKehadiranDashboard()` untuk hitung expected vs actual per shift. Panel coverage menampilkan progress bar % dengan highlight merah jika coverage < 70%.

**File yang diubah**: `SharedLib.gs`, `AreaFunctions.gs`, `Index.html`, `app.html`, `style.html` (semua di `active/HOME_PORTAL/`).

**File baru**: `active/HOME_PORTAL/JadwalFunctions.gs`.

---

## FASE 36: Login Page CSS dan JS Bug Fix

**Tanggal**
2026-06-09

**Kondisi awal**
Setelah login berhasil, halaman login tidak tersembunyi dengan benar pada beberapa kondisi: tergantung urutan load dan state inline `style` yang kadang tersisa dari `setLoginUiMode`.

**Akar masalah**
- `#page-login` menggunakan `.page { display: none }` sebagai baseline, sehingga CSS class `.active` tidak selalu menang melawan inline style yang tersisa dari siklus sebelumnya.
- `applyRolePermissions()` tidak membersihkan inline `style` sebelum menghapus class `active`, meninggalkan `display: flex` yang menghantui.
- DOM access di beberapa fungsi tidak null-safe — bisa throws jika elemen belum siap.

**Solusi**
- CSS: Tambah rule `#page-login { display: none }` + `#page-login.active { display: flex }` sebagai kontrak CSS mandiri — tidak lagi bergantung pada `.page { display: none }`.
- JS `applyRolePermissions`: Tambah `style.removeProperty('display')` sebelum menghapus class `active` dari `#page-login`.
- JS `handleLogout`: Tambah `style.removeProperty('display')` sebelum memanggil `setLoginUiMode`.
- Seluruh DOM access di fungsi-fungsi terdampak diberi null-safe guard.
- Invariant: CSS class `.active` adalah satu-satunya kontrol visibility login page. Inline style harus selalu bersih saat transisi.

---

## FASE 37: URL Architecture Hardening — Hapus setupModuleUrls, Tambah verify-config.js

**Tanggal**
2026-06-09

**Kondisi awal**
Fungsi `setupModuleUrls()` di `SharedLib.gs` memiliki deployment ID child modules yang sudah kedaluwarsa. Jika dijalankan secara manual dari GAS Editor, fungsi ini akan menimpa `CONFIG_MODUL` dengan URL lama yang salah, memutus routing kompatibilitas.

Tidak ada mekanisme verifikasi bahwa deployment ID di `scripts/module-config.json` konsisten dengan yang aktif, sehingga drift bisa terjadi tanpa terdeteksi.

**Akar masalah**
- `setupModuleUrls()` punya hardcoded deployment ID yang sudah tidak aktif (ID lama GATE, AREA, REPORT).
- Tidak ada guard di `push-all.js` yang mencegah deploy jika ada modul tanpa `deploymentId`.
- Tidak ada tool lokal untuk memverifikasi konfigurasi tanpa API call.

**Solusi**
- **Hapus `setupModuleUrls()` sepenuhnya** dari `SharedLib.gs`. Digantikan komentar yang menegaskan CONFIG_MODUL dikelola eksklusif oleh `npm run deploy`, bukan dari GAS Editor.
- **Pre-deploy guard** di `push-all.js`: deploy dibatalkan jika ada modul tanpa `deploymentId` di `module-config.json`.
- **File baru `scripts/verify-config.js`**: validasi lokal tanpa API call. Memeriksa kelengkapan `module-config.json`, memastikan HOME_PORTAL ID cocok dengan `FROZEN_HOME_ID`, dan memastikan setiap `.clasp.json` tidak punya `deploymentId` hardcoded. Exit 0 = valid, Exit 1 = masalah.
- **Post-deploy verify** di `push-all.js`: setelah semua deploy sukses, `verify-config.js` dijalankan otomatis sebagai audit akhir.
- **`npm run verify`** ditambahkan di `package.json` untuk verifikasi manual kapan saja.
- **`--verify-only` mode** ditambahkan di `update_config_sheet.py` untuk konsistensi antarmuka CLI.

Policy permanen yang ditegakkan: CONFIG_MODUL **tidak pernah ditulis secara manual dari GAS Editor**. Source of truth satu-satunya adalah `scripts/module-config.json`.

---

## FASE 38: Bug Fix — typeCounts Filter Rebuild dan Shift Coverage coverage_pct

**Tanggal**
2026-06-09

**Kondisi awal**
Dua bug ditemukan dari analisis blast radius manual (GitNexus tidak dapat mengindeks file `.gs` atau JavaScript embedded di `.html`):

1. Kartu ringkasan dashboard menampilkan jumlah tipe karyawan yang salah saat filter departemen atau tipe diaktifkan.
2. Panel shift coverage di sub-tab Operasional tidak pernah menampilkan coverage % — kolom tersebut selalu kosong meskipun data `JADWAL_SHIFT` sudah ada.

**Akar masalah**
- **Bug 1 (`getDashboardData`)**: `typeCounts` dan `deptCounts` dibangun dari `boundList` **sebelum** loop filter splice dijalankan. Hasilnya: kartu ringkasan menampilkan jumlah total tanpa filter, bukan jumlah setelah filter.
- **Bug 2 (`loadKehadiranDashboard` / `renderShiftCoverage`)**: `renderShiftCoverage` dipanggil dari `loadDashboard()` dengan `getDashboardData().shiftCoverage` yang tidak punya field `coverage_pct`. Data dengan `coverage_pct` ada di `getKehadiranDashboard().summary.byShift`, tetapi tidak pernah digunakan untuk update panel.

**Solusi**
- **Bug 1 (`AreaFunctions.gs`)**: Setelah loop splice filter selesai, rebuild `typeCounts` dan `deptCounts` dari `boundList` yang sudah difilter. Kedua map dikosongkan dulu lalu diisi ulang dari data terfilter.
- **Bug 2 (`app.html`)**: Di `loadKehadiranDashboard()` success handler, setelah render kanban lembur, tambah update panel `#db-shift-coverage` menggunakan `res.summary.byShift` yang memiliki `coverage_pct` dari hasil perbandingan JADWAL_SHIFT vs aktual.

---

## Langkah Lanjutan yang Masih Layak

1. QA manual penuh untuk semua role live, terutama sub-tab dashboard Kehadiran / Keterlambatan / Lembur.
2. Pertahankan disiplin update dokumentasi setiap kali ada perubahan deploy atau arsitektur.
3. Pertimbangkan untuk menonaktifkan deployment web app child modules (GATE_PABRIK, AREA_KERJA, REPORT) agar tidak membingungkan — cukup simpan sebagai GAS project tanpa deployment aktif.
4. Jalankan `npm run verify` secara berkala untuk memastikan konfigurasi URL tetap konsisten.

---

## FASE 39: Fix Deteksi Shift 3 Keluar Dini Hari

**Tanggal**: 2026-08-02

**Kondisi awal**
Karyawan Shift 3 yang keluar jam 06:xx pagi sering terdeteksi sebagai Shift 1, bukan Shift 3.

**Akar masalah**
`detectShift()` di `SharedLib.gs` tidak mempertimbangkan `eventType`. Jam 06:00 masuk ke window Shift 1, padahal untuk event keluar jam tersebut adalah akhir Shift 3.

**Solusi**
- Tambah parameter `eventType` ('masuk'/'keluar') ke `detectShift()`.
- Jam `00:00–07:59` pada event keluar diprioritaskan sebagai Shift 3.
- Semua pemanggil (`bindKartu`, `releaseKartu`, repair) diupdate untuk meneruskan `eventType`.

**File**: `SharedLib.gs` — `detectShift(date, eventType)` · `GateFunctions.gs`

---

## FASE 40: Fix Fix-All Stuck (Stale Job & Timeout)

**Tanggal**: 2026-08-02

**Kondisi awal**
Tombol "Fix & Clean All Spreadsheet Error" sering stuck tidak bergerak, bahkan setelah restart manual.

**Akar masalah (1 — Stale Job)**
`startRepairProgressJob` di `DataRepairUtils.gs` tidak ada mekanisme expire untuk job yang crash di tengah jalan. Job lama tertahan di `PropertiesService` selamanya, memblokir job baru.

**Akar masalah (2 — Timeout)**
`rebuildHistoricalRecapDataset_` memanggil `sheet.getDataRange().getValues()` di dalam loop per-karyawan (ribuan iterasi × baca sheet JADWAL_SHIFT). Setiap baca ~300ms → timeout 6 menit GAS.

**Solusi**
- Tambah `STALE_THRESHOLD_MS = 10 menit` di `startRepairProgressJob`. Job lama yang crash otomatis dibersihkan.
- Tambah `buildJadwalCache_()` di `JadwalFunctions.gs`: baca sheet JADWAL_SHIFT 1x di awal, bangun in-memory map, lalu semua iterasi karyawan lookup dari cache O(1).

**File**: `DataRepairUtils.gs` · `JadwalFunctions.gs`

---

## FASE 41: Pagination UI — Compact Horizontal

**Tanggal**: 2026-08-02

**Kondisi awal**
Pagination report table memakai tombol "Sebelumnya" / "Berikutnya" tanpa nomor halaman — sulit navigasi langsung.

**Solusi**
- Tulis ulang `renderReportPagination`, `renderLocalPagination`, `renderPaginationItems` di `app.html`.
- Implementasi gaya horizontal compact: `«  1  2  3  ...  39  »`.
- Ellipsis otomatis muncul jika halaman > 7.
- CSS: `.pagination-bar`, `.pagination-controls`, `.pg-btn`, `.pg-active`, `.pg-ellipsis` di `style.html`.

**File**: `app.html` · `style.html`

---

## FASE 42: Arsitektur Concurrency Gate Scan — Per-Card Lock

**Tanggal**: 2026-08-03

**Kondisi awal**
Error "Sistem sedang memproses scan lain" muncul di jam sibuk (06:00–07:00 Shift 3 keluar) saat banyak karyawan scan bersamaan. Root cause: `withDocumentLock()` adalah global lock untuk semua user. Dengan ~4–5 detik lock held per scan, antrian 20+ user meluap batas 10 detik timeout.

**Akar masalah**
- Satu global lock untuk SEMUA scan kartu → serialisasi penuh.
- Semua operasi (baca + tulis) ada di dalam lock → lock held time 4–5 detik.
- `safeUpdateRecapAbsen` (operasi berat ke sheet RECAP) juga di dalam lock.

**Solusi — Arsitektur Lock Dua-Tingkat**

`withCardLock(cardNo, fn)` baru di `SharedLib.gs`:
1. Ambil global lock **hanya 200ms** untuk atomically set `CKLK_<cardNo>` di PropertiesService.
2. Lepas global lock → semua kartu lain bisa diproses paralel.
3. Jalankan `fn()` tanpa global lock (per-kartu, tidak saling block).
4. Auto-expire 90 detik jika script crash.

`bindKartu` dan `releaseKartu` direfaktor:
- **Di luar lock**: semua baca (karyawan, binding status, factory status, jadwal).
- **Di dalam `withCardLock`**: hanya append 2 sheet (BINDING + MASUK/KELUAR) — ~0.5 detik.
- **Di luar lock (setelah)**: `safeUpdateRecapAbsen` ke sheet RECAP.

`withDocumentLock` tetap ada untuk operasi berat (repair, rebuild recap, jadwal write).

**Kapasitas setelah fix**:
- 100 kartu berbeda → global queue: 100 × 0.2s = 20 detik ✓
- Per-card processing: paralel, tidak saling block ✓
- Repair/rebuild: tetap global lock, tidak terdampak ✓

**File**: `SharedLib.gs` — `withCardLock()` (baru) · `GateFunctions.gs` — `bindKartu()`, `releaseKartu()` direfaktor
