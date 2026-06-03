# Update Log — 2026-05-18

---

## 1. Stop Event Detection System (BARU)

### `data.php` — Stop event analysis (MODE B shift scope)

**Logic:**
- Stop dimulai saat `speed = 0` ≥ 1 record consecutive
- Stop selesai saat `speed > 200` PPM (threshold)
- `speed 1-200` = grace period, stop tetap aktif
- Setiap stop event di-track dalam array → hitung total count
- `last_stop` = stop paling akhir, `end = null` jika masih ongoing

**Return JSON:**
```json
"stop_events": {
  "BHP 1": { "count": 2, "last_stop": {...}, "all_stops": [...] },
  "BHP 2": { "count": 0, "last_stop": null, "all_stops": [] }
}
```

**Key per mesin:**
- `count` — berapa kali mesin stop dalam shift
- `last_stop.start` — jam mulai stop
- `last_stop.end` — jam selesai stop (null kalau masih berlangsung)
- `last_stop.duration` — durasi dalam menit

---

### `speed.php` — Stop indicator badge

**UI:** Badge baru muncul di bawah status badge per mesin:
```
🛑 STOP: 06:25 (22 menit (sedang berlangsung)) | Count: 3x
```

**Visual:** Badge merah `#e74c3c` pada background `#fff5f5`

**Kondisi tampil:** Hanya di MODE B (shift scope), jika ada stop event

---

## 2. Chart Red Flash — Machine Off Indicator (BARU)

### `speed.php`

**Logic:** Jika `ppmVal === 0` → canvas area berubah merah

**CSS:**
```css
.chart-off-bg     { background: #fff5f5 !important; }  /* pink */
.chart-off-border { box-shadow: inset 0 0 0 2px #e74c3c; border-radius: 8px; }
```

**HTML wrapper:**
```html
<div id="chart_bg_${m.id}" style="...transition...">
    <canvas id="chart_${m.id}"></canvas>
</div>
```

**Trigger:** Setiap `updateData()` (30 detik) — dinamis, hidup/mati sesuai PPM terkini

---

## 3. Locale Fix

### `speed.php`

| Sebelum | Sesudah |
|---------|---------|
| `ongoing` | `sedang berlangsung` |
| `min` | `menit` |

---

## Files to Deploy

| File | Perubahan |
|------|-----------|
| `data.php` | Stop event analysis + return `stop_events` |
| `speed.php` | Stop badge + red flash chart + locale fix |

---

## Files Already Modified This Session (reference)

| File | Perubahan |
|------|-----------|
| `config.php` | `date_default_timezone_set('Asia/Jakarta')` |
| `functions.php` | Shift 3 cross-midnight fix + timestamp-based elapsed |
| `get_oee_data.php` | Shift sort boundary fix: 07:00→06:00, 15:01→14:00 |
| `export_oee.php` | Definisikan `$month`, `$year`, `$months_name` + guard clause |
| `tv_dashboard.php` | Hapus redundant `include 'config.php'` |
| `index.php` | SKU fallback `null` → `'N/A'` |
| `.htaccess` | Xampp-compatible rewrite (no Directory block) |

---

## Known Issues

- `CODE-0` SKU masih muncul di beberapa mesin → perlu set SKU manual via `settings.php` atau buat SKU calendar system
- Target display 340,000 yang tidak sesuai config → perlu verify semua file sudah di-copy ke host