# Rekam Jejak Proyek & Post-Mortem

Dokumen ini mencatat evolusi sistem dari fase awal sampai runtime aktif terbaru, termasuk bug penting, akar masalah, dan keputusan arsitektur yang dipakai untuk menstabilkan aplikasi.

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

## Langkah Lanjutan yang Masih Layak

1. QA manual penuh untuk semua role live.
2. Pertahankan disiplin update dokumentasi setiap kali ada perubahan deploy atau arsitektur.
3. Pertimbangkan untuk menonaktifkan deployment web app child modules (GATE_PABRIK, AREA_KERJA, REPORT) agar tidak membingungkan — cukup simpan sebagai GAS project tanpa deployment aktif.
