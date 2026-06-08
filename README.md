# EMPLOYE TRACKER

Google Apps Script web app untuk access control, absensi, dan tracking area kerja berbasis Google Sheets.

## Source of Truth

Source runtime yang aktif saat ini berada di folder [`active/`](./active).

- `active/Code.js`, `active/Index.html`, `active/app.html`, `active/style.html`
  Runtime utama untuk aplikasi induk.
- `active/HOME_PORTAL`
  Portal masuk dan router antar modul. URL-nya diperlakukan tetap.
- `active/MODUL_GATE_PABRIK`
  Modul masuk, keluar, dan cek absen pabrik.
- `active/MODUL_AREA_KERJA`
  Modul scan area kerja.
- `active/MODUL_REPORT`
  Modul laporan.

Folder root masih dapat berisi artefak transisi, tooling, atau file lama. Untuk audit, edit, dan deploy, utamakan struktur di `active/`.

## Struktur Ringkas

- `active/`
  Canonical runtime source untuk seluruh modul GAS.
- `scripts/`
  Tool audit, deploy, sinkronisasi, dan update `CONFIG_MODUL`.
- `docs/`
  Dokumentasi arsitektur, deployment, hardening runtime, dan riwayat proyek.
- `_local/`
  Catatan atau helper lokal yang tidak ikut version control.

## Urutan Baca yang Disarankan

Jika ingin cepat paham repo ini, baca urutannya seperti ini:

1. `README.md`
2. `docs/GAS_ARCHITECTURE.md`
3. `docs/DEPLOYMENT_GUIDE.md`
4. `active/`

Yang tidak perlu dijadikan sumber kebenaran arsitektur:

- `reports/`
  Hanya artifact audit yang boleh dihapus dan di-generate ulang.
- `_local/`
  Catatan kerja lokal.
- folder environment seperti `node_modules/` dan `venv/`

## Dokumen Penting

- [docs/GAS_ARCHITECTURE.md](docs/GAS_ARCHITECTURE.md)
- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)
- [docs/RUNTIME_HARDENING_2026-06-02.md](docs/RUNTIME_HARDENING_2026-06-02.md)
- [docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md)
- [docs/PYTHON_AUDIT_TOOLING.md](docs/PYTHON_AUDIT_TOOLING.md)

## Workflow Singkat

1. Edit source di `active/`.
2. Jalankan audit:
   - `python scripts/audit_project.py`
   - `python scripts/extract_functions.py`
   - `python scripts/compare_gas_runtime.py`
3. Deploy modul lewat `scripts/deploy_all.py`.
4. `HOME_PORTAL` tidak ikut auto-deploy biasa. Jika perlu update, gunakan `scripts/deploy_home_fixed.py` agar URL tetap.
5. Pastikan `CONFIG_MODUL` ikut diperbarui oleh `scripts/update_config_sheet.py` tanpa menimpa baris `HOME_PORTAL`.
6. Verifikasi URL deploy aktif dan smoke test role utama.

## Catatan Lokal

File sementara, hasil audit, dan catatan kerja lokal disimpan di area yang di-ignore git agar root project tetap bersih. Jika suatu saat report atau cache terasa menyesatkan, hapus dan generate ulang dari script audit resmi.
