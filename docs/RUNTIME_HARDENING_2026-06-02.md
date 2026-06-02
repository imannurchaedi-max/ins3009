# Runtime Hardening 2026-06-02

## Summary

Perbaikan ini menutup bug scanner external, celah bypass masuk internal, duplikasi masuk/keluar, dan hasil audit runtime yang sebelumnya salah membaca backend `.js`.

## Critical Issues Fixed

- Frontend dan backend sekarang memakai `TYPE KAYARAWAN` sebagai bagian dari source of truth `internal/external`.
- `verifyLogin()` dan `verifySession()` mengirim `type` dan `isExternal` ke frontend.
- External wajib scan kartu MK saat masuk dan tidak bisa masuk dengan NIK sebagai kartu.
- Internal hanya bisa masuk dengan NIK / ID internal sendiri.
- Internal tidak bisa keluar jika belum berstatus `DI DALAM`.
- Masuk ulang di hari yang sama ditolak jika masih `DI DALAM` atau sudah `SELESAI`.
- Input opsional cari NIK pada halaman masuk sekarang tersambung ke autocomplete list.

## Runtime Mapping

| GAS Function | Frontend Caller | Sheet Dependency | Missing / Crash Risk |
| --- | --- | --- | --- |
| `verifyLogin` | `handleLoginSubmit` | `KARYAWAN` | Covered |
| `verifySession` | Module auto-login | `KARYAWAN` | Covered |
| `searchKaryawan` | autocomplete search | `KARYAWAN` | Covered |
| `bindKartu` | `confirmMasuk` | `KARYAWAN`, `BINDING_KARTU_MK`, `REGISTRASI SAAT MASUK PABRIK`, `ABSEN IN OUT MK` | Covered |
| `getBindingStatus` | `handleKeluarScan` | `BINDING_KARTU_MK`, `KARYAWAN`, `ABSEN IN OUT MK` | Covered |
| `releaseKartu` | `confirmKeluar` | `KARYAWAN`, `BINDING_KARTU_MK`, `REGISTRASI SAAT KELUAR PABRIK`, `ABSEN IN OUT MK` | Covered |
| `scanAreaKerja` | security scan | `KARYAWAN`, `BINDING_KARTU_MK`, `REGISTRASI MASUK KELUAR AREA KERJA`, `ABSEN IN OUT MK` | Covered |

## Validation

- `node --check` passed for root and module `Code.js` files.
- `python scripts/audit_project.py` passed with no missing runtime dependencies.
- `python scripts/extract_functions.py` now extracts GAS functions from `.js`.
- `python scripts/compare_gas_runtime.py` reports `runtime_status: ok`.
