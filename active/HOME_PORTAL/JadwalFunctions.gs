// ============================================================
//  NFC DAM ACCESS CONTROL — JADWAL SHIFT FUNCTIONS
//  PT Daya Anugrah Mulya
//  Domain: Manajemen jadwal shift karyawan
//  Dependencies: SharedLib.gs
// ============================================================

// ── Ambil daftar NIK yang dijadwalkan untuk tanggal tertentu ─
/**
 * Mengembalikan array { nik, nama, dept, shift } untuk semua karyawan
 * yang terjadwal pada tanggal target.
 * Entry dengan TANGGAL_SELESAI kosong = jadwal permanen.
 * @param {string} tanggal - YYYY-MM-DD atau DD/MM/YYYY
 * @returns {{ nik, nama, dept, shift }[]}
 */
function getKaryawanExpectedForDate(tanggal) {
  try {
    const targetDate = parseIsoDate(tanggal) || parseSheetDate(tanggal);
    if (!targetDate) return [];

    const targetKey = formatDateForSort(targetDate);
    const sheet = getSheet(SHEET_JADWAL);
    const data  = sheet.getDataRange().getValues();
    // Kolom: NIK(0), NAMA(1), DEPT(2), SHIFT(3), TANGGAL_MULAI(4), TANGGAL_SELESAI(5)

    const result = [];
    const seenNik = {};

    for (let i = 1; i < data.length; i++) {
      const nik   = asText(data[i][0]).trim();
      if (!nik || seenNik[nik]) continue;

      const shift       = asText(data[i][3]).trim();
      const tanggalMulai = data[i][4];
      const tanggalSelesai = data[i][5];

      if (!shift || !tanggalMulai) continue;

      const mulaiKey   = formatDateForSort(tanggalMulai);
      const selesaiKey = tanggalSelesai ? formatDateForSort(tanggalSelesai) : '99991231';

      // Aktif jika tanggal target berada dalam rentang jadwal
      if (targetKey >= mulaiKey && targetKey <= selesaiKey) {
        seenNik[nik] = true;
        result.push({
          nik,
          nama:  asText(data[i][1]).trim(),
          dept:  asText(data[i][2]).trim(),
          shift
        });
      }
    }

    return result;
  } catch(e) {
    Logger.log('JadwalFunctions.getKaryawanExpectedForDate: ' + e.message);
    return [];
  }
}

/**
 * Versi cepat untuk batch processing — baca sheet JADWAL hanya 1x,
 * kembalikan fungsi lookup yang bekerja dari cache memori.
 * Dipakai oleh rebuildHistoricalRecapDataset_ untuk menghindari
 * ribuan kali baca sheet (tiap baris log memanggil getKaryawanExpectedForDate).
 *
 * @returns {{ getForDate: function(tanggal: string): Array }}
 */
function buildJadwalCache_() {
  try {
    const sheet = getSheet(SHEET_JADWAL);
    const data  = sheet.getDataRange().getValues();
    // Kolom: NIK(0), NAMA(1), DEPT(2), SHIFT(3), TANGGAL_MULAI(4), TANGGAL_SELESAI(5)

    // Simpan semua entri jadwal sebagai array sederhana
    const entries = [];
    for (let i = 1; i < data.length; i++) {
      const nik   = asText(data[i][0]).trim();
      const shift = asText(data[i][3]).trim();
      const mulaiRaw = data[i][4];
      const selesaiRaw = data[i][5];
      if (!nik || !shift || !mulaiRaw) continue;
      entries.push({
        nik: nik,
        nama: asText(data[i][1]).trim(),
        dept: asText(data[i][2]).trim(),
        shift: shift,
        mulaiKey: formatDateForSort(mulaiRaw) || '',
        selesaiKey: selesaiRaw ? (formatDateForSort(selesaiRaw) || '99991231') : '99991231'
      });
    }

    // Memo-cache per tanggal agar lookup O(1) setelah kunjungan pertama
    const memo = {};

    return {
      getForDate: function(tanggal) {
        try {
          const targetDate = parseIsoDate(tanggal) || parseSheetDate(tanggal);
          if (!targetDate) return [];
          const targetKey = formatDateForSort(targetDate);
          if (memo[targetKey] !== undefined) return memo[targetKey];

          const result = [];
          const seenNik = {};
          for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (seenNik[e.nik]) continue;
            if (targetKey >= e.mulaiKey && targetKey <= e.selesaiKey) {
              seenNik[e.nik] = true;
              result.push({ nik: e.nik, nama: e.nama, dept: e.dept, shift: e.shift });
            }
          }
          memo[targetKey] = result;
          return result;
        } catch(ex) {
          return [];
        }
      }
    };
  } catch(e) {
    Logger.log('buildJadwalCache_: failed - ' + e.message);
    return { getForDate: function() { return []; } };
  }
}

// ── Ambil semua entri jadwal (untuk tabel manajemen) ─────────
/**
 * @param {string} deptFilter - '' = semua dept
 * @returns {{ ok, data: [{rowIndex, nik, nama, dept, shift, tanggalMulai, tanggalSelesai}] }}
 */
function getJadwalShift(deptFilter) {
  try {
    const deptF = asText(deptFilter).trim().toUpperCase();
    const sheet = getSheet(SHEET_JADWAL);
    const data  = sheet.getDataRange().getValues();
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const nik  = asText(data[i][0]).trim();
      if (!nik) continue;

      const dept = asText(data[i][2]).trim();
      if (deptF && dept.toUpperCase() !== deptF) continue;

      result.push({
        rowIndex:      i + 1,  // 1-based sheet row
        nik,
        nama:          asText(data[i][1]).trim(),
        dept,
        shift:         asText(data[i][3]).trim(),
        tanggalMulai:  data[i][4] ? (formatDate(parseAnyDate(data[i][4])) || '') : '',
        tanggalSelesai:data[i][5] ? (formatDate(parseAnyDate(data[i][5])) || '') : ''
      });
    }

    return { ok: true, data: result };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ── Simpan / update jadwal karyawan ──────────────────────────
/**
 * Tambah entri baru atau update jika NIK + shift sudah ada.
 * @param {string} nik
 * @param {string} shift         - 'Shift 1' | 'Shift 2' | 'Shift 3'
 * @param {string} tanggalMulai  - YYYY-MM-DD
 * @param {string} tanggalSelesai - YYYY-MM-DD atau '' (permanen)
 * @returns {{ ok, msg, rowIndex }}
 */
function saveJadwalShift(nik, shift, tanggalMulai, tanggalSelesai) {
  return withDocumentLock(function() {
    try {
      const nikNorm = asText(nik).trim();
      if (!nikNorm) return { ok: false, msg: 'NIK tidak boleh kosong.' };

      const validShifts = ['Shift 1', 'Shift 2', 'Shift 3'];
      const shiftNorm = asText(shift).trim();
      if (validShifts.indexOf(shiftNorm) === -1) {
        return { ok: false, msg: 'Shift tidak valid. Gunakan: Shift 1, Shift 2, atau Shift 3.' };
      }

      const mulaiDate = parseIsoDate(tanggalMulai);
      if (!mulaiDate) return { ok: false, msg: 'Tanggal mulai tidak valid.' };

      const selesaiDate = tanggalSelesai ? parseIsoDate(tanggalSelesai) : null;

      // Lookup karyawan untuk auto-fill nama & dept
      const k = getKaryawanByNIK(nikNorm);
      const nama = k ? k.nama : nikNorm;
      const dept = k ? k.dept : '';

      const sheet = getSheet(SHEET_JADWAL);
      const data  = sheet.getDataRange().getValues();

      // Cek apakah NIK + shift sudah ada → update
      for (let i = 1; i < data.length; i++) {
        const rowNik   = asText(data[i][0]).trim();
        const rowShift = asText(data[i][3]).trim();
        if (rowNik === nikNorm && rowShift === shiftNorm) {
          const rowNum = i + 1;
          // Kunci format '@' SEBELUM setValues — kalau kebalik, Sheets auto-convert
          // string dd/MM/yyyy jadi Date beneran dan mengunci format sesudahnya tidak
          // menuliskan ulang value-nya (pola sama seperti WAKTU_BIND di GateFunctions.gs).
          applyNumberFormatToCell_(sheet, rowNum, 5, '@');
          applyNumberFormatToCell_(sheet, rowNum, 6, '@');
          sheet.getRange(rowNum, 1, 1, 6).setValues([[
            nikNorm, nama, dept, shiftNorm,
            formatDate(mulaiDate),
            selesaiDate ? formatDate(selesaiDate) : ''
          ]]);
          return { ok: true, msg: 'Jadwal ' + nama + ' (' + shiftNorm + ') diperbarui.', rowIndex: rowNum };
        }
      }

      // Belum ada → append, lalu kunci format '@' dan tulis ulang kolom tanggal —
      // appendRow() bisa saja sudah membuat Sheets auto-convert tanggal jadi Date
      // beneran sebelum baris ini sempat mengunci formatnya.
      sheet.appendRow([
        nikNorm, nama, dept, shiftNorm,
        formatDate(mulaiDate),
        selesaiDate ? formatDate(selesaiDate) : ''
      ]);
      const newRowNum = sheet.getLastRow();
      applyNumberFormatToCell_(sheet, newRowNum, 5, '@');
      sheet.getRange(newRowNum, 5).setValue(formatDate(mulaiDate));
      applyNumberFormatToCell_(sheet, newRowNum, 6, '@');
      sheet.getRange(newRowNum, 6).setValue(selesaiDate ? formatDate(selesaiDate) : '');

      return { ok: true, msg: 'Jadwal ' + nama + ' (' + shiftNorm + ') ditambahkan.', rowIndex: newRowNum };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

// ── Hapus entri jadwal berdasarkan row index ─────────────────
/**
 * @param {number} rowIndex - 1-based sheet row
 * @returns {{ ok, msg }}
 */
function deleteJadwalShift(rowIndex) {
  return withDocumentLock(function() {
    try {
      const row = parseInt(rowIndex, 10);
      if (isNaN(row) || row < 2) return { ok: false, msg: 'Row index tidak valid.' };

      const sheet   = getSheet(SHEET_JADWAL);
      const lastRow = sheet.getLastRow();
      if (row > lastRow) return { ok: false, msg: 'Baris tidak ditemukan.' };

      const rowData = sheet.getRange(row, 1, 1, 6).getValues()[0];
      const info    = asText(rowData[1]) + ' (' + asText(rowData[3]) + ')';
      sheet.deleteRow(row);

      return { ok: true, msg: 'Jadwal ' + info + ' dihapus.' };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

// ── Bulk import jadwal dari array ────────────────────────────
/**
 * Import banyak entri sekaligus — dipakai untuk setup awal.
 * Setiap item: { nik, shift, tanggalMulai, tanggalSelesai? }
 * @param {object[]} items
 * @returns {{ ok, saved, skipped, errors }}
 */
function bulkSaveJadwalShift(items) {
  try {
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, msg: 'Tidak ada data untuk disimpan.' };
    }

    let saved = 0, skipped = 0;
    const errors = [];

    items.forEach(function(item, idx) {
      const res = saveJadwalShift(
        item.nik, item.shift, item.tanggalMulai, item.tanggalSelesai || ''
      );
      if (res.ok) saved++;
      else { skipped++; errors.push('Baris ' + (idx+1) + ': ' + res.msg); }
    });

    return { ok: true, saved, skipped, errors };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}
