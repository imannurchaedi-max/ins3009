# EMPLOYE TRACKER

Google Apps Script web app untuk access control, absensi, dan tracking area kerja.

## Struktur Ringkas

- `Code.js`, `Index.html`, `app.html`, `style.html`
  Source master runtime.
- `HOME_PORTAL`
  Portal utama untuk akses module.
- `MODUL_GATE_PABRIK`, `MODUL_AREA_KERJA`, `MODUL_REPORT`
  Module deploy terpisah.
- `scripts/`
  Tool audit, deploy, dan sinkronisasi.
- `docs/`
  Dokumentasi arsitektur, hardening, dan deployment.

## Dokumen Penting

- [docs/GAS_ARCHITECTURE.md](docs/GAS_ARCHITECTURE.md)
- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)
- [docs/RUNTIME_HARDENING_2026-06-02.md](docs/RUNTIME_HARDENING_2026-06-02.md)

## Catatan Lokal

File sementara, helper patch lama, hasil audit, dan catatan kerja lokal disimpan di area yang di-ignore git agar root project tetap bersih.
