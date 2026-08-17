# Android-GAS Bridge Map

Dokumen ini sengaja dibuat untuk membantu maintenance koneksi Android ↔ Google Apps Script dan untuk memberi jalur teks yang eksplisit bagi GitNexus saat menelusuri flow lintas platform.

## Source of Truth

- Frontend Android aktif: `android_app/lib/`
- Router backend Android: `active/HOME_PORTAL/Code.js::doPost()`
- Domain runtime utama: `active/HOME_PORTAL/`
- Arsip lama di `Junk/` bukan source of truth dan tidak boleh dipakai untuk membaca flow aktif

## Bridge Flow Utama

1. Flutter memanggil `ApiService.post(action, payload)`.
2. `ApiService` mengirim JSON ke URL Apps Script `exec`, menyertakan `sessionToken` (jika ada) secara otomatis untuk semua action.
3. `Code.js::doPost()` memvalidasi `apiKey`, membaca `action`, lalu meneruskan request ke fungsi GAS domain terkait — action mutasi/PII (lihat bagian Auth) juga divalidasi `sessionToken`-nya sebelum dispatch.
4. Fungsi GAS membaca/menulis Google Sheet sesuai domain.
5. Android menerima JSON response; jika koneksi gagal, telemetry lokal tetap disimpan oleh `AndroidDiagnosticsService`.

## Auth

- **API key** (`apiKey`) — gate identifikasi aplikasi, dibaca lewat `getAndroidApiKey_()` dari Script Property `ANDROID_API_KEY` (fallback ke literal lama bila property belum diisi). Bukan rahasia kuat (bisa diekstrak dari APK) — bukan itu yang mengamankan mutasi data.
- **Session token** (`sessionToken`) — kredensial nyata untuk Android. Diterbitkan `generateSessionToken_()` saat `verifyLogin()` sukses (UUID, TTL 30 hari, disimpan di sheet `ANDROID_SESSIONS`), lalu disimpan Android via `flutter_secure_storage` dan otomatis dilampirkan `ApiService` ke setiap request (`ApiService.sessionToken`).
  - `verifySession` (action Android) → `verifySessionToken_(token)` — verifikasi token nyata terhadap `ANDROID_SESSIONS`, **bukan** lookup by NIK.
  - Action yang **wajib** `sessionToken` valid (via `requireAndroidSessionToken_()` di `doPost()`): `bindKartu`, `releaseKartu`, `scanAreaKerja`, `submitGateRequest`, `getKaryawanByNIK`.
  - Session lama/kadaluarsa dibersihkan opportunistically oleh `cleanupExpiredAndroidSessions_()`.
  - Catatan: `verifySession(nik)`/`verifyLogin(nik, pwd)` di `SharedLib.gs` juga dipakai jalur **web** (`google.script.run`, terpisah dari `doPost()`) — jalur web tidak memakai `sessionToken` Android ini, tetap dengan model session `dam_session` (localStorage) yang sudah ada. Lihat `docs/ARCHITECTURE_AUDIT_2026-08-17.md` untuk detail keputusan scoping ini.

## Action Matrix

| Android caller | Action | GAS handler | Read Sheet | Write Sheet | Catatan |
|---|---|---|---|---|---|
| `session_provider.dart` | `verifyLogin` | `verifyLogin()` (menerbitkan `sessionToken` via `generateSessionToken_()`) | `KARYAWAN`, `ANDROID_SESSIONS` | `ANDROID_SESSIONS` | login awal |
| `session_provider.dart` | `verifySession` | `verifySessionToken_()` (verifikasi token nyata, bukan lookup by NIK) | `ANDROID_SESSIONS`, `KARYAWAN` | - | restore session optimistis |
| `gate_screen.dart` | `getBindingStatus` | `getBindingStatus()` | `BINDING_KARTU_MK`, `KARYAWAN`, `ABSEN IN OUT MK` | - | precheck kartu |
| `gate_screen.dart` | `submitGateRequest` (`requestAction: 'bindKartu'`\|`'releaseKartu'`) | `submitGateRequest()` → `processGateRequestById_()` → `bindKartu()`/`releaseKartu()` | `ANDROID_GATE_REQUESTS`, `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`, domain gate terkait | `ANDROID_GATE_REQUESTS`, `REGISTRASI SAAT MASUK/KELUAR PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | request gate idempotent — `gate_screen.dart` **tidak pernah** kirim action `bindKartu`/`releaseKartu` langsung, selalu lewat queue ini. `bindKartu`/`releaseKartu` sebagai action `doPost()` tersendiri tetap ada untuk jalur web (`google.script.run`); dipanggil lewat HTTP Android butuh `sessionToken` valid |
| `gate_screen.dart` | `getGateRequestStatus` | `getGateRequestStatus()` | `ANDROID_GATE_REQUESTS` | - | polling recovery |
| `gate_screen.dart` | `getKaryawanByNIK` | `getKaryawanByNIK()` | `KARYAWAN` | - | lookup NIK untuk operator; butuh `sessionToken` valid |
| `area_screen.dart` | `scanAreaKerja` | `scanAreaKerja()` | `BINDING_KARTU_MK`, `KARYAWAN`, `REGISTRASI MASUK KELUAR AREA KERJA`, `ABSEN IN OUT MK` | `REGISTRASI MASUK KELUAR AREA KERJA` | scan area kerja; butuh `sessionToken` valid |
| `dashboard_screen.dart` | `getKehadiranDashboard` | `getKehadiranDashboard()` | `ABSEN IN OUT MK`, `KARYAWAN`, `JADWAL_SHIFT` | cache script | dashboard kehadiran (satu-satunya action dashboard yang dipanggil `dashboard_screen.dart` — `getDashboardData` tidak dipakai Android) |
| `area_screen.dart` | `getRecentAreaLogs` | `getRecentAreaLogs()` | `REGISTRASI MASUK KELUAR AREA KERJA` | - | recent area logs |
| `absen_screen.dart` | `getAbsenReport` | `getAbsenReport()` | `ABSEN IN OUT MK`, `KARYAWAN`, `JADWAL_SHIFT` | cache script | report absen |
| `absen_screen.dart` | `getAreaActivityReport` | `getAreaActivityReport()` | `REGISTRASI MASUK KELUAR AREA KERJA`, `KARYAWAN` | cache script | report area |
| `home_screen.dart` | `pingAndroidGateway` | `pingAndroidGateway()` | - | - | warmup koneksi |
| `api_service.dart` | `logAndroidDiagnostics` | `logAndroidDiagnostics()` | - | `ANDROID_DIAGNOSTICS` | flush batch telemetry |
| `api_service.dart` | `searchKaryawan` | `searchKaryawan()` | `KARYAWAN` | - | helper lookup |

## Reliability Guards

### Transport

- `ApiService` memakai `dart:io HttpClient`, bukan `http.post` biasa, agar POST tidak berubah jadi GET saat redirect Apps Script.
- `ApiService` memakai shared client supaya keep-alive socket bisa dipakai ulang.
- Saat `SocketException`, `HandshakeException`, atau `HttpException`, client pool di-reset agar koneksi rusak tidak diwariskan.

### Idempotency

- Android gate tidak mengulang `bindKartu()` atau `releaseKartu()` secara buta.
- `submitGateRequest()` menyimpan ledger di `ANDROID_GATE_REQUESTS`.
- `getGateRequestStatus()` menjadi sumber jawaban saat response submit utama hilang.

### Locking gate request ledger (per-requestId, bukan document lock global)

- Registrasi (`submitGateRequest`), klaim, dan finalisasi request di `processGateRequestById_()`
  dikunci lewat `withGateRequestQueueLock_()` (`GateFunctions.gs`) — memakai mekanisme yang sama
  dengan `withCardLock()` (marker `PropertiesService` + global lock singkat hanya untuk
  check-then-set), tapi dengan key `'GRQ_' + requestId`.
- **Kenapa bukan `withDocumentLock()`:** document lock bersifat global untuk seluruh
  spreadsheet, jadi request Android untuk kartu A akan menunggu request kartu B. Jalur web
  (`bindKartu`/`releaseKartu` langsung) tidak pernah punya masalah ini karena hanya memakai
  `withCardLock()` per-kartu. Sebelum perbaikan ini, jalur Android (`submitGateRequest` →
  `processGateRequestById_`) memegang document lock **dua kali** per scan (klaim + finalize),
  menjadi penyebab utama keluhan "antrian kartu" dan binding yang sudah sukses di sheet tapi
  masih terlihat pending/gagal di app (karena HTTP response tertahan menunggu giliran lock,
  bukan karena tulisan datanya lambat).
- Klaim juga menolak re-claim requestId yang statusnya masih `PROCESSING` dan baru (< 45 detik)
  — mencegah `bindKartu`/`releaseKartu` terpanggil dobel jika ada retry yang tumpang tindih
  dengan eksekusi yang masih berjalan.
- `findGateRequestRecordById_()` membaca jendela 500 baris terbaru dulu sebelum fallback ke full
  scan, supaya lookup requestId yang baru dibuat Android tetap cepat walau ledger
  `ANDROID_GATE_REQUESTS` terus bertambah besar seiring waktu.

### Observability

- `AndroidDiagnosticsService` menyimpan event lokal ketika request sukses, gagal, timeout, atau recovery polling dijalankan.
- `logAndroidDiagnostics()` mem-flush batch ke sheet `ANDROID_DIAGNOSTICS`.
- `pingAndroidGateway()` dipakai untuk memanaskan jalur koneksi sebelum scan operasional pertama.

## Area yang Tidak Dicakup Otomatis oleh Static Graph

- Routing dinamis `doPost()` berbasis string `action`
- Kontrak sheet yang bersifat konseptual, bukan import kode
- Recovery loop Android yang bergantung pada `requestId`
- Telemetry lokal yang baru di-flush pada request sukses berikutnya

Karena itu, dokumen ini harus diupdate setiap kali ada action Android baru atau ada sheet backend baru khusus bridge mobile.
