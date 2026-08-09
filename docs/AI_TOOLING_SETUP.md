# AI Tooling Setup

Dokumen ini merangkum status aktivasi tooling AI dan graph untuk repo `EMPLOYE TRACKER`.

## Status Saat Ini

- `Python` aktif dan dapat menjalankan script audit project.
- `GitNexus` aktif untuk repo ini setelah inisialisasi git lokal dan indexing.
- `Graphify` artifact sudah tersedia di `graphify-out/`.
- `LangGraph` aktif dan bisa diimport dari Python.
- `Karpathy` asset lokal tersedia di `skills/karpathy/` sebagai referensi eksperimen, bukan bagian runtime Apps Script.

## Verifikasi Cepat

### Python audit

```bash
python scripts/audit_project.py
python scripts/extract_functions.py
python scripts/compare_gas_runtime.py
```

### GitNexus

```bash
npx gitnexus status
npx gitnexus analyze
npx gitnexus list
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
- `openai`
- `anthropic`
- `google-generativeai`

## Catatan Penting

- `google-generativeai` saat ini bisa dipakai, tetapi library tersebut sudah berstatus deprecated dari vendor. Untuk kerja baru, lebih aman migrasi bertahap ke `google.genai` saat ada kebutuhan implementasi Gemini yang lebih aktif dipelihara.
- GitNexus sekarang bisa mengindeks repo ini karena folder project sudah memiliki `.git/`.
- Aktivasi tooling ini tidak mengubah runtime Google Apps Script di `active/`; perubahan runtime tetap harus diakhiri dengan `npm run deploy`.
