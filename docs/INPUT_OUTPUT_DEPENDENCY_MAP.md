# Input Output Dependency Map

Dokumen ini merangkum kontrak input, output, dependency sheet, dan caller untuk flow utama. Fokusnya adalah maintenance cepat: saat ada bug atau perubahan, kita bisa langsung melihat jalur data tanpa membaca seluruh implementasi.

## Konvensi Baca

- `Input` = parameter dari web, Android, atau helper internal
- `Output` = payload balik yang dipakai caller
- `Read Sheet` = sheet yang dibaca
- `Write Sheet` = sheet yang ditulis
- `Caller` = pemanggil utama yang perlu dicek saat bug muncul

## Session & Auth

| Operation | Caller | Input | Output | Read Sheet | Write Sheet | Dependency Penting |
|---|---|---|---|---|---|---|
| `verifyLogin(nik, password)` | `app.html::handleLoginSubmit()`, `android_app/lib/providers/session_provider.dart` | `nik`, `password` | `ok`, `msg`, `karyawan`, `depts`, `sessionToken` (2026-08-17, dipakai Android) | `KARYAWAN`, `ANDROID_SESSIONS` (write token) | `ANDROID_SESSIONS` | password kosong masih valid untuk user tertentu; payload user dibentuk oleh `makeKaryawanPayload()`; sukses juga menerbitkan `sessionToken` real via `generateSessionToken_()` |
| `verifySession(nik)` — web only | `app.html::restoreSavedSession()` | `nik` | `ok`, `msg`, `karyawan`, `depts` | `KARYAWAN` | - | tetap lookup by NIK, TIDAK diubah (web tetap pakai model lama, lihat `docs/GAS_ARCHITECTURE.md`) |
| `verifySession` (action Android, doPost) → `verifySessionToken_(token)` | Android bootstrap session | `sessionToken` | `ok`, `msg`, `karyawan`, `depts` | `ANDROID_SESSIONS`, `KARYAWAN` | - | verifikasi token nyata, **bukan** lookup NIK; restore lokal (flutter_secure_storage) berjalan dulu lalu verify di background |
| `searchKaryawan(query)` | web search, Android helper tertentu | `query` | `ok`, `data[]` | `KARYAWAN` | - | minimum length query harus valid |

## Gate / Pabrik

| Operation | Caller | Input | Output | Read Sheet | Write Sheet | Dependency Penting |
|---|---|---|---|---|---|---|
| `submitGateRequest(payload)` | Android `gate_screen.dart` | `requestId`, `action`, payload gate (`bindKartu` / `releaseKartu`), `sessionToken` (wajib, doPost) | `ok`, `status`, `requestId`, optional hasil mutasi | `ANDROID_GATE_REQUESTS`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK`, `KARYAWAN`, `ANDROID_SESSIONS` | `ANDROID_GATE_REQUESTS`, lalu domain gate terkait | pintu masuk idempotent untuk mutasi gate Android; request lama tidak boleh dibuat ulang dengan ID baru saat koneksi putus; `doPost()` menolak tanpa `sessionToken` valid |
| `getGateRequestStatus(requestId)` | Android polling recovery | `requestId` | `ok`, `status`, `response`, `lastError` | `ANDROID_GATE_REQUESTS` | - | dipakai setelah submit sukses tapi response utama hilang atau timeout |
| `getBindingStatus(noKartuMK)` | web gate, Android gate | `noKartuMK` | `ok`, `status`, `nik`, `nama`, `dept`, `jabatan` | `BINDING_KARTU_MK`, `KARYAWAN` | - | card harus lolos `assertCard()` / `normalizeCard()` |
| `bindKartu(noKartuMK, nik, loker, lat, lng)` | web `confirmMasuk()` langsung; Android **tidak pernah** langsung, selalu lewat `submitGateRequest` | serial kartu, `nik`, `loker`, opsional geo, `sessionToken` (wajib kalau dipanggil sbg action `doPost()` Android) | `ok`, `msg`, binding context | `KARYAWAN`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | `REGISTRASI SAAT MASUK PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | memakai `withCardLock()` dan `safeUpdateRecapAbsen()` |
| `releaseKartu(noKartuMK, loker, lat, lng)` | web `confirmKeluar()` langsung; Android **tidak pernah** langsung, selalu lewat `submitGateRequest` | serial kartu, `loker`, opsional geo, `sessionToken` (wajib kalau dipanggil sbg action `doPost()` Android) | `ok`, `msg`, release context | `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | `REGISTRASI SAAT KELUAR PABRIK`, `BINDING_KARTU_MK`, `ABSEN IN OUT MK` | status kartu harus `BOUND`; keluar bergantung binding aktif |

## Area Kerja

| Operation | Caller | Input | Output | Read Sheet | Write Sheet | Dependency Penting |
|---|---|---|---|---|---|---|
| `scanAreaKerja(noKartuMK, tujuan, catatan, forceMode)` | web area, Android area | serial kartu, `tujuan`, `catatan`, `forceMode` | `ok`, `inout`, `karyawan`, `waktu`, `area`, `msg` | `BINDING_KARTU_MK`, `KARYAWAN`, `REGISTRASI MASUK KELUAR AREA KERJA`, `ABSEN IN OUT MK` | `REGISTRASI MASUK KELUAR AREA KERJA` | internal user harus masih `DI DALAM` pabrik; state IN/OUT area diturunkan dari log hari ini |
| `getRecentAreaLogs(limit)` | web area, Android area log | `limit` | `ok`, `data[]` | `REGISTRASI MASUK KELUAR AREA KERJA` | - | hanya pembacaan log terbaru |

## Dashboard Operasional & Kehadiran

| Operation | Caller | Input | Output | Read Sheet | Write Sheet | Dependency Penting |
|---|---|---|---|---|---|---|
| `getDashboardData(basis, basisValue, deptFilter, typeFilter)` | web dashboard area | basis waktu, filter dept/type | `ok`, summary area, `boundList`, `areaPopulation`, `deptPopulation`, `kanbanGroups`, `shiftCoverage` | `ABSEN IN OUT MK`, `REGISTRASI MASUK KELUAR AREA KERJA`, `KARYAWAN` | - | area dashboard menghitung orang `DI DALAM` lalu overlay log area |
| `getKehadiranDashboard(tanggal, shiftFilter, deptFilter, typeFilter, options)` | web kehadiran, Android dashboard | tanggal, filter, `detailLimit`, `anomaliLimit`, `useCache` | `ok`, `summary`, `kehadiranList`, `anomaliList`, total rows | `ABSEN IN OUT MK`, `KARYAWAN`, `JADWAL_SHIFT` | cache script | memakai `CacheService`; shift bisa berasal dari jadwal atau deteksi jam |

## Android Transport & Diagnostics

| Operation | Caller | Input | Output | Read Sheet | Write Sheet | Dependency Penting |
|---|---|---|---|---|---|---|
| `pingAndroidGateway(payload)` | `ApiService.prewarmGateway()`, `home_screen.dart` | metadata ringan: platform, session, warmup context | `ok`, `serverTime`, `message` | - | - | dipakai untuk prewarm DNS, redirect, dan TLS handshake sebelum scan pertama |
| `logAndroidDiagnostics(payload)` | `ApiService` flush telemetry | `events[]` batch diagnostik | `ok`, `accepted`, `rejected` | - | `ANDROID_DIAGNOSTICS` | event sukses/gagal koneksi Android di-buffer lokal lalu di-flush setelah request berikutnya berhasil |

## Report

| Operation | Caller | Input | Output | Read Sheet | Write Sheet | Dependency Penting |
|---|---|---|---|---|---|---|
| `getAbsenReport(nik, deptFilter, periodType, periodValue, page, pageSize, search, sort, typeFilter)` | web report, Android `absen_screen.dart` | identitas/filter/periode/paging, `typeFilter` opsional (`'' \| 'internal' \| 'outsource'`, 2026-08-17) | `ok`, rows report, summary, pagination | `ABSEN IN OUT MK`, `KARYAWAN`, `JADWAL_SHIFT` | cache jika ada | periode Android bisa di-derive dari `startDate/endDate` oleh `resolveAndroidAbsenPeriod_()`; vendor admin (PENGAWAS + type VENDOR) mengirim `deptFilter=''` + `typeFilter='outsource'` untuk lihat semua mitra kerja lintas dept, lihat `docs/GAS_ARCHITECTURE.md` domain Report |
| `getAreaActivityReport(nik, deptFilter, periodType, periodValue, page, pageSize, sortBy, sortDir, search)` | web report area, Android absen | identitas/filter/periode/paging | `ok`, rows activity area, summary, pagination | `REGISTRASI MASUK KELUAR AREA KERJA`, `KARYAWAN` | cache jika ada | data area tidak boleh memperbaiki gate recap sendiri |

## Jadwal Shift

| Operation | Caller | Input | Output | Read Sheet | Write Sheet | Dependency Penting |
|---|---|---|---|---|---|---|
| `saveJadwalShift(...)` | web jadwal | `nik`, `shift`, `tanggalMulai`, `tanggalSelesai` | `ok`, `msg` | `JADWAL_SHIFT`, `KARYAWAN` | `JADWAL_SHIFT` | mengubah coverage dashboard kehadiran |
| `deleteJadwalShift(rowIndex)` | web jadwal | `rowIndex` | `ok`, `msg` | `JADWAL_SHIFT` | `JADWAL_SHIFT` | row index harus sesuai sheet aktif |
| `getJadwalShift(deptFilter)` | web jadwal | optional dept | `ok`, `data[]` | `JADWAL_SHIFT`, `KARYAWAN` | - | dipakai untuk admin review |
| `getKaryawanExpectedForDate(tanggal)` | helper internal dashboard | `tanggal` | daftar expected per shift | `JADWAL_SHIFT`, `KARYAWAN` | - | dipakai oleh `getKehadiranDashboard()` |

## Android Router Contract

### Entry point

- `active/HOME_PORTAL/Code.js::doPost()`

### Kontrak minimum request

```json
{
  "apiKey": "<nilai Script Property ANDROID_API_KEY, rotatable — lihat getAndroidApiKey_()>",
  "action": "verifyLogin"
}
```

Action mutasi/PII (lihat daftar di bawah, ditandai 🔒) juga wajib field `sessionToken` (diterbitkan `verifyLogin`, divalidasi `requireAndroidSessionToken_()`).

### Action aktif yang harus dijaga sinkron

- `verifyLogin`
- `verifySession` (Android: `verifySessionToken_`, bukan lookup NIK)
- `getBindingStatus`
- `submitGateRequest` 🔒
- `getGateRequestStatus`
- `pingAndroidGateway`
- `logAndroidDiagnostics`
- `bindKartu` 🔒 (Android tidak pernah panggil langsung, selalu via `submitGateRequest`)
- `releaseKartu` 🔒 (sama seperti `bindKartu`)
- `scanAreaKerja` 🔒
- `getDashboardData`
- `getKehadiranDashboard`
- `getRecentAreaLogs`
- `getAreaActivityReport`
- `getAbsenReport` (+ optional `typeFilter`)
- `searchKaryawan`
- `getKaryawanByNIK` 🔒

🔒 = wajib `sessionToken` valid via `requireAndroidSessionToken_()` (ditambahkan 2026-08-17, lihat `docs/ARCHITECTURE_AUDIT_2026-08-17.md`).

## Sheet Dependency by Domain

| Sheet | Domain | Dipakai oleh |
|---|---|---|
| `KARYAWAN` | master user | auth, lookup, dashboard, report, jadwal |
| `REGISTRASI SAAT MASUK PABRIK` | log gate masuk | `bindKartu()`, rebuild recap |
| `REGISTRASI SAAT KELUAR PABRIK` | log gate keluar | `releaseKartu()`, rebuild recap |
| `REGISTRASI MASUK KELUAR AREA KERJA` | log area | `scanAreaKerja()`, `getRecentAreaLogs()`, dashboard area, report area |
| `BINDING_KARTU_MK` | state kartu aktif | `getBindingStatus()`, `bindKartu()`, `releaseKartu()`, `scanAreaKerja()` |
| `ABSEN IN OUT MK` | recap turunan | gate, dashboard kehadiran, report absen |
| `JADWAL_SHIFT` | planning shift | dashboard kehadiran, jadwal CRUD |
| `ANDROID_GATE_REQUESTS` | ledger request gate Android | `submitGateRequest()`, `getGateRequestStatus()` |
| `ANDROID_DIAGNOSTICS` | audit koneksi Android | `logAndroidDiagnostics()` |
| `ANDROID_SESSIONS` | token session Android (2026-08-17) | `generateSessionToken_()`, `validateSessionToken_()`, `verifySessionToken_()`, `cleanupExpiredAndroidSessions_()` |

## Quick Troubleshooting by Symptom

| Gejala | Cek Pertama |
|---|---|
| Login sukses lalu balik ke login | `verifyLogin()`, `verifySession()`, payload session Android/Web |
| Gate gagal masuk | `getBindingStatus()`, `bindKartu()`, serial scan, status recap hari ini |
| Area scan gagal walau kartu aktif | `scanAreaKerja()`, status pabrik `DI DALAM`, tujuan area kosong atau tidak |
| Dashboard kosong / lambat | `getDashboardData()` atau `getKehadiranDashboard()`, filter basis, cache, size payload |
| Report hasilnya tidak masuk akal | period resolver, filter dept/type, sheet recap dan area log |
