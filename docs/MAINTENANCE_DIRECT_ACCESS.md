# Maintenance Direct Access

Dokumen ini adalah pintu masuk tercepat untuk maintenance repo ini. Tujuannya sederhana: saat ada bug, perubahan workflow, atau permintaan fitur, kita tidak perlu membaca seluruh source lagi dari nol.

## Source of Truth

- Runtime utama: `active/HOME_PORTAL/`
- Android app: `android_app/lib/`
- Dokumen arsitektur: `docs/GAS_ARCHITECTURE.md`
- Dokumen flow + dependency: `docs/NEURAL_MAPPING.md`
- Dokumen blast radius: `docs/BLAST_RADIUS.md`
- Index fungsi: `docs/FUNCTION_MAPPING.md`
- Workflow operasional: `docs/OPERATIONAL_WORKFLOW.md`
- Kontrak input-output: `docs/INPUT_OUTPUT_DEPENDENCY_MAP.md`

## Jalur Baca Minimum

Gunakan urutan ini agar tidak tersesat:

1. `README.md`
2. dokumen ini
3. `docs/GAS_ARCHITECTURE.md`
4. `docs/INPUT_OUTPUT_DEPENDENCY_MAP.md`
5. `docs/NEURAL_MAPPING.md`
6. source terkait di `active/HOME_PORTAL/` atau `android_app/lib/`

## Direct Access by Maintenance Scenario

| Kasus | Baca Dokumen | File Utama | Fungsi / Entry Point |
|---|---|---|---|
| Login gagal / session loop | `GAS_ARCHITECTURE.md`, `NEURAL_MAPPING.md`, `BLAST_RADIUS.md` | `active/HOME_PORTAL/SharedLib.gs`, `active/HOME_PORTAL/app.html`, `android_app/lib/main.dart`, `android_app/lib/providers/session_provider.dart`, `android_app/lib/screens/login_screen.dart`, `android_app/lib/screens/home_screen.dart`, `android_app/lib/services/api_service.dart` | `verifyLogin()`, `verifySession()`, `handleLoginSubmit()`, `restoreSavedSession()`, `AuthWrapper`, `SessionProvider.login()`, `SessionProvider.logout()`, `ApiService.post()` |
| Gate masuk / keluar bermasalah | `OPERATIONAL_WORKFLOW.md`, `INPUT_OUTPUT_DEPENDENCY_MAP.md`, `BLAST_RADIUS.md` | `active/HOME_PORTAL/GateFunctions.gs`, `active/HOME_PORTAL/app.html`, `android_app/lib/screens/gate_screen.dart` | `bindKartu()`, `releaseKartu()`, `getBindingStatus()`, `confirmMasuk()`, `confirmKeluar()` |
| Scan area / NFC / kamera bermasalah | `NEURAL_MAPPING.md`, `INPUT_OUTPUT_DEPENDENCY_MAP.md`, `BLAST_RADIUS.md` | `active/HOME_PORTAL/AreaFunctions.gs`, `android_app/lib/screens/area_screen.dart`, `android_app/lib/services/scan_payload_service.dart` | `scanAreaKerja()`, `getRecentAreaLogs()`, `submitScan()` |
| Dashboard lambat / loop / data tidak cocok | `GAS_ARCHITECTURE.md`, `NEURAL_MAPPING.md`, `INPUT_OUTPUT_DEPENDENCY_MAP.md` | `active/HOME_PORTAL/AreaFunctions.gs`, `android_app/lib/screens/dashboard_screen.dart` | `getDashboardData()`, `getKehadiranDashboard()` |
| Report absen / area salah | `FUNCTION_MAPPING.md`, `INPUT_OUTPUT_DEPENDENCY_MAP.md`, `BLAST_RADIUS.md` | `active/HOME_PORTAL/ReportFunctions.gs`, `android_app/lib/screens/absen_screen.dart`, `active/HOME_PORTAL/app.html` | `getAbsenReport()`, `getAreaActivityReport()` |
| Jadwal shift tidak sinkron | `FUNCTION_MAPPING.md`, `NEURAL_MAPPING.md`, `BLAST_RADIUS.md` | `active/HOME_PORTAL/JadwalFunctions.gs`, `active/HOME_PORTAL/app.html` | `saveJadwalShift()`, `deleteJadwalShift()`, `getJadwalShift()`, `getKaryawanExpectedForDate()` |
| Deploy berhasil tapi user masih lihat versi lama | `DEPLOYMENT_GUIDE.md`, `OPERATIONAL_WORKFLOW.md` | `scripts/module-config.json`, `active/HOME_PORTAL/Code.js` | `npm run deploy`, `npm run verify`, `openHomePortalLauncher()` |

## Entry Point Runtime

### Web App

- Browser masuk ke `Code.js::doGet()`
- Shell dirender dari `Index.html`
- Semua event frontend hidup di `app.html`
- Semua call backend web lewat `google.script.run`

### Android

- Semua request masuk ke `Code.js::doPost()`
- Router `action` mengarah ke fungsi GAS yang sama dengan web
- Semua request Android lewat `android_app/lib/services/api_service.dart`
- Root auth Android ditentukan oleh `AuthWrapper` di `android_app/lib/main.dart`
- Session Android dikelola penuh oleh `SessionProvider`

## File Access Map

| Domain | Backend | Frontend Web | Android |
|---|---|---|---|
| Shell / Router | `active/HOME_PORTAL/Code.js` | `active/HOME_PORTAL/Index.html` | `android_app/lib/services/api_service.dart` |
| Shared / Auth / Sheet util | `active/HOME_PORTAL/SharedLib.gs` | `active/HOME_PORTAL/app.html` | `android_app/lib/providers/session_provider.dart` |
| Gate | `active/HOME_PORTAL/GateFunctions.gs` | `active/HOME_PORTAL/app.html` | `android_app/lib/screens/gate_screen.dart` |
| Area | `active/HOME_PORTAL/AreaFunctions.gs` | `active/HOME_PORTAL/app.html` | `android_app/lib/screens/area_screen.dart` |
| Dashboard Kehadiran | `active/HOME_PORTAL/AreaFunctions.gs` | `active/HOME_PORTAL/app.html` | `android_app/lib/screens/dashboard_screen.dart` |
| Report | `active/HOME_PORTAL/ReportFunctions.gs` | `active/HOME_PORTAL/app.html` | `android_app/lib/screens/absen_screen.dart` |
| Jadwal | `active/HOME_PORTAL/JadwalFunctions.gs` | `active/HOME_PORTAL/app.html` | belum ada screen Android khusus |

## Fast Commands

```bash
node .gitnexus/run.cjs status
python scripts/audit_project.py
python scripts/extract_functions.py
python scripts/compare_gas_runtime.py
npm run verify
npm run deploy
```

## GitNexus / Graph Quick Notes

- GitNexus repo ini aktif sebagai `ins3009`.
- `context()` dan `detect_changes()` sudah sangat berguna untuk maintenance simbol.
- Pada Senin, 10 Agustus 2026, FTS GitNexus masih belum aktif karena ekstensi LadybugDB FTS belum tersedia, jadi query natural language bisa lebih lemah dari biasanya.
- Graphify aktif untuk graph lokal repo, tetapi hasilnya harus tetap dibaca bersama `active/HOME_PORTAL/` karena repo masih menyimpan arsip di `Junk/`.

## Checklist Sebelum Mengubah Kode

1. Pastikan bug/fitur masuk ke domain yang benar.
2. Baca dokumen domain terkait dari tabel di atas.
3. Buka file backend dan caller frontend yang terhubung.
4. Cek Google Sheet dependency di `docs/INPUT_OUTPUT_DEPENDENCY_MAP.md`.
5. Jalankan audit jika perubahan menyentuh kontrak data atau workflow.
6. Jalankan `detect_changes()` sebelum commit.

## Checklist Sesudah Mengubah Kode

1. Update dokumen di `docs/` jika kontrak atau flow berubah.
2. Jika runtime GAS berubah, jalankan `npm run deploy`.
3. Jalankan `npm run verify`.
4. Commit dengan pesan yang menjelaskan domain perubahan.
