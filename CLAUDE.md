# CLAUDE.md — Speed_Mesin

## Project Overview

Machine speed monitoring dashboard for PT DAM / Wings Group.
PHP + PostgreSQL, Bootstrap 5 + Chart.js frontend. Local LAN deployment.

## Brain & Muscle Pattern

**Saya (Model) = Otak (the brain)**
- Analisa konteks, memahami situasi
- Tentukan keputusan & strategi
- Timbang risiko & pilih opsi terbaik
- Berikan alasan, klarifikasi, validasi sebelum eksekusi
- Tidak perlu otot untuk hal yang otot bisa jawab sendiri

**Tools / Kode = Otot (the muscle)**
- Baca & grep codebase secara masif
- Transformasi data, eksekusi keputusan
- Handle repetitive work
- Jangan minta otot berpikir — otot nurut sama otak

**Prinsip:** Jangan eksekusi sebelum otak memutuskan. Kalau otot bisa dapat data untuk menjawab, otot itu yang jawab.

---

## Shift Logic

Shift boundary (HARUS konsisten di semua file):

| Shift | Start | End | Notes |
|-------|-------|-----|-------|
| SHIFT 1 | 06:00 | 14:00 | Same day |
| SHIFT 2 | 14:00 | 22:00 | Same day |
| SHIFT 3 | 22:00 | 06:00 | Cross-midnight (next day) |

- **Wajib set** `date_default_timezone_set('Asia/Jakarta')` di `config.php` baris pertama
- Fungsi utama: `getCurrentShiftScope()` di `functions.php`
- `elapsed_min` dihitung dari selisih timestamp, bukan jam arithmetic

---

## Target Produksi

Target per shift berdasarkan SKU (di `functions.php`):

```
$TARGETS_BHP:        S1=240K, S40=240K, M1=240K, M32=240K,
                      L1=223.2K, L28=223.2K, XL1=201.6K, XL26=201.6K, XXL24=184.8K
$TARGETS_HIGH_SPEED:  S40=336K, XL26=336K, M32=384K, L28=384K
$TARGETS_AHP:         M10=144K, M1=120K, L8=120K, L1=120K, XL6=120K, XL1=120K
```

SKU lookup di `settings.php` filter by machine type (BHP/AHP) against these arrays.
Target bersifat **dynamic** — berubah sesuai SKU aktif di `sku_history` table.

---

## OEE Formula

```php
$oee = min(round(($actual_output / $target) * 100), 100);
```

Max 100%, capped. Target dari `getTargetOutput()` berdasarkan SKU mesin.

---

## Key Files

| File | Fungsi |
|------|--------|
| `config.php` | DB connection + timezone (always include first) |
| `functions.php` | Shift logic, target config, API wrappers |
| `data.php` | Main API: speed history, realtime output, shift targets |
| `speed.php` | Machine monitoring dashboard (Chart.js) |
| `settings.php` | SKU configuration per machine |
| `oee.php` | OEE monitoring page |
| `.htaccess` | Security — Xampp-compatible only (no Directory block) |

---

## Database

PostgreSQL, host=localhost, db=Speed, user=postgres.

Key tables:
- `speed_line` — per-menit speed data, kolom `created_at` (timestamp), `device_id`, `speed`
- `current_shift` — accumulator output per mesin, kolom `created_at`, `device_id`, `output`
- `sku_history` — SKU change log, kolom `device_id`, `sku_new`, `changed_at`

---

## Coding Conventions

- **No MD5 for passwords** — P1 security skipped (LAN-only deployment)
- **SKU keys di arrays = no space** (e.g., `S40`, `M32`, `L28`)
- **Device ID keys di code = no space** (e.g., `BHP1`, `AHP1`) — tapi DB tetap pakai `BHP 1` (with space)
- **API response**: gunakan `apiSuccess()` / `apiError()` dari `functions.php`
- **Session**: wajib `session_regenerate_id(true)` after successful login
- **Timezone**: HARUS `Asia/Jakarta`, di `config.php` baris pertama

---

## Important Notes

- Shift scope default di `data.php` aktif saat tidak ada parameter `hours`
- Chart style: step-line (`tension: 0`), point per menit, no fill
- Machine selector: checkbox group (not dropdown)
- ALL checkbox toggle dengan `toggleAllMachines()` + `onMachineToggle()`