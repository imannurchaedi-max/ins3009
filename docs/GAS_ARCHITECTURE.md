# GAS Architecture

## Ringkasan

Project ini adalah web app Google Apps Script untuk access control, absensi, dan tracking area kerja. Runtime aktifnya sekarang menggunakan struktur `active/` sebagai source of truth, dengan Google Sheets sebagai storage operasional.

## Jalur Baca Efektif

Untuk memahami sistem tanpa tersesat oleh artifact lama, gunakan urutan ini:

1. `README.md`
2. dokumen ini
3. `docs/DEPLOYMENT_GUIDE.md`
4. source di `active/`

Yang tidak boleh dipakai sebagai sumber arsitektur:

- `reports/` karena seluruh isinya generated artifact
- cache Python atau helper lokal di `_local/`
- asumsi lama bahwa file root di luar `active/` adalah runtime aktif

## Source of Truth

- Semua edit runtime yang akan diaudit, di-push, dan di-deploy harus mengacu ke `active/`.
- File root non-`active/` tidak boleh diasumsikan sebagai sumber deploy aktif kecuali ada kebutuhan migrasi yang eksplisit.
- Deploy modul mengarah ke:
  - `active/HOME_PORTAL`
  - `active/MODUL_GATE_PABRIK`
  - `active/MODUL_AREA_KERJA`
  - `active/MODUL_REPORT`

## Komponen Utama

- `active/Code.js`
  Backend utama untuk aplikasi induk: lookup karyawan, validasi sheet, binding kartu, log masuk/keluar, log area kerja, recap absen, dashboard, dan report.
- `active/Index.html`
  Kerangka UI utama yang meng-include partial HTML lain.
- `active/app.html`
  State management frontend, event binding, scanner flow, render dashboard, dan call `google.script.run`.
- `active/style.html`
  CSS mobile-first untuk login, tab, result card, report list, dan scanner.
- `active/SharedLib.gs`
  Library bersama untuk helper lintas modul.

## Modul Micro-Frontend

- `active/HOME_PORTAL/*`
  Portal utama, auth bootstrap, dan router ke modul lain melalui `CONFIG_MODUL`. URL publiknya diperlakukan tetap.
- `active/MODUL_GATE_PABRIK/*`
  Flow `MASUK`, `KELUAR`, dan `CEK ABSEN`.
- `active/MODUL_AREA_KERJA/*`
  Flow `SCAN AREA` dan log pergerakan area kerja.
- `active/MODUL_REPORT/*`
  Backend report khusus untuk monitoring dan ekspor. Frontend-nya masih memakai shared shell yang sama dengan modul lain, jadi baca `Code.js` dan `SharedLib.gs` lebih dulu jika ingin memahami batas tanggung jawab modul ini.

## Workflow Aplikasi

1. User membuka web app hasil deploy `doGet()`.
2. `Index.html` memuat `style.html` dan `app.html`.
3. User login melalui `handleLoginSubmit()` atau bootstrap session dari `?nik=...`.
4. Frontend memanggil `verifyLogin()` atau `verifySession()` di GAS.
5. Role user menentukan tab dan capability melalui `applyRolePermissions()`.
6. Modul `MASUK` memproses bind kartu atau identitas internal melalui `bindKartu()`.
7. Modul `KELUAR` memproses release melalui `getBindingStatus()` dan `releaseKartu()`.
8. Modul `SCAN AREA` mencatat `IN` atau `OUT` melalui `scanAreaKerja()`.
9. Dashboard dan report memanggil fungsi baca seperti `getDashboardData()`, `getRecentAreaLogs()`, `getAbsenReport()`, dan `getAreaActivityReport()`.

## Google Sheet yang Dipakai

- `KARYAWAN`
  Master identitas, role, departemen, jabatan, dan tipe karyawan.
- `REGISTRASI SAAT MASUK PABRIK`
  Log masuk pabrik.
- `REGISTRASI SAAT KELUAR PABRIK`
  Log keluar pabrik.
- `REGISTRASI MASUK KELUAR AREA KERJA`
  Log area kerja.
- `BINDING_KARTU_MK`
  Status binding kartu aktif.
- `ABSEN IN OUT MK`
  Recap harian hasil turunan dari log masuk/keluar.
- `CONFIG_MODUL`
  Mapping nama modul ke URL deploy aktif. Baris `HOME_PORTAL` dipertahankan sebagai URL container permanen.

## Dependensi Operasional

- `scripts/audit_project.py`
  Audit runtime dan pemetaan caller, sheet, serta risiko crash.
- `scripts/extract_functions.py`
  Inventaris fungsi GAS dan frontend.
- `scripts/compare_gas_runtime.py`
  Pencocokan antara caller frontend dan function backend.
- `scripts/deploy_all.py`
  Push dan deploy modul dari folder `active/`.
- `scripts/update_config_sheet.py`
  Update `CONFIG_MODUL` ke URL aktif terbaru.

## Tooling yang Perlu Dipertahankan

Tooling Python yang dianggap resmi dan perlu dibaca hanya:

- `scripts/audit_project.py`
- `scripts/extract_functions.py`
- `scripts/compare_gas_runtime.py`
- `scripts/deploy_all.py`
- `scripts/deploy_home_fixed.py`
- `scripts/update_config_sheet.py`

Selain itu jangan diasumsikan sebagai jalur operasional utama kecuali nanti ditambahkan lagi secara eksplisit.

## Catatan Runtime Penting

- Semua write utama harus dibungkus `withDocumentLock()` untuk mencegah race condition.
- Header sheet wajib sinkron dengan definisi runtime dan sekarang memiliki mekanisme auto-heal untuk header recap yang kosong.
- Klasifikasi `internal/external` tidak boleh hanya mengandalkan `dept/jabatan`; runtime terbaru mengutamakan tipe karyawan dari master data.
- Session bootstrap antar modul harus konsisten agar `HOME_PORTAL` dan modul turunannya tidak saling melempar balik ke login.
