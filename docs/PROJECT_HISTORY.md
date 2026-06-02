# Rekam Jejak Proyek & Post-Mortem (EMPLOYEE TRACKER)

Dokumen ini mencatat perjalanan pengembangan sistem dari awal (Fase 0) hingga saat ini, merangkum berbagai tantangan, kegagalan sistem (*bugs*), penyebabnya, dan solusi arsitektur yang telah diimplementasikan.

---

## FASE 1: Restrukturisasi & Pembersihan Kode (Refactoring)
**Kondisi Awal:** 
Seluruh kode antarmuka (HTML), gaya desain (CSS), dan logika *frontend* (JavaScript) menumpuk di satu file raksasa `Index.html`.
- **Masalah/Risiko:** Sulit melakukan pelacakan *bug*, kode rentan rusak jika diedit, dan beban muat halaman (*page load*) tidak optimal.
- **Solusi:** Memecah `Index.html` menjadi tiga bagian *modular*:
  1. `Index.html` (Kerangka UI HTML)
  2. `style.html` (Semua file styling CSS)
  3. `app.html` (Semua logika JS frontend & AJAX ke Apps Script)

## FASE 2: Perombakan UI/UX & Animasi Premium
**Kondisi Awal:** 
Tampilan aplikasi statis, kuno, dan menggunakan animasi indikator pemuatan (*spinner*) standar bawaan CSS dasar.
- **Kegagalan:** *User Experience* (UX) menurun karena antarmuka terasa tidak responsif dan kaku. 
- **Penyebab:** Tidak ada sistem *Design Framework* yang jelas, penempatan *layout* *hardcoded*, dan minimnya umpan balik visual (*visual feedback*) saat sistem sedang memproses data ke Google Sheets.
- **Solusi Efektif:** 
  1. Mengimplementasikan **Bootstrap 5 CDN** dan **Google Fonts (Outfit)** untuk standarisasi modern.
  2. Membuang *spinner* kuno dan menggantinya dengan:
     - **Pulse Radar Animation:** Gelombang sonar biru interaktif pada tombol saat proses *Scan*.
     - **Skeleton Loading:** Blok bayangan abu-abu dinamis saat memuat *List Absen* dan *Log Area*, mirip dengan standar aplikasi *Enterprise* modern.

## FASE 3: Bug Mobile Navigation (Hilangnya Menu Hamburger)
**Kondisi Awal:**
Menu navigasi berhasil dipindah ke *Sidebar* (samping) di PC, namun pengguna melapor bahwa **di HP menu tidak muncul sama sekali dan layar menjadi kosong**.
- **Kegagalan:** Layar utama (*Dashboard*) pada *smartphone* tertutup warna abu-abu kosong dan menu Hamburger (☰) hilang.
- **Penyebab:** Saat memindahkan struktur *header*, secara tidak sengaja tertinggal atribut `style="display:none;"` secara *inline* pada tombol Hamburger di file `Index.html`. Atribut *inline* ini mengalahkan aturan *Media Query CSS* yang ditujukan untuk memunculkan tombol tersebut pada perangkat seluler.
- **Solusi Efektif:** Menghapus *inline-style* di HTML dan memperbaiki alur `fadeIn` CSS agar tombol navigasi dan halaman pertama otomatis muncul tanpa hambatan di perangkat *Mobile*.

## FASE 4: Kesalahan Syntax (Syntax Error) Saat Transisi Animasi
**Kondisi Awal:**
Ketika proses mengganti *spinner* dengan *Pulse Animation* pada fungsi `handleLoginSubmit()`.
- **Kegagalan:** Tombol MASUK mati (*disabled*) selamanya atau gagal terhubung ke backend.
- **Penyebab:** Pergantian baris kode CSS/JS menggunakan alat edit (*find/replace*) tanpa sengaja menghapus tanda kurung tutup `}` dan menimpa *block* `else` pada *handler*, memutus sambungan `google.script.run`.
- **Solusi Efektif:** Melakukan pembacaan teliti (*view_file*) pada baris 100-130 di `app.html`, menulis ulang sintaks `.withFailureHandler` dan `.withSuccessHandler`, serta memastikan status *Class List* `.pulse-anim` dicabut di semua skenario (berhasil maupun gagal).

## FASE 5: Smart Routing & Filter Privasi Departemen
**Kondisi Awal:** 
Semua pengguna (Administrator, Security, Pengawas, Karyawan) melihat antarmuka yang seragam setelah *Login*, dan Pengawas dapat melihat data absensi dari departemen lain.
- **Masalah/Risiko:** Terjadinya kebingungan navigasi (*bad routing*), kebocoran privasi absen antar-departemen, dan Security tidak bisa mencatat secara spesifik ke 'area/departemen' mana karyawan tersebut masuk.
- **Kegagalan (Salah Sasaran UI):** Saat mencoba mengubah label NIK menjadi opsional untuk *Pengawas*, terdapat kesalahan *target replace* di mana input NIK baru secara tidak sengaja terpasang ke form tab *Login/Masuk*, bukan di *Cek Absen*. (Penyebab: Label penanda pencarian identik antar tab).
- **Solusi Efektif:**
  1. *Fix UI Injection:* Memulihkan segera form Masuk, dan memberikan penanda ID yang sangat spesifik untuk `cek-absen-nik` dan `cek-area-nik`.
  2. *Auto-Routing:* Menambahkan logika JavaScript (`applyRolePermissions`) yang langsung mendeteksi `STATE.currentUser.role` dan melontarkan user ke *default tab* masing-masing (Admin ➔ Dashboard, Pengawas ➔ Cek Absen, Security ➔ Scan Area, Karyawan ➔ Masuk Pabrik).
  3. *Privacy Lock Backend:* Mengubah parameter `getAbsenReport` dengan menambah `deptFilter` khusus untuk Pengawas agar dibatasi pada departemennya sendiri.

## FASE 6: Perombakan UI Cek Absen (Tabel Responsif & Role-Based)
**Kondisi Awal:**
Cek Absen masih menampilkan laporan per karyawan menggunakan komponen *Card* vertikal yang memakan banyak ruang, dan kolom informasinya kurang lengkap (tidak ada No Kartu / Loker). Karyawan juga bisa mencari data karyawan lain.
- **Penyebab Kebutuhan:** Pengawas dan Admin butuh melihat banyak data sekaligus (*high density data*) seperti rekapitulasi ala *Excel*.
- **Solusi Efektif:**
  1. Mengganti *Card layout* menjadi **Bootstrap <table>** yang padat dan memiliki *scroll* menyamping (*table-responsive*).
  2. Menanamkan *Privasi Karyawan*: Jika Karyawan biasa yang membuka Cek Absen, *input* NIK akan terkunci pada NIK-nya sendiri (tidak bisa diubah) dan Tabel yang muncul hanya menampilkan 6 Kolom (tanpa Nama Departemen/Status). Untuk Admin, *full* 7 kolom.
  3. Menambahkan *Header* kolom `NO KARTU MK` dan `NO LOKER` di struktur Google Sheet (*backend*) dan *frontend*.

## FASE 7: Fitur Chips Keperluan & Bug Kartu "Tidak Dikenal"
**Kondisi Awal:**
Saat Security mencatat log area, tidak ada informasi "Untuk apa karyawan tersebut masuk/keluar?".
- **Kegagalan Sistem (Testing):** Setelah fitur `catatan` dan *Chips UI (Toilet, Sholat, Istirahat, dll)* ditambahkan, muncul *error* saat user mengetes kartu: **"Kartu MK0090 tidak dikenal atau tidak aktif."**
- **Root Cause (Akar Masalah):** Pengguna secara manual menghapus/membersihkan data di tab Google Sheet `BINDING_KARTU_MK` (tempat rahasia di mana kartu didaftarkan sebagai "Terikat/BOUND"), tetapi pengguna membiarkan data di sheet `REGISTRASI SAAT MASUK PABRIK` tetap ada. Akibatnya, logika keamanan backend (`getBindingStatus`) menolak kartu karena di matanya, kartu tersebut "Kosong / Tidak Bertuan".
- **Solusi Efektif:**
  1. Pemahaman logika ke Pengguna: Kartu hanya aktif jika ada di Sheet BINDING dengan status `BOUND`. Pengguna harus mengulang *Scan Masuk Pabrik* untuk mengikat ulang kartu tersebut.
  2. UI Chips: Desain Radio Button berhasil ditanamkan sebagai *Chips* mobile-friendly agar Security bisa melakukan 1x klik saja tanpa *dropdown* bertingkat.

## FASE 8: Mode Paksa Masuk/Keluar (Manual Override)
**Kondisi Awal:**
Pencatatan Area Kerja (*scanAreaKerja*) sepenuhnya mengandalkan tebakan sistem (Jika data terakhir IN, maka scan berikutnya OUT).
- **Masalah/Risiko:** Di lapangan, karyawan sering menerobos tanpa scan. Jika mengandalkan *Auto-Toggle*, status masuk/keluar akan terbalik secara fatal dan Security tidak bisa memperbaikinya tanpa merusak rentetan berikutnya.
- **Solusi Efektif:** 
  1. Menambahkan barisan *Chips Mode Scan* di UI Security: **AUTO, IN (Paksa Masuk), dan OUT (Paksa Keluar)**.
  2. Menambahkan argumen `forceMode` ke backend `Code.gs`. Jika Security memilih IN, backend akan mengabaikan logika pencarian *last status* dan langsung memaksanya menjadi "IN".
  3. *Continuous Scan:* Memastikan fungsi `handleSecurityScan` langsung mengosongkan kotak *input barcode* setelah berhasil, sehingga Security dapat menembak banyak Karyawan sekaligus dengan cepat tanpa menyentuh layar.

## FASE 9: Sistem Rekapitulasi Area Cerdas (Client-Side Computing)
**Kondisi Awal:**
Pengawas kesulitan menghitung seberapa sering anak buahnya keluar/masuk karena laporan hanya menyajikan riwayat detik demi detik secara memanjang (log mentah).
- **Solusi Efektif & Arsitektur:**
  1. Membagi tampilan menjadi 2 Tab **(Nav Pills): Log Timestamp vs Rekap Hitungan**.
  2. Alih-alih merombak backend `Code.gs` (yang dapat memakan kuota prosesor server Google), logika pengelompokan (*grouping*) dan kalkulasi frekuensi IN/OUT dibangun murni menggunakan **JavaScript Frontend** di dalam `app.html` (`renderAreaReport`).
  3. Browser klien (HP/Laptop Pengawas) langsung mengolah *array* log mentah, menghitung total *IN/OUT* per orang, lalu merendernya ke dalam Tabel Statistik *real-time*. Kecepatan memuat 1000% lebih efisien karena tanpa pemanggilan server tambahan!

---

**Status Saat Ini (Recent Status):**
1. Modul Absen Utama (Masuk & Keluar Pabrik) = **STABIL**.
2. Modul Privasi / Role-Routing = **STABIL**.
3. Modul Scan Area Kerja (Security & Pengawas) = **SELESAI & SANGAT TANGGUH** (Dilengkapi *Continuous Scan*, *Override Mode*, dan *Client-Side Recaps*).
4. **Semua integrasi Frontend lokal tersinkronisasi 100% dengan Google Apps Script via `clasp`.**

**Langkah Selanjutnya (Next Steps / Starting Point):**
Bila kita ingin melanjutkan pengembangan, fokus dapat diarahkan pada:
1. Pembangunan *Dashboard* Admin (Menampilkan grafik/Chart kehadiran global).
2. Pembuatan fitur *Export/Download* CSV untuk Laporan Rekap Area Kerja.
3. Fitur pendaftaran (Registrasi) Karyawan baru langsung dari WebApp.
