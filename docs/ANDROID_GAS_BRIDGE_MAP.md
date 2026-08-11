# Android-GAS Bridge Map

Dokumen ini sengaja dibuat untuk membantu maintenance koneksi Android ↔ Google Apps Script dan untuk memberi jalur teks yang eksplisit bagi GitNexus saat menelusuri flow lintas platform.

## Source of Truth

- Frontend Android aktif: `android_app/lib/`
- Router backend Android: `active/HOME_PORTAL/Code.js::doPost()`
- Domain runtime utama: `active/HOME_PORTAL/`
- Arsip lama di `Junk/` bukan source of truth dan tidak boleh dipakai untuk membaca flow aktif

## Bridge Flow Utama

1. Flutter memanggil `ApiService.post(action, payload)`.
2. `ApiService` mengirim JSON ke URL Apps Script `exec`.
3. `Code.js::doPost()` memvalidasi `apiKey`, membaca `action`, lalu meneruskan request ke fungsi GAS domain terkait.
4. Fungsi GAS membaca/menulis Google Sheet sesuai domain.
5. Android menerima JSON response; jika koneksi gagal, telemetry lokal tetap disimpan oleh `AndroidDiagnosticsService`.

## Action Matrix

| Android caller | Action | GAS handler | Read Sheet | Write Sheet | Catatan |
|---|---|---|---|---|---|
| `session_provider.dart` | `verifyLogin` | `verifyLogin()` | `KARYAWAN` | - | login awal |
| `session_provider.dart` | `verifySession` | `verifySession()` | `KARYAWAN` | - | restore session optimistis |
| `gate_screen.dart` | `getBindingStatus` | `getBindingStatus()` | `BINDING_KARTU_MK`, `KARYAWAN`, `ABSEN IN OUT MK` | - | precheck kartu |
| `gate_screen.dart` | `submitGateRequest` | `submitGateRequest()` | `ANDROID_GATE_REQUESTS`, domain gate terkait | `ANDROID_GATE_REQUESTS`, domain gate terkait | request gate idempotent |
| `gate_screen.dart` | `getGateRequestStatus` | `getGateRequestStatus()` | `ANDROID_GATE_REQUESTS` | - | polling recovery |
| `gate_screen.dart` | `bindKartu` | `bindKartu()` | `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | `REGISTRASI SAAT MASUK PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | tetap dipakai oleh web; Android normalnya lewat queue |
| `gate_screen.dart` | `releaseKartu` | `releaseKartu()` | `BINDING_KARTU_MK`, `ABSEN IN OUT MK`, `KARYAWAN` | `REGISTRASI SAAT KELUAR PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | tetap fungsi mutasi inti |
| `area_screen.dart` | `scanAreaKerja` | `scanAreaKerja()` | `BINDING_KARTU_MK`, `KARYAWAN`, `REGISTRASI MASUK KELUAR AREA KERJA`, `ABSEN IN OUT MK` | `REGISTRASI MASUK KELUAR AREA KERJA` | scan area kerja |
| `dashboard_screen.dart` | `getDashboardData` | `getDashboardData()` | `ABSEN IN OUT MK`, `REGISTRASI MASUK KELUAR AREA KERJA`, `KARYAWAN` | - | dashboard operasional |
| `dashboard_screen.dart` | `getKehadiranDashboard` | `getKehadiranDashboard()` | `ABSEN IN OUT MK`, `KARYAWAN`, `JADWAL_SHIFT` | cache script | dashboard kehadiran |
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
