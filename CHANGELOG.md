# Changelog
Semua perubahan penting pada proyek "Speed_Mesin" akan didokumentasikan pada file ini.

## [Bugfix] - 2026-05-17

### 🐛 Fixed (Perbaikan Bug)
- **update_variant.php — Write ke Table Salah:** Perintah `UPDATE machine_settings` diganti menjadi `INSERT INTO sku_history`. Sebelumnya perubahan SKU manual via `settings.php` tidak pernah terefleksi di dashboard karena menulis ke tabel `machine_settings` yang sudah tidak dipakai, sementara semua query read menggunakan `sku_history` sebagai *single source of truth*.
- **index.php — Dashboard Fetch Mode Salah:** Parameter `hours=1` pada fetch `data.php` dihapus sehingga dashboard kini menggunakan **Mode Shift Scope** (tanpa parameter `hours`), konsisten dengan label UI "Production Output (Shift)" yang seharusnya menampilkan output sejak awal shift berjalan.

---

## [Unreleased / Latest Updates] - 2026-05-12

### ✨ Added (Fitur Baru)
- **Deep Analysis Multi-Machine:** Halaman `speed.php` kini mendukung pemilihan banyak mesin sekaligus (multi-select) menggunakan penekanan tombol `CTRL`. Render grafik dan data kalkulasi dilakukan serentak di layar.
- **Quick Preset Time Range:** Menambahkan dropdown preset di `speed.php` untuk mempercepat navigasi pencarian data berdasarkan parameter khusus: "1/2/3 Shift Terakhir" dan Shift spesifik berjalan (Shift 1, 2, 3 Hari ini). 
- **Interval 24 Jam Dinamis:** Menambahkan loop otomatis pada dropdown "Chart Range" sehingga manajer dapat menyaring interval mulai dari 1 jam hingga 24 jam kebelakang.
- **Fungsi Global (Centralized Utility):** Dibuat file khusus `functions.php` yang menyimpan seluruh logika penentuan OEE, pergeseran shift, dan konstanta batas output untuk menghindari praktik penulisan berulang (*WET code*).

### 🛠️ Changed (Perubahan Arsitektur & Perbaikan)
- **Koreksi Parameter Batas Shift (Shift Boundaries):** Melakukan sinkronisasi besar-besaran terhadap logika perpindahan waktu di seluruh skrip (`get_oee_data.php`, `export_oee.php`, `functions.php`) menjadi akurat di jam:
  - Shift 1: `06:00` - `14:00`
  - Shift 2: `14:00` - `22:00`
  - Shift 3: `22:00` - `06:00`
- **Responsivitas UI:** Menambahkan sistem *grid* Bootstrap 5 tingkat lanjut (`col-12 col-md-6 col-lg-3`) pada baris filter `speed.php` untuk memberikan pengalaman yang ramah pengguna *(mobile/tablet-friendly)* ketika dibuka melalui gadget.
- **Kueri Mesin Ganda:** Merubah arsitektur SQL di dalam `data.php` pada mode `deep_analysis` untuk mendukung klausa *IN (...)* secara dinamis agar bisa menangani *array* yang dikirim dari multi-selection mesin dengan format respons balikan berupa *JSON Groups*.
- **Sinkronisasi Data SKU Kiosk TV:** Mengganti tabel rujukan pada `tv_dashboard.php` dari yang semula mengandalkan `machine_settings` beralih sepenuhnya pada *Single Source of Truth* di tabel `sku_history`.

### 🧹 Removed (Pembersihan Kode)
- **Dihapus:** Belasan blok kode JavaScript (*window targets*) dan konstanta PHP yang sebelumnya berulang/duplikat di `index.php`, `oee.php`, `output.php`, dan `tv_dashboard.php`. Semua logika sekarang memanggil `$TARGETS_*` dari `functions.php` yang dipancarkan secara global via `header.php`.

---
*Catatan Dokumentasi: Refactoring Arsitektur & UI UX Enhancement oleh AI Assistant.*
