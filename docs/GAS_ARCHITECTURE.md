# GAS Architecture

## Ringkasan

Project ini adalah web app Google Apps Script untuk access control, absensi, dan tracking area kerja PT Daya Anugrah Mulya. Runtime aktifnya menggunakan struktur `active/` sebagai source of truth, dengan Google Sheets sebagai storage operasional.

**Arsitektur saat ini: True Single-URL Shell** — sejak FASE 28 (2026-06-06), seluruh aplikasi berjalan di satu GAS project (`HOME_PORTAL`) dengan satu URL permanen. Tidak ada lagi perpindahan URL antar modul.

## Jalur Baca Efektif

Untuk memahami sistem tanpa tersesat oleh artifact lama, gunakan urutan ini:

1. `README.md`
2. dokumen ini
3. `docs/DEPLOYMENT_GUIDE.md`
4. source di `active/HOME_PORTAL/`

Yang tidak boleh dipakai sebagai sumber arsitektur:

- `reports/` karena seluruh isinya generated artifact
- cache Python atau helper lokal di `_local/`
- `active/MODUL_GATE_PABRIK/`, `active/MODUL_AREA_KERJA/`, `active/MODUL_REPORT/` sebagai frontend — ketiga modul ini masih ada sebagai GAS project tersendiri namun **bukan lagi primary user-facing URL**

## Source of Truth

- Semua edit runtime yang akan diaudit, di-push, dan di-deploy mengacu ke `active/HOME_PORTAL/`.
- Satu URL permanen:
  ```
  https://script.google.com/macros/s/AKfycbzoALF7oD-WRuyhwp22pdQ6l3fGLRJuQ-OSnb5AizG-MBcOul5m74z6Xtq-hQ5IEsqX/exec
  ```
- URL ini tidak pernah berubah karena deploy memakai `clasp deploy -i <deploymentId>` (update in-place).

## Struktur HOME_PORTAL (Shell Utama)

```
active/HOME_PORTAL/
├── Code.js              ← doGet() entry point
├── SharedLib.gs         ← utility, auth, lookup, getModuleUrls (jarang berubah)
├── GateFunctions.gs     ← bindKartu, releaseKartu, getBindingStatus, updateRecapAbsen
├── AreaFunctions.gs     ← scanAreaKerja, getDashboardData, getRecentAreaLogs
├── ReportFunctions.gs   ← getAbsenReport, getAreaActivityReport
├── Index.html           ← semua halaman (masuk, keluar, security, dashboard, cek-absen, cek-area, export, revisi)
├── app.html             ← seluruh JS UI logic, event handler, scanner flow
├── style.html           ← CSS mobile-first
└── appsscript.json
```

**Panduan modifikasi per domain:**

| Ubah apa | Edit file | Command |
|----------|-----------|---------|
| Logika gate/kartu MK | `GateFunctions.gs` | `npm run push` |
| Logika scan area kerja | `AreaFunctions.gs` | `npm run push` |
| Laporan & rekap | `ReportFunctions.gs` | `npm run push` |
| Utility / auth | `SharedLib.gs` | `npm run push` |
| UI & event handler | `app.html` | `npm run push` |
| Struktur halaman | `Index.html` | `npm run push` |
| Styling | `style.html` | `npm run push` |

## Workflow Aplikasi

1. User membuka URL HOME_PORTAL.
2. `Index.html` memuat `style.html` dan `app.html`.
3. `DOMContentLoaded` cek `dam_session` di localStorage.
   - Session valid → `restoreSavedSession()` → `applyRolePermissions()` langsung masuk.
   - Tidak ada session → tampil form login.
4. User login via `handleLoginSubmit()` → `verifyLogin()` di GAS.
5. `applyRolePermissions()` menentukan tab yang visible dan default tab:
   - `KARYAWAN` → tab MASUK
   - `SECURITY` → tab SCAN AREA
   - `PENGAWAS` → tab SCAN AREA
   - `ADMINISTRATOR` → tab DASHBOARD
6. Semua tab switch adalah **lokal** — tidak ada perpindahan URL.
7. Backend dipanggil via `google.script.run` langsung ke HOME_PORTAL GAS project.

## Session Management

- Login di HOME_PORTAL menulis `dam_session` ke localStorage dengan expiry 7 hari.
- `dam_session` berisi: `{ nik, nama, role, dept, jabatan, type, exp }`.
- Refresh HOME_PORTAL → baca `dam_session` → auto-login tanpa form.
- Logout → hapus `dam_session` → tampil form login.

**Catatan penting:** `dam_session` digunakan sebagai state dalam satu browser session. Karena semua halaman berada dalam satu GAS project (origin yang sama), localStorage dapat dibaca konsisten.

## Role & Akses Tab

| Tab | ADMINISTRATOR | PENGAWAS | SECURITY | KARYAWAN |
|-----|:---:|:---:|:---:|:---:|
| MASUK | ✅ | — | ✅ | ✅ |
| KELUAR | ✅ | — | ✅ | ✅ |
| SCAN AREA | ✅ | ✅ | ✅ | — |
| DASHBOARD | ✅ | ✅ | — | — |
| CEK ABSEN | ✅ | ✅ | ✅ | ✅ |
| LOG AREA | ✅ | ✅ | ✅ | — |
| EXPORT | ✅ | — | — | — |
| REVISI | ✅ | — | — | — |

**CEK ABSEN — NIK:**
- KARYAWAN: wajib isi NIK (hanya bisa lihat data sendiri)
- SECURITY / ADMINISTRATOR: NIK opsional (bisa lihat semua)
- PENGAWAS: NIK opsional, auto-filter by dept sendiri

## Google Sheet yang Dipakai

- `KARYAWAN` — Master identitas, role, departemen, jabatan, tipe karyawan
- `REGISTRASI SAAT MASUK PABRIK` — Log masuk pabrik
- `REGISTRASI SAAT KELUAR PABRIK` — Log keluar pabrik
- `REGISTRASI MASUK KELUAR AREA KERJA` — Log area kerja (kolom 7: TUJUAN, kolom 8: CATATAN)
- `BINDING_KARTU_MK` — Status binding kartu aktif
- `ABSEN IN OUT MK` — Recap harian turunan dari log masuk/keluar
- `CONFIG_MODUL` — Masih ada di spreadsheet, namun tidak lagi kritis karena shell tidak perlu routing URL

## Child Modules (Backup / Testing)

Ketiga project GAS ini masih aktif dan bisa di-deploy sebagai web app tersendiri jika dibutuhkan untuk testing atau fallback:

- `active/MODUL_GATE_PABRIK/` — Code.js + SharedLib.gs + frontend lengkap
- `active/MODUL_AREA_KERJA/` — Code.js + SharedLib.gs + frontend lengkap
- `active/MODUL_REPORT/` — Code.js + SharedLib.gs + frontend lengkap

Namun dalam operasional normal, user hanya menggunakan URL HOME_PORTAL.

## Tooling Deploy

```
npm run push          # push code saja (cepat, ~10 detik)
npm run deploy        # push + deploy in-place + update CONFIG_MODUL
npm run push:force    # push --force (paksa override)
npm run deploy:force  # deploy --force
```

Pipeline `npm run deploy`:
1. `clasp push` untuk semua 4 modul
2. `clasp deploy -i <deploymentId>` untuk semua 4 modul (URL tidak berubah)
3. `python scripts/update_config_sheet.py` untuk update CONFIG_MODUL sheet

## Catatan Runtime Penting

- Semua write utama harus dibungkus `withDocumentLock()` untuk mencegah race condition.
- Header sheet wajib sinkron dengan definisi runtime.
- Klasifikasi `internal/external` mengutamakan tipe karyawan dari master data, bukan hanya dept/jabatan.
- `escHtml()` tersedia di `SharedLib.gs` untuk sanitasi output HTML di backend.
- Tab switching di HOME_PORTAL shell tidak memanggil `getModuleUrls()` — semua navigasi lokal.
