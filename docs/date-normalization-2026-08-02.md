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
