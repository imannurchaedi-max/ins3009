# AI Tooling Setup

Dokumen ini merangkum status aktivasi tooling AI dan graph untuk repo `EMPLOYE TRACKER`.

## Status Saat Ini

- `Python` aktif melalui `venv\\Scripts\\python.exe` dan virtualenv sudah diperbaiki pada Senin, 10 Agustus 2026.
- `GitNexus` aktif untuk repo ini dan status index lokal `up-to-date`.
- `Graphify` artifact tersedia di `graphify-out/`, CLI `python -m graphify` terverifikasi, dan support MCP aktif melalui package `mcp`.
- `LangGraph` aktif dan bisa diimport dari Python.
- `Karpathy` asset lokal tersedia di `skills/karpathy/` sebagai referensi eksperimen, bukan bagian runtime Apps Script.

## Verifikasi Cepat

### Python audit

```bash
venv\Scripts\python.exe scripts/audit_project.py
venv\Scripts\python.exe scripts/extract_functions.py
venv\Scripts\python.exe scripts/compare_gas_runtime.py
venv\Scripts\python.exe scripts/build_runtime_truth_report.py
```

### GitNexus

```bash
node .gitnexus/run.cjs status
node .gitnexus/run.cjs analyze
node .gitnexus/run.cjs list
```

### Graphify

```bash
venv\Scripts\python.exe -m graphify --help
venv\Scripts\python.exe -m graphify query "login" --graph graphify-out/graph.json
venv\Scripts\python.exe -m graphify.serve --help
```

### Deploy Apps Script

```bash
npm run verify
npm run deploy
```

## Paket AI yang Tervalidasi

- `langgraph`
- `langchain`
- `langchain-openai`
- `langchain-anthropic`
- `langchain-google-genai`
- `mcp`
- `openai`
- `anthropic`
- `google-generativeai`
- `sentence-transformers`
- `scikit-learn==1.7.2`

## Catatan Penting

- Virtualenv lama sempat rusak karena masih menunjuk ke path Python lama `C:\Python314\python.exe`. Perbaikan dilakukan dengan `py -3.14 -m venv --upgrade venv`.
- Package distribusi Graphify yang terpasang bernama `graphifyy`, tetapi modul dan CLI yang dipakai tetap `graphify`.
- `scikit-learn` dipin ke `1.7.2` karena versi `1.8.0` pada mesin ini sempat menghasilkan install yang kehilangan folder native `sklearn/.libs`, yang membuat `sklearn` dan `sentence-transformers` gagal import.
- `google-generativeai` saat ini bisa dipakai, tetapi library tersebut sudah berstatus deprecated dari vendor. Untuk kerja baru, lebih aman migrasi bertahap ke `google.genai` saat ada kebutuhan implementasi Gemini yang lebih aktif dipelihara.
- GitNexus sekarang bisa mengindeks repo ini karena folder project sudah memiliki `.git/`.
- Aktivasi tooling ini tidak mengubah runtime Google Apps Script di `active/`; perubahan runtime tetap harus diakhiri dengan `npm run deploy`.
