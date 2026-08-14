# Date Normalization Guardrail

Tanggal operasional DAM Access Control sekarang memakai basis tunggal `dd/MM/yyyy`.

Aturan yang dipasang pada runtime:
- input slash-date tetap memprioritaskan `dd/MM/yyyy`
- fallback `MM/dd/yyyy` hanya dipakai sebagai translasi otomatis untuk data operasional
- translasi fallback hanya diterima jika hasil tanggal masih masuk jendela operasional aplikasi
- parser locale-implicit seperti `new Date("07/01/2026")` tidak lagi dipakai
- sheet operasional dan recap harus menyimpan tanggal sebagai native date, bukan string

Jendela validasi operasional:
- tanggal minimum: `25/04/2026`
- tanggal maksimum: `hari ini + 2 hari`

Sheet yang wajib mengikuti guardrail ini:
- `REGISTRASI SAAT MASUK PABRIK`
- `REGISTRASI SAAT KELUAR PABRIK`
- `REGISTRASI MASUK KELUAR AREA KERJA`
- `BINDING_KARTU_MK`
- `ABSEN IN OUT MK`

Konsekuensi:
- recap lama yang sudah tercemar string ambigu harus dibangun ulang dari log sumber
- dashboard, export, dan review harus membaca hasil recap yang sudah dinormalisasi

## Update 2026-08-14 — write-order bug & auto-repair terjadwal

Root cause drift berulang di `BINDING_KARTU_MK` (WAKTU_BIND/WAKTU_RELEASE tampil
tidak konsisten, mis. `05:39:48` vs `5:51:56`): beberapa write site menulis nilai
tanggal dulu baru mengunci `setNumberFormat('@')` sesudahnya. Google Sheets sudah
keburu auto-convert string tanggal jadi Date beneran saat ditulis — mengunci
format `@` belakangan tidak menuliskan ulang value-nya, jadi sel tetap Date-typed
dan ditampilkan pakai format locale default Sheets, bukan `CANONICAL_FACTORY_DT_FORMAT`.

Diperbaiki di `GateFunctions.gs` (`bindKartu`, `releaseKartu`,
`submitGateRequest`/`processGateRequestById_`): format `@` selalu dikunci
**sebelum** nilai ditulis (atau nilainya ditulis ulang setelah format dikunci,
kalau row-nya baru dibuat lewat `appendRow`). Ini mencegah drift baru, tapi tidak
memperbaiki baris lama yang sudah kadung tercemar.

**Auto-repair terjadwal** ditambahkan sebagai jaring pengaman berkelanjutan:
menu *DAM Access Control → ⏰ Aktifkan Auto-Repair Malam Hari* memasang
time-driven trigger (`ScriptApp.newTrigger`, handler
`runNightlyDataRepairJob_` di `DataRepairUtils.gs`) yang menjalankan
`fixAllSpreadsheetErrorsNow_()` — versi headless dari "Fix & Clean All
Spreadsheet Errors" — otomatis tiap hari jam 02:00 WIB (`appsscript.json`
timeZone = `Asia/Jakarta`). Dijadwalkan malam hari secara sengaja supaya
`withDocumentLock` yang dipakai job ini tidak bentrok dengan lock antrian gate
scan yang aktif di jam operasional pabrik. Nonaktifkan lewat menu
*🌙 Nonaktifkan Auto-Repair Malam Hari* bila perlu. Trigger harus dipasang
manual sekali lewat menu (bukan auto-install di `onOpen`) karena pembuatan
trigger butuh otorisasi OAuth yang tidak bisa diminta dari simple trigger.
