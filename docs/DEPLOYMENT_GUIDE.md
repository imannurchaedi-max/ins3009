# Deployment Guide

Panduan ini mengikuti struktur repo aktif saat ini. Semua source runtime berada di `active/HOME_PORTAL/` sebagai shell utama.

## Prasyarat

- `clasp` sudah terpasang dan login (`clasp login`)
- `node` tersedia untuk menjalankan `npm run deploy`
- `python` tersedia untuk `update_config_sheet.py`
- File `.clasp.json` per modul di `active/*/.clasp.json` sudah benar

## Deploy Utama

Cukup satu perintah dari root project:

```bash
npm run deploy
```

Yang terjadi:
1. `clasp push` untuk semua 4 modul
2. `clasp deploy -i <deploymentId>` — update in-place, **URL tidak berubah**
3. `python scripts/update_config_sheet.py` — update CONFIG_MODUL sheet

```bash
npm run push          # push code saja, tanpa update deployment (lebih cepat)
npm run deploy:force  # push --force jika ada konflik
```

## URL Permanen HOME_PORTAL

```
https://script.google.com/macros/s/AKfycbzoALF7oD-WRuyhwp22pdQ6l3fGLRJuQ-OSnb5AizG-MBcOul5m74z6Xtq-hQ5IEsqX/exec
```

URL ini **tidak pernah berubah** selama menggunakan `deploy -i`.

## Deployment IDs (module-config.json)

```json
{
  "HOME_PORTAL":       "AKfycbzoALF7oD-WRuyhwp22pdQ6l3fGLRJuQ-OSnb5AizG-MBcOul5m74z6Xtq-hQ5IEsqX",
  "MODUL_GATE_PABRIK": "AKfycbyjQ36Nlastyw1xBgzvojgX6QH2oPxB6462YKg0sELBb3gb08dYQuKHz5X_RLFntfoV9g",
  "MODUL_AREA_KERJA":  "AKfycbyu6uW7XgdZPtJysgtf3x0i3E7cxR5Hrb_dZNKYns0QJ6Lef7xzbC0mT3uP_rREHz5ypA",
  "MODUL_REPORT":      "AKfycbycdcUt4y9RdoQIOTnIzWs6AxyZe5JayFhbk6f9abnv5kr3VAWapXicdVvRGn3o53BS"
}
```

## Workflow Modifikasi

Karena semua logika terpusat di HOME_PORTAL:

| Ubah apa | Edit file | Deploy |
|----------|-----------|--------|
| Logika gate/kartu | `active/HOME_PORTAL/GateFunctions.gs` | `npm run push` |
| Logika scan area | `active/HOME_PORTAL/AreaFunctions.gs` | `npm run push` |
| Laporan | `active/HOME_PORTAL/ReportFunctions.gs` | `npm run push` |
| Utility/auth | `active/HOME_PORTAL/SharedLib.gs` | `npm run push` |
| UI/frontend | `active/HOME_PORTAL/app.html` | `npm run push` |
| Struktur halaman | `active/HOME_PORTAL/Index.html` | `npm run push` |

Gunakan `npm run push` untuk update code tanpa versioning baru.
Gunakan `npm run deploy` untuk deployment resmi (tetap URL sama).

## Smoke Test Setelah Deploy

1. Buka URL HOME_PORTAL
2. Login sebagai tiap role (KARYAWAN, SECURITY, PENGAWAS, ADMINISTRATOR)
3. Pastikan default tab sesuai role
4. Coba tab MASUK → scan kartu
5. Coba tab SCAN AREA → pilih area → scan
6. Coba tab CEK ABSEN → proses tanpa NIK (SECURITY) dan dengan NIK (KARYAWAN)
7. Pastikan URL **tidak berubah** saat pindah antar tab

## Aturan Operasional

- Jangan deploy dari file root lama jika ada duplikasi dengan `active/`.
- Jangan jadikan file di `reports/` sebagai dasar keputusan deploy.
- Selalu gunakan `deploy -i` (via npm scripts) — jangan `clasp deploy` langsung tanpa `-i`.
- Setelah perubahan structure sheet, perbarui `SharedLib.gs` (SHEET_HEADERS) sebelum deploy.
- Update dokumentasi di `docs/` setiap ada perubahan arsitektur atau deployment.

## Update CONFIG_MODUL Manual (jika perlu)

```bash
python scripts/update_config_sheet.py \
  --gate-url "https://script.google.com/macros/s/<GATE_ID>/exec" \
  --area-url "https://script.google.com/macros/s/<AREA_ID>/exec" \
  --report-url "https://script.google.com/macros/s/<REPORT_ID>/exec"
```

Catatan: Jika Sheets API disabled, script ini punya fallback temporary GAS injector otomatis.
