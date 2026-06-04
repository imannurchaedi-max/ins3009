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

## Langkah Lanjutan yang Masih Layak

1. QA manual penuh untuk semua role live.
2. Pertahankan disiplin update dokumentasi setiap kali ada perubahan deploy atau arsitektur.
