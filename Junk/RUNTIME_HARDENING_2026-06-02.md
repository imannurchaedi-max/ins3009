# Runtime Hardening Notes

Dokumen ini merangkum keputusan hardening runtime yang menjaga aplikasi tetap stabil selama migrasi multi-modul dan sinkronisasi auth.

## Ruang Lingkup

- stabilitas auth lintas modul
- klasifikasi internal vs external
- konsistensi recap dan header sheet
- disiplin source of truth runtime

## 1. Auth Bootstrap Antar Modul

Masalah yang muncul:
- user bisa login di `HOME_PORTAL`, lalu mental kembali ke login saat pindah modul
- flow mitra terasa berulang karena modul tujuan tidak membaca bootstrap session dengan konsisten

Keputusan hardening:
- `HOME_PORTAL` menjadi titik masuk utama
- modul turunan membaca session bootstrap yang konsisten
- perpindahan modul tidak mengandalkan flow login ganda

## 2. Internal vs External

Masalah yang muncul:
- scanner untuk user external bisa hilang jika klasifikasi hanya mengandalkan `dept/jabatan`

Keputusan hardening:
- tipe karyawan dari master data dijadikan sinyal utama
- fallback berbasis `dept/jabatan` hanya dipakai jika tipe tidak tersedia
- backend tetap harus memverifikasi jalur masuk agar external tidak bisa menyamar sebagai internal

## 3. Header Sheet dan Backward Compatibility

Masalah yang muncul:
- sheet `ABSEN IN OUT MK` lama bisa gagal diproses jika kolom baru masih kosong

Keputusan hardening:
- validasi header tetap dipertahankan
- untuk header recap yang kosong namun memang wajib, runtime melakukan auto-heal row 1 sebelum gagal

Ini menjaga:
- sheet lama tetap bisa dibaca
- migrasi header tidak perlu selalu dilakukan manual

## 4. Locking dan Konsistensi Tulis

Keputusan hardening:
- operasi write utama tetap dibungkus `withDocumentLock()`
- recap diperlakukan sebagai data turunan, bukan sumber primer
- integritas `BINDING_KARTU_MK` harus tetap menjadi dasar status kartu aktif

## 5. Multi-Modul dan Registry URL

Keputusan hardening:
- URL aktif modul disimpan di `CONFIG_MODUL`
- deploy script wajib meng-update registry itu setelah deploy
- `HOME_PORTAL` tidak boleh mengandalkan URL hardcoded jika registry tersedia
- baris `HOME_PORTAL` di `CONFIG_MODUL` diperlakukan tetap dan tidak boleh ditimpa oleh flow auto-deploy modul
- `HOME_PORTAL` tidak boleh ikut auto-deploy biasa; jika perlu update, deployment harus di-update in place

## 6. Canonical Source Repo

Kondisi terbaru:
- source aktif berada di `active/`

Keputusan hardening:
- audit, edit, deploy, dan dokumentasi harus mengacu ke `active/`
- file root lama diperlakukan sebagai legacy atau transisi sampai benar-benar dipensiunkan
- generated report di `reports/` tidak boleh dijadikan sumber arsitektur tanpa generate ulang

## Checklist Pasca Perubahan Runtime

1. Audit caller, function, dan dependensi sheet.
2. Pastikan auth lintas modul tetap mulus.
3. Pastikan flow external masih menampilkan scanner.
4. Pastikan `CONFIG_MODUL` ter-update setelah deploy.
5. Pastikan tidak ada mismatch header pada sheet recap utama.
6. Untuk scanner kamera, utamakan jalur native live scan jika `BarcodeDetector` tersedia, lalu fallback ke `html5-qrcode`.
7. Pada Chrome mobile di dalam sandbox Apps Script, siapkan `capture="environment"` sebagai jalur scan praktis karena permission policy host bisa memblokir live camera sepenuhnya.
