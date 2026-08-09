# Python Audit Tooling

Repo ini memakai tiga script Python utama untuk audit statis project Google Apps Script.

## Commands

- `python scripts/audit_project.py`
  Membuat audit runtime utama di `reports/GAS_RUNTIME_AUDIT.md`
- `python scripts/extract_functions.py`
  Mengekstrak fungsi backend, fungsi frontend, include HTML, pemanggilan `google.script.run`, dan dependensi sheet ke `reports/function_inventory.md`
- `python scripts/compare_gas_runtime.py`
  Membuat ringkasan cakupan runtime GAS ke `reports/gas_runtime_comparison.json`

Catatan:

- `scripts/audit_project.py` juga menulis `reports/project_scan.json`
- folder `reports/` adalah artifact generated

## Scope

Script audit bersifat read-only terhadap source project. Output audit ditulis ke `reports/`.

Interpretasi penting:

- `active/HOME_PORTAL/` tetap dibaca sebagai runtime aktif utama
- caller dari `active/MODUL_*` masih bisa muncul di artifact audit sebagai visibility jalur compatibility
- folder `Junk/` otomatis di-skip dari audit agar arsip legacy tidak mencemari mapping aktif
- artifact audit berguna untuk mapping teknis, bukan untuk menetapkan arsitektur aktif sendirian

## Current Static Mapping

Setiap audit memetakan:

- fungsi GAS backend
- caller frontend
- include HTML aktif
- konstanta dan dependensi Google Sheet
- risiko runtime karena fungsi hilang atau dependensi tidak sinkron

## Cara Membaca Hasil Audit

- mulai dari `reports/GAS_RUNTIME_AUDIT.md` untuk summary cepat
- buka `reports/function_inventory.md` jika perlu caller, include, dan sheet dependency lebih detail
- cocokkan hasil audit dengan `docs/NEURAL_MAPPING.md` untuk membedakan flow aktif vs compatibility flow

## Sumber Kebenaran

Audit hanya boleh dipakai untuk membaca source terbaru. Jangan memakai artifact audit lama sebagai dasar arsitektur tanpa generate ulang.

## Tooling Pendukung (Non-Audit)

Script berikut bukan audit statis tetapi terkait validasi project:

- `scripts/verify-config.js` (Node.js) — validasi lokal konfigurasi deployment URL
  ```bash
  npm run verify
  ```
  Memeriksa `scripts/module-config.json`: kelengkapan modul, `HOME_PORTAL` punya deployment aktif, dan tidak ada `.clasp.json` dengan `deploymentId` hardcoded. Child module tanpa binding lokal dilaporkan sebagai `WARN`, bukan dianggap runtime utama rusak. Tidak membuat network call. Dijalankan otomatis di akhir `npm run deploy`.

- `scripts/update_config_sheet.py` — bukan audit; ini adalah writer ke `CONFIG_MODUL` sheet. Dijalankan via `npm run deploy`. Mode `--verify-only` tersedia tetapi memerlukan OAuth scope Sheets API yang mungkin tidak tersedia di setup clasp biasa.
