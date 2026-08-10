# Panduan Migrasi / Setup di PC Baru (Onboarding Guide)

Dokumen ini memandu Anda bagaimana cara memindahkan, meng-clone, atau melanjutkan pengembangan proyek **DAM Access Control** (baik bagian Web App GAS maupun Aplikasi Android) di komputer atau laptop lain.

---

## 1. Persiapan Kebutuhan Dasar (Prerequisites)

Sebelum memindahkan source code, pastikan PC baru Anda sudah terinstal software berikut:

### Untuk Backend & Web App (Google Apps Script)
1. **Node.js & npm** (versi LTS terbaru) -> untuk manajemen package dan `clasp`.
2. **Python** (versi 3.x) -> untuk menjalankan script helper dan sinkronisasi config (misalnya `update_config_sheet.py`).

### Untuk Aplikasi Android (Flutter)
1. **Flutter SDK** -> Download versi stabil terbaru dan tambahkan path `flutter\bin` ke System Environment Variables.
2. **Android Studio** -> Wajib diinstal untuk mendapatkan *Android SDK*, *Android SDK Command-line Tools*, dan konfigurasi emulator/device fisik.
3. **Windows Developer Mode** -> Wajib diaktifkan di setelan Windows (Settings > Update & Security > For developers > Developer Mode). Ini dibutuhkan Flutter untuk membuat *symlink* plugin.

---

## 2. Setup Backend & Web App (GAS)

Setelah folder source code (seluruh project) dipindahkan ke PC baru:

1. Buka Terminal/PowerShell di *root* folder project.
2. Jalankan instalasi dependensi Node.js:
   ```bash
   npm install
   ```
3. Login ulang ke akun Google Anda melalui Clasp (wajib dilakukan setiap pindah PC karena token autentikasi disimpan di level mesin):
   ```bash
   npx clasp login
   ```
   *Browser akan terbuka, silakan pilih akun Google yang memiliki akses ke project Apps Script ini.*
4. Verifikasi konfigurasi:
   ```bash
   npm run verify
   ```
5. Jika semuanya aman, Anda bisa mulai melakukan *push* atau *deploy* kode seperti biasa:
   ```bash
   npm run deploy
   ```

---

## 3. Setup Aplikasi Android (Flutter)

1. Pastikan instalasi Flutter sudah beres dengan menjalankan perintah ini di terminal:
   ```bash
   flutter doctor
   ```
   *Pastikan tidak ada error merah di bagian Flutter dan Android toolchain.*
2. Buka Terminal/PowerShell dan arahkan ke dalam folder `android_app`:
   ```bash
   cd android_app
   ```
3. Unduh semua dependensi package Flutter:
   ```bash
   flutter pub get
   ```
   > **[!WARNING] PENTING (Isu Lintas Partisi Windows):**
   > Jika Anda meletakkan folder project di drive **D:** atau selain **C:** (sementara lokasi Flutter SDK/Cache ada di C:), proses *compile* Android/Kotlin akan gagal (Incremental Cache Error).
   > **Solusinya**, set *environment variable* `PUB_CACHE` ke drive yang sama dengan project Anda sebelum menjalankan perintah pub get atau build, contohnya di PowerShell:
   > ```powershell
   > $env:PUB_CACHE="D:\pub_cache"
   > flutter pub get
   > flutter build apk --release
   > ```

4. Untuk mulai men-*debug* atau menjalankan aplikasi secara *live* di HP yang dicolok kabel (dengan mode USB Debugging aktif):
   ```bash
   flutter run
   ```

---

## 4. Source of Truth (Pengingat Arsitektur)

- **Backend**: Folder `active/HOME_PORTAL/` adalah tempat semua logika utama Web App dan router API untuk Android (`Code.js -> doPost`).
- **Android App**: Folder `android_app/lib/` adalah tempat modifikasi UI dan service integrasi Flutter.
- **Config Modul**: URL Web App tersimpan di `scripts/module-config.json`. Jangan pernah mengedit sheet `CONFIG_MODUL` secara manual di Google Sheets.

Jika kedua environment (Node.js/Clasp dan Flutter) sudah berjalan dengan lancar, Anda siap melanjutkan pengembangan persis seperti di PC sebelumnya!
