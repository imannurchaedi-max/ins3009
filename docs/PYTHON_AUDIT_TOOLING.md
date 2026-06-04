# Python Audit Tooling

Repo ini memakai tiga script Python utama untuk audit statis project Google Apps Script.

## Commands

- `python scripts/audit_project.py` membuat audit runtime utama di `reports/GAS_RUNTIME_AUDIT.md`.
- `python scripts/extract_functions.py` mengekstrak fungsi backend, fungsi frontend, include HTML, pemanggilan `google.script.run`, dan dependensi sheet ke `reports/function_inventory.md`.
- `python scripts/compare_gas_runtime.py` membuat ringkasan cakupan runtime GAS ke `reports/gas_runtime_comparison.json`.

Catatan:

- `scripts/audit_project.py` juga menulis `reports/project_scan.json`.
- Folder `reports/` adalah artifact generated. Jika isinya terasa usang atau membingungkan, hapus lalu jalankan ulang tiga script di atas.

## Scope

Script audit bersifat read-only terhadap source utama. Artifact hasil audit ditulis ke folder `reports/`.

## Current Static Mapping

Setiap audit memetakan:

- fungsi GAS backend
- caller frontend
- include HTML aktif
- konstanta dan dependensi Google Sheet
- risiko runtime karena fungsi hilang atau dependensi tidak sinkron

## Sumber Kebenaran

Audit hanya boleh dipakai untuk membaca source aktif di `active/`. Jangan memakai artifact audit lama sebagai dasar arsitektur tanpa generate ulang.
