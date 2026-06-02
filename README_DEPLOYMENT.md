# 📋 DAM NFC ACCESS CONTROL — Panduan Deployment
## PT Daya Anugrah Mulya

---

## 🏗️ STRUKTUR FILE

```
NFC_DAM_AccessControl/
├── Code.gs       ← Backend Google Apps Script
└── Index.html    ← Frontend Web App (UI)
```

---

## 🚀 LANGKAH DEPLOYMENT

### 1. Buka Google Apps Script
Buka link berikut:
👉 https://script.google.com

Klik **"New Project"** → beri nama: `DAM Access Control`

---

### 2. Paste Code.gs
- Di editor, klik file `Code.gs` (sudah ada secara default)
- **Hapus semua isi** yang ada
- **Paste seluruh isi** file `Code.gs`

---

### 3. Tambah Index.html
- Klik ikon **"+"** di panel kiri (Files)
- Pilih **"HTML"**
- Beri nama: `Index` *(PENTING: huruf kapital I, tanpa .html)*
- **Paste seluruh isi** file `Index.html`

---

### 4. Verifikasi SPREADSHEET_ID
Di baris paling atas `Code.gs`, pastikan:
```javascript
const SPREADSHEET_ID = '1ycgq-T1ly6s7UGaDxPXFIkWDcp3l55iFUXhD1V1nWuk';
```
✅ Sudah sesuai dengan link Google Sheet kamu.

---

### 5. Verifikasi Nama Sheet
Pastikan nama tab di Google Sheet PERSIS sama:
| Konstanta | Nama Tab di Sheet |
|-----------|-------------------|
| SHEET_KARYAWAN | `KARYAWAN` |
| SHEET_MASUK_PABRIK | `REGISTRASI SAAT MASUK PABRIK` |
| SHEET_KELUAR_PABRIK | `REGISTRASI SAAT KELUAR PABRIK` |
| SHEET_AREA_KERJA | `REGISTRASI MASUK KELUAR AREA KERJA` |
| SHEET_BINDING | `BINDING_KARTU_MK` ← **dibuat otomatis** |

---

### 6. Deploy sebagai Web App
1. Klik **"Deploy"** → **"New deployment"**
2. Klik ikon ⚙️ di sebelah "Select type" → pilih **"Web app"**
3. Isi:
   - **Description**: `DAM Access Control v1`
   - **Execute as**: `Me` (akun Google kamu)
   - **Who has access**: `Anyone` *(untuk akses dari HP security tanpa login)*
     atau `Anyone with Google Account` *(lebih aman)*
4. Klik **"Deploy"**
5. **Copy URL** yang diberikan — ini URL aplikasinya

---

### 7. Izin Akses (Pertama Kali)
Saat pertama deploy, Google akan minta izin akses ke Spreadsheet.
- Klik **"Authorize access"**
- Login dengan akun Google yang punya akses ke Spreadsheet
- Klik **"Allow"**

---

## 📱 CARA PAKAI DI HP/TABLET SECURITY

### Untuk NFC Scan otomatis:
- Gunakan **Android** (Chrome atau browser Chromium-based)
- Buka URL Web App via **HTTPS** (sudah otomatis dari Apps Script)
- Saat tap tombol 📡, izinkan akses NFC
- Tempelkan kartu ke belakang HP

### Untuk input manual (iOS / browser lain):
- Ketik nomor kartu MK di kolom input
- Tekan tombol **SCAN** atau **Enter**

---

## 🔄 ALUR KERJA SISTEM

```
MASUK PABRIK
─────────────
1. Karyawan pilih tab MASUK
2. Cari nama/NIK → pilih dari dropdown
3. Scan kartu MK (NFC atau manual)
4. Klik ✅ KONFIRMASI MASUK
5. Data tercatat di sheet "REGISTRASI SAAT MASUK PABRIK"
6. Kartu MK berstatus BOUND ke identitas karyawan

AREA KERJA (Security Scan)
──────────────────────────
1. Security buka tab SECURITY
2. Scan kartu MK karyawan yang lewat
3. Sistem otomatis catat IN/OUT (toggle berdasarkan log terakhir)
4. Data tercatat di sheet "REGISTRASI MASUK KELUAR AREA KERJA"

KELUAR PABRIK
─────────────
1. Karyawan pilih tab KELUAR
2. Scan kartu MK
3. Data identitas muncul otomatis (dari binding)
4. Klik 🚪 KONFIRMASI PULANG
5. Data tercatat di sheet "REGISTRASI SAAT KELUAR PABRIK"
6. Kartu MK berstatus FREE (siap dipakai orang lain)
```

---

## 🖼️ LOGO DAM

Logo diambil langsung dari Google Drive:
```
https://drive.google.com/uc?export=view&id=1whcLhiklfyZutRFIYUi6ZLweOcvJ_w0T
```

**Pastikan file logo di Google Drive:**
- Sharing: **Anyone with the link → Viewer** ✅
- Jika tidak muncul → buka link di atas di browser, jika redirect ke halaman Drive (bukan gambar), ubah permission file-nya

---

## 🔒 SHEET BINDING_KARTU_MK

Sheet ini dibuat **otomatis** saat pertama kali sistem dijalankan.
Kolom yang ada:
| Kolom | Isi |
|-------|-----|
| NO_KARTU_MK | Nomor kartu (misal: MK00160) |
| NIK | NIK karyawan |
| NAMA | Nama karyawan |
| DEPT | Departemen |
| JABATAN | Jabatan |
| WAKTU_BIND | Timestamp saat kartu diikat |
| STATUS | BOUND / FREE |

---

## ⚙️ CUSTOM SHIFT (Opsional)

Di `Code.gs`, fungsi `detectShift()` bisa disesuaikan:
```javascript
function detectShift(d) {
  const h = parseInt(Utilities.formatDate(d, 'Asia/Jakarta', 'HH'));
  if (h >= 6 && h < 14)  return 'Shift 1';   // 06:00 - 13:59
  if (h >= 14 && h < 22) return 'Shift 2';   // 14:00 - 21:59
  return 'Shift 3';                            // 22:00 - 05:59
}
```

---

## 📞 TROUBLESHOOTING

| Masalah | Solusi |
|---------|--------|
| "NFC tidak tersedia" | Pastikan pakai Android Chrome + HTTPS |
| Logo tidak muncul | Set sharing Google Drive file ke "Anyone can view" |
| "NIK tidak ditemukan" | Cek nama sheet KARYAWAN (case-sensitive) |
| Sheet tidak ditemukan | Cek konstanta nama sheet di Code.gs |
| Error saat deploy | Pastikan akun punya akses edit ke Spreadsheet |
