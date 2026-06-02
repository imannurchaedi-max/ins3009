# Python Audit Tooling

Repo ini memakai script Python untuk audit statis project Google Apps Script.

## Commands

- `python scripts/scan_project.py` memindai file GAS, HTML, dan JSON lalu menulis `reports/project_scan.json`.
- `python scripts/extract_functions.py` mengekstrak fungsi backend, fungsi frontend, include HTML, pemanggilan `google.script.run`, dan dependensi sheet ke `reports/function_inventory.md`.
- `python scripts/compare_gas_runtime.py` membuat ringkasan cakupan runtime GAS ke `reports/gas_runtime_comparison.json`.
- `python scripts/audit_project.py` membuat audit runtime utama di `reports/GAS_RUNTIME_AUDIT.md`.

## Scope

Script audit bersifat read-only terhadap source utama. Artifact hasil audit ditulis ke folder `reports/`.

## Current Static Mapping

Setiap audit memetakan:

- fungsi GAS backend
- caller frontend
- include HTML aktif
- konstanta dan dependensi Google Sheet
- risiko runtime karena fungsi hilang atau dependensi tidak sinkron
