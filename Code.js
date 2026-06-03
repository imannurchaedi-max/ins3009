// ============================================================
//  NFC DAM ACCESS CONTROL SYSTEM
//  PT Daya Anugrah Mulya
//  Google Apps Script - Backend
//  Updated: Trigger Push
// ============================================================

const SPREADSHEET_ID = '1jTsZixaANJd8Ijs3f66LwbXSBC9UcRoALLolEvxiz40';
const SHEET_KARYAWAN          = 'KARYAWAN';
const SHEET_MASUK_PABRIK      = 'REGISTRASI SAAT MASUK PABRIK';
const SHEET_KELUAR_PABRIK     = 'REGISTRASI SAAT KELUAR PABRIK';
const SHEET_AREA_KERJA        = 'REGISTRASI MASUK KELUAR AREA KERJA';
const SHEET_BINDING           = 'BINDING_KARTU_MK';
const SHEET_RECAP_ABSEN       = 'ABSEN IN OUT MK';

const SHEET_HEADERS = {
  [SHEET_KARYAWAN]: ['NIK','NAMA','TYPE KAYARAWAN','DEPT','JABATAN','USER LEVEL','PASSWORD'],
  [SHEET_MASUK_PABRIK]: ['NO KARTU MK','NIK','NAMA','TANGGAL','JAM MASUK','SHIFT'],
  [SHEET_KELUAR_PABRIK]: ['NO KARTU MK','NIK','NAMA','TANGGAL','JAM KELUAR','SHIFT'],
  [SHEET_AREA_KERJA]: ['NO KARTU MK','INOUT','TANGGAL','JAM CATAT','NIK','NAMA','TUJUAN','CATATAN'],
  [SHEET_BINDING]: ['NO_KARTU_MK','NIK','NAMA','DEPT','JABATAN','WAKTU_BIND','STATUS'],
  [SHEET_RECAP_ABSEN]: ['TANGGAL','NIK','NAMA','DEPARTEMEN','JABATAN','JAM MASUK','JAM KELUAR','STATUS','NO KARTU MK','NO LOKER']
};

const OPTIONAL_SHEET_HEADERS = {
  [SHEET_BINDING]: ['WAKTU_RELEASE'],
  [SHEET_MASUK_PABRIK]: ['NO LOKER'],
  [SHEET_KELUAR_PABRIK]: ['NO LOKER']
};

// ============================================================
//  ENTRY POINT - Web App
// ============================================================
function doGet(e) {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('DAM Access Control')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('DAM Access Control')
      .addItem('Generate Ulang Recap Absen', 'rebuildRecapAbsenInOutMK')
      .addToUi();
  } catch(e) {
    Logger.log('Menu spreadsheet tidak tersedia: ' + e.message);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
//  UTILITAS
// ============================================================
function asText(value) {
  return value === null || value === undefined ? '' : value.toString();
}

function normalizeHeader(value) {
  return asText(value).trim().toUpperCase().replace(/[\s_]+/g, '');
}

function normalizeCard(value) {
  return asText(value).trim().toUpperCase();
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureHeader(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return;
  }

  const range = sheet.getRange(1, 1, 1, headers.length);
  let existing = range.getValues()[0].map(asText);
  const writable = [];

  headers.forEach(function(header, index) {
    const current = existing[index];
    if (!normalizeHeader(current) && header) {
      writable.push({ col: index + 1, value: header });
      existing[index] = header;
    }
  });

  writable.forEach(function(item) {
    sheet.getRange(1, item.col).setValue(item.value);
  });

  const mismatches = [];
  headers.forEach(function(header, index) {
    if (normalizeHeader(existing[index]) !== normalizeHeader(header)) {
      mismatches.push(
        'kolom ' + (index + 1) + ' aktual "' + (existing[index] || '-') + '", harus "' + header + '"'
      );
    }
  });
  if (mismatches.length) {
    throw new Error('Header sheet tidak sesuai: ' + sheet.getName() + ' (' + mismatches.join('; ') + ')');
  }
}

function ensureOptionalHeaders(sheet, headers) {
  if (!headers || !headers.length) return;

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(asText);
  const normalized = currentHeaders.map(normalizeHeader);

  headers.forEach(function(header) {
    if (normalized.indexOf(normalizeHeader(header)) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      normalized.push(normalizeHeader(header));
    }
  });
}

function getHeaderIndex(sheet, header) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(normalizeHeader);
  return headers.indexOf(normalizeHeader(header)) + 1;
}

function getSheet(name) {
  const ss = getSpreadsheet();
  const headers = SHEET_HEADERS[name];
  if (!headers) throw new Error('Sheet tidak terdaftar: ' + name);

  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  ensureHeader(sheet, headers);
  ensureOptionalHeaders(sheet, OPTIONAL_SHEET_HEADERS[name]);
  return sheet;
}

function nowWIB() {
  return new Date();
}

function formatDate(d) {
  return Utilities.formatDate(d, 'Asia/Jakarta', 'dd/MM/yyyy');
}

function formatTime(d) {
  return Utilities.formatDate(d, 'Asia/Jakarta', 'HH:mm:ss');
}

function formatDateTime(d) {
  return Utilities.formatDate(d, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
}

function parseIsoDate(value) {
  const parts = asText(value).trim().split('-').map(function(part) { return parseInt(part, 10); });
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function parseSheetDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = asText(value).trim();
  let parts = text.split('/');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  parts = text.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function formatDateForSort(value) {
  const d = parseSheetDate(value);
  return d ? Utilities.formatDate(d, 'Asia/Jakarta', 'yyyyMMdd') : asText(value);
}

function getPeriodRange(periodType, periodValue) {
  const type = asText(periodType).trim().toLowerCase();
  const value = asText(periodValue).trim();
  let start;
  let end;

  if (type === 'date') {
    start = parseIsoDate(value);
    if (!start) throw new Error('Tanggal tidak valid.');
    end = new Date(start);
  } else if (type === 'month') {
    const parts = value.split('-').map(function(part) { return parseInt(part, 10); });
    if (parts.length !== 2 || parts.some(isNaN)) throw new Error('Bulan tidak valid.');
    start = new Date(parts[0], parts[1] - 1, 1);
    end = new Date(parts[0], parts[1], 0);
  } else if (type === 'week') {
    const match = value.match(/^(\d{4})-W(\d{2})$/);
    if (!match) throw new Error('Minggu tidak valid.');
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    start = new Date(jan4);
    start.setDate(jan4.getDate() - jan4Day + 1 + ((week - 1) * 7));
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else {
    throw new Error('Tipe periode tidak dikenal.');
  }

  return {
    type,
    value,
    start,
    end,
    label: formatDate(start) + ' - ' + formatDate(end)
  };
}

function isDateInRange(value, range) {
  const date = parseSheetDate(value);
  if (!date) return false;
  return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
}

function detectShift(d) {
  const h = parseInt(Utilities.formatDate(d, 'Asia/Jakarta', 'HH'), 10);
  if (h >= 6 && h < 14)  return 'Shift 1';
  if (h >= 14 && h < 22) return 'Shift 2';
  return 'Shift 3';
}

function withDocumentLock(work) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, msg: 'Sistem sedang memproses scan lain. Coba lagi beberapa detik.' };
  }
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}

function assertCard(noKartuMK) {
  const no = normalizeCard(noKartuMK);
  if (!no) throw new Error('Nomor kartu MK kosong.');
  if (!/^[A-Z0-9_-]{3,32}$/.test(no)) throw new Error('Format nomor kartu MK / NIK tidak valid.');
  return no;
}

function isExternalKaryawan(karyawan) {
  const marker = [
    karyawan && karyawan.type,
    karyawan && karyawan.dept,
    karyawan && karyawan.jabatan
  ].join(' ').toUpperCase();

  return [
    'MITRA',
    'VISITOR',
    'TAMU',
    'EXTERNAL',
    'EKSTERNAL',
    'VENDOR',
    'KONTRAKTOR',
    'OUTSOURCE',
    'OUTSOURCING'
  ].some(function(keyword) {
    return marker.indexOf(keyword) !== -1;
  });
}

function makeKaryawanPayload(k) {
  const role = k.userLevel || 'KARYAWAN';
  return {
    nik: k.nik,
    nama: k.nama,
    type: k.type,
    dept: k.dept,
    jabatan: k.jabatan,
    role: role,
    isExternal: isExternalKaryawan(k)
  };
}

function getAvailableDepts(karyawanMap) {
  const deptSet = {};
  const availableDepts = [];
  for (const key in karyawanMap) {
    const d = (karyawanMap[key].dept || '').trim();
    if (d && !deptSet[d]) {
      deptSet[d] = true;
      availableDepts.push(d);
    }
  }
  availableDepts.sort();
  return availableDepts;
}

function getFactoryRecapStatus(nik, tanggal) {
  const sheet = getSheet(SHEET_RECAP_ABSEN);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return '';

  const key = makeRecapKey(tanggal, nik);
  const data = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS[SHEET_RECAP_ABSEN].length).getValues();
  for (let i = 0; i < data.length; i++) {
    if (makeRecapKey(data[i][0], data[i][1]) === key) {
      return asText(data[i][7]);
    }
  }
  return '';
}

function getKaryawanMapByNIK() {
  const sheet = getSheet(SHEET_KARYAWAN);
  const data = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < data.length; i++) {
    const nik = asText(data[i][0]).trim();
    if (!nik) continue;
    map[nik] = {
      nik,
      nama: asText(data[i][1]),
      type: asText(data[i][2]),
      dept: asText(data[i][3]),
      jabatan: asText(data[i][4]),
      userLevel: asText(data[i][5]).toUpperCase(),
      password: asText(data[i][6])
    };
  }

  return map;
}

function verifyLogin(nik, password) {
  const karyawanMap = getKaryawanMapByNIK();
  const k = karyawanMap[nik];
  
  if (!k) {
    return { ok: false, msg: 'NIK tidak ditemukan di database.' };
  }
  
  // Jika di database ada password yang diset, cocokkan.
  if (k.password && k.password !== password) {
    return { ok: false, msg: 'Password salah.' };
  }
  
  return { 
    ok: true, 
    karyawan: makeKaryawanPayload(k),
    depts: getAvailableDepts(karyawanMap)
  };
}

function verifySession(nik) {
  const karyawanMap = getKaryawanMapByNIK();
  const k = karyawanMap[nik];

  if (!k) {
    return { ok: false, msg: 'NIK tidak ditemukan di database.' };
  }

  return {
    ok: true,
    karyawan: makeKaryawanPayload(k),
    depts: getAvailableDepts(karyawanMap)
  };
}

function getRecapStatus(jamMasuk, jamKeluar) {
  if (jamMasuk && jamKeluar) return 'SELESAI';
  if (jamMasuk) return 'DI DALAM';
  if (jamKeluar) return 'KELUAR TANPA MASUK';
  return '';
}

function makeRecapKey(tanggal, nik) {
  return asText(tanggal).trim() + '|' + asText(nik).trim();
}

function updateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker) {
  const sheet = getSheet(SHEET_RECAP_ABSEN);
  const lastRow = sheet.getLastRow();
  const key = makeRecapKey(tanggal, nik);
  let targetRow = 0;
  let existingJamMasuk = '';
  let existingJamKeluar = '';

  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS[SHEET_RECAP_ABSEN].length).getValues();
    for (let i = 0; i < data.length; i++) {
      if (makeRecapKey(data[i][0], data[i][1]) === key) {
        targetRow = i + 2;
        existingJamMasuk = asText(data[i][5]);
        existingJamKeluar = asText(data[i][6]);
        if (!noKartuMK && data[i][8]) noKartuMK = asText(data[i][8]);
        if (!noLoker && data[i][9]) noLoker = asText(data[i][9]);
        break;
      }
    }
  }

  const finalJamMasuk = jamMasuk ? (existingJamMasuk && existingJamMasuk < jamMasuk ? existingJamMasuk : jamMasuk) : existingJamMasuk;
  const finalJamKeluar = jamKeluar ? (existingJamKeluar && existingJamKeluar > jamKeluar ? existingJamKeluar : jamKeluar) : existingJamKeluar;
  const row = [
    asText(tanggal),
    asText(nik),
    asText(nama),
    asText(dept),
    asText(jabatan),
    finalJamMasuk,
    finalJamKeluar,
    getRecapStatus(finalJamMasuk, finalJamKeluar),
    asText(noKartuMK || ''),
    asText(noLoker || '')
  ];

  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function safeUpdateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker) {
  try {
    updateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker);
  } catch(e) {
    Logger.log('Gagal update recap ABSEN IN OUT MK: ' + e.message);
  }
}

function rebuildRecapAbsenInOutMK() {
  return withDocumentLock(function() {
    try {
      const recapSheet = getSheet(SHEET_RECAP_ABSEN);
      const karyawanMap = getKaryawanMapByNIK();
      const recap = {};

      const masukData = getSheet(SHEET_MASUK_PABRIK).getDataRange().getValues();
      for (let i = 1; i < masukData.length; i++) {
        const tanggal = asText(masukData[i][3]).trim();
        const jam = asText(masukData[i][4]).trim();
        const nik = asText(masukData[i][1]).trim();
        if (!tanggal || !nik) continue;

        const key = makeRecapKey(tanggal, nik);
        const kar = karyawanMap[nik] || {};
        if (!recap[key]) {
          recap[key] = {
            tanggal,
            nik,
            nama: asText(masukData[i][2]) || asText(kar.nama),
            dept: asText(kar.dept),
            jabatan: asText(kar.jabatan),
            jamMasuk: '',
            jamKeluar: '',
            noKartuMK: asText(masukData[i][0]),
            noLoker: asText(masukData[i][6])
          };
        }
        if (!recap[key].jamMasuk || jam < recap[key].jamMasuk) recap[key].jamMasuk = jam;
        if (!recap[key].noKartuMK) recap[key].noKartuMK = asText(masukData[i][0]);
        if (!recap[key].noLoker) recap[key].noLoker = asText(masukData[i][6]);
      }

      const keluarData = getSheet(SHEET_KELUAR_PABRIK).getDataRange().getValues();
      for (let i = 1; i < keluarData.length; i++) {
        const tanggal = asText(keluarData[i][3]).trim();
        const jam = asText(keluarData[i][4]).trim();
        const nik = asText(keluarData[i][1]).trim();
        if (!tanggal || !nik) continue;

        const key = makeRecapKey(tanggal, nik);
        const kar = karyawanMap[nik] || {};
        if (!recap[key]) {
          recap[key] = {
            tanggal,
            nik,
            nama: asText(keluarData[i][2]) || asText(kar.nama),
            dept: asText(kar.dept),
            jabatan: asText(kar.jabatan),
            jamMasuk: '',
            jamKeluar: '',
            noKartuMK: asText(keluarData[i][0]),
            noLoker: ''
          };
        }
        if (!recap[key].jamKeluar || jam > recap[key].jamKeluar) recap[key].jamKeluar = jam;
        if (!recap[key].noKartuMK) recap[key].noKartuMK = asText(keluarData[i][0]);
      }

      const rows = Object.keys(recap)
        .sort()
        .map(function(key) {
          const r = recap[key];
          return [
            r.tanggal,
            r.nik,
            r.nama,
            r.dept,
            r.jabatan,
            r.jamMasuk,
            r.jamKeluar,
            getRecapStatus(r.jamMasuk, r.jamKeluar),
            r.noKartuMK,
            r.noLoker
          ];
        });

      if (recapSheet.getLastRow() > 1) {
        recapSheet.getRange(2, 1, recapSheet.getLastRow() - 1, SHEET_HEADERS[SHEET_RECAP_ABSEN].length).clearContent();
      }
      if (rows.length) {
        recapSheet.getRange(2, 1, rows.length, SHEET_HEADERS[SHEET_RECAP_ABSEN].length).setValues(rows);
      }
      recapSheet.autoResizeColumns(1, SHEET_HEADERS[SHEET_RECAP_ABSEN].length);

      return { ok: true, rows: rows.length, msg: 'Recap ABSEN IN OUT MK berhasil digenerate.' };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

function syncRecapAbsenInOutMK() {
  return rebuildRecapAbsenInOutMK();
}

function getAbsenReport(nik, deptFilter, periodType, periodValue) {
  try {
    const targetNik = asText(nik).trim();
    const filterDpt = asText(deptFilter).trim();
    if (!targetNik && !filterDpt) return { ok: false, msg: 'Kriteria pencarian (NIK atau Departemen) wajib diisi.' };

    const range = getPeriodRange(periodType, periodValue);
    const sheet = getSheet(SHEET_RECAP_ABSEN);
    const data = sheet.getDataRange().getValues();
    const rows = [];
    let complete = 0;
    let active = 0;

    for (let i = 1; i < data.length; i++) {
      const rowNik = asText(data[i][1]).trim();
      const rowDept = asText(data[i][3]).trim();
      
      if (!isDateInRange(data[i][0], range)) continue;
      if (targetNik && rowNik !== targetNik) continue;
      if (filterDpt && rowDept !== filterDpt) continue;

      const status = asText(data[i][7]);
      if (status === 'SELESAI') complete++;
      if (status === 'DI DALAM') active++;

      rows.push({
        tanggal: asText(data[i][0]),
        nik: rowNik,
        nama: asText(data[i][2]),
        dept: asText(data[i][3]),
        jabatan: asText(data[i][4]),
        jamMasuk: asText(data[i][5]),
        jamKeluar: asText(data[i][6]),
        status,
        noKartuMK: asText(data[i][8]),
        noLoker: asText(data[i][9]),
        sortKey: formatDateForSort(data[i][0])
      });
    }

    rows.sort(function(a, b) {
      return a.sortKey === b.sortKey ? a.jamMasuk.localeCompare(b.jamMasuk) : a.sortKey.localeCompare(b.sortKey);
    });
    rows.forEach(function(row) { delete row.sortKey; });

    return {
      ok: true,
      period: range.label,
      total: rows.length,
      complete,
      active,
      data: rows
    };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function getAreaActivityReport(nik, deptFilter, periodType, periodValue) {
  try {
    const targetNik = asText(nik).trim();
    const filterDpt = asText(deptFilter).trim();
    if (!targetNik && !filterDpt) return { ok: false, msg: 'Kriteria pencarian (NIK atau Departemen) wajib diisi.' };

    const range = getPeriodRange(periodType, periodValue);
    const sheet = getSheet(SHEET_AREA_KERJA);
    const data = sheet.getDataRange().getValues();
    const rows = [];
    let inCount = 0;
    let outCount = 0;

    const karyawanMap = getKaryawanMapByNIK();

    for (let i = 1; i < data.length; i++) {
      const rowNik = asText(data[i][4]).trim();
      if (!isDateInRange(data[i][2], range)) continue;
      
      if (targetNik && rowNik !== targetNik) continue;
      
      const employee = karyawanMap[rowNik] || {};
      const rowDept = asText(employee.dept).trim();
      
      if (filterDpt && rowDept !== filterDpt) continue;

      const inout = asText(data[i][1]);
      if (inout === 'IN') inCount++;
      if (inout === 'OUT') outCount++;

      rows.push({
        noKartuMK: normalizeCard(data[i][0]),
        inout,
        tanggal: asText(data[i][2]),
        jam: asText(data[i][3]),
        nik: rowNik,
        nama: asText(data[i][5]) || asText(employee.nama),
        dept: asText(employee.dept),
        jabatan: asText(employee.jabatan),
        sortKey: formatDateForSort(data[i][2]) + asText(data[i][3])
      });
    }

    rows.sort(function(a, b) { return a.sortKey.localeCompare(b.sortKey); });
    rows.forEach(function(row) { delete row.sortKey; });

    return {
      ok: true,
      period: range.label,
      total: rows.length,
      inCount,
      outCount,
      data: rows
    };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
//  1. LOOKUP KARYAWAN
// ============================================================
function searchKaryawan(query) {
  try {
    const sheet = getSheet(SHEET_KARYAWAN);
    const data  = sheet.getDataRange().getValues();
    const q     = asText(query).toLowerCase().trim();
    const result = [];

    if (q.length < 2) return { ok: true, data: [] };

    for (let i = 1; i < data.length; i++) {
      const nik     = asText(data[i][0]);
      const nama    = asText(data[i][1]);
      const type    = asText(data[i][2]);
      const dept    = asText(data[i][3]);
      const jabatan = asText(data[i][4]);

      if (nik.toLowerCase().includes(q) || nama.toLowerCase().includes(q)) {
        result.push({ nik, nama, type, dept, jabatan, isExternal: isExternalKaryawan({ type, dept, jabatan }) });
        if (result.length >= 20) break;
      }
    }
    return { ok: true, data: result };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function getKaryawanByNIK(nik) {
  const target = asText(nik).trim();
  if (!target) return null;

  const sheet = getSheet(SHEET_KARYAWAN);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (asText(data[i][0]).trim() === target) {
      return {
        nik: asText(data[i][0]),
        nama: asText(data[i][1]),
        type: asText(data[i][2]),
        dept: asText(data[i][3]),
        jabatan: asText(data[i][4]),
        userLevel: asText(data[i][5]).toUpperCase()
      };
    }
  }
  return null;
}

// ============================================================
//  2. BINDING KARTU MK
// ============================================================
function getBindingStatus(noKartuMK) {
  try {
    const sheet = getSheet(SHEET_BINDING);
    const data  = sheet.getDataRange().getValues();
    const no    = assertCard(noKartuMK);

    for (let i = data.length - 1; i >= 1; i--) {
      if (normalizeCard(data[i][0]) === no) {
        return {
          ok: true,
          noKartuMK: normalizeCard(data[i][0]),
          nik:        asText(data[i][1]),
          nama:       asText(data[i][2]),
          dept:       asText(data[i][3]),
          jabatan:    asText(data[i][4]),
          waktuBind:  asText(data[i][5]),
          status:     asText(data[i][6]) || 'FREE',
          waktuRelease: asText(data[i][7]),
          row:        i + 1
        };
      }
    }

    const kar = getKaryawanByNIK(no);
    if (kar && !isExternalKaryawan(kar)) {
      const todayStatus = getFactoryRecapStatus(kar.nik, formatDate(nowWIB()));
      if (todayStatus === 'DI DALAM') {
        return {
          ok: true,
          noKartuMK: no,
          nik: kar.nik,
          nama: kar.nama,
          dept: kar.dept,
          jabatan: kar.jabatan,
          waktuBind: 'ID Card internal',
          status: 'BOUND',
          waktuRelease: '',
          row: 0,
          isInternalId: true
        };
      }
    }
    return { ok: true, status: 'FREE', noKartuMK: no };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function bindKartu(noKartuMK, nik, loker) {
  return withDocumentLock(function() {
    try {
      const no  = assertCard(noKartuMK);
      const kar = getKaryawanByNIK(nik);
      if (!kar) return { ok: false, msg: 'NIK tidak ditemukan: ' + nik };

      const now = nowWIB();
      const tanggal = formatDate(now);
      const jam = formatTime(now);
      const isExternal = isExternalKaryawan(kar);
      const factoryStatus = getFactoryRecapStatus(kar.nik, tanggal);

      if (factoryStatus === 'DI DALAM') {
        return { ok: false, msg: `${kar.nama} sudah tercatat masuk dan belum keluar.` };
      }
      if (factoryStatus === 'SELESAI') {
        return { ok: false, msg: `${kar.nama} sudah menyelesaikan absen hari ini.` };
      }

      if (isExternal && no === kar.nik) {
        return { ok: false, msg: 'Karyawan external wajib scan kartu MK, bukan NIK.' };
      }
      if (!isExternal && no !== kar.nik) {
        return { ok: false, msg: 'Karyawan internal wajib memakai NIK / ID internal sendiri.' };
      }

      if (!isExternal) {
        const now = nowWIB();
        const tanggal = formatDate(now);
        const jam = formatTime(now);
        const sheetM = getSheet(SHEET_MASUK_PABRIK);
        sheetM.appendRow([no, kar.nik, kar.nama, tanggal, jam, detectShift(now), loker || '']);
        safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, jam, '', no, loker || '');
        return {
          ok: true,
          msg: `Karyawan ${kar.nama} berhasil masuk (via ID Card)`,
          karyawan: kar,
          noKartuMK: no,
          waktu: formatDateTime(now),
          shift: detectShift(now)
        };
      }

      const existing = getBindingStatus(no);
      if (!existing.ok) return existing;
      if (existing.status === 'BOUND') {
        return {
          ok: false,
          msg: `Kartu ${no} sudah terikat dengan ${existing.nama}. Lepaskan dulu sebelum mengikat ulang.`
        };
      }

      const sheetB = getSheet(SHEET_BINDING);
      const dataB  = sheetB.getDataRange().getValues();
      for (let i = 1; i < dataB.length; i++) {
        if (asText(dataB[i][1]).trim() === asText(nik).trim() && asText(dataB[i][6]) === 'BOUND') {
          return {
            ok: false,
            msg: `NIK ${nik} (${kar.nama}) sudah terikat di kartu ${asText(dataB[i][0])}. Selesaikan dulu.`
          };
        }
      }

      const waktu = formatDateTime(now);

      sheetB.appendRow([no, kar.nik, kar.nama, kar.dept, kar.jabatan, waktu, 'BOUND']);

      const sheetM = getSheet(SHEET_MASUK_PABRIK);
      sheetM.appendRow([no, kar.nik, kar.nama, tanggal, jam, detectShift(now), loker || '']);
      safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, jam, '', no, loker || '');

      return {
        ok: true,
        msg: `Kartu ${no} berhasil diikat ke ${kar.nama}`,
        karyawan: kar,
        noKartuMK: no,
        waktu,
        shift: detectShift(now)
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

function releaseKartu(noKartuMK, loker) {
  return withDocumentLock(function() {
    try {
      const no = assertCard(noKartuMK);
      
      const kar = getKaryawanByNIK(no);
      if (kar) {
        if (isExternalKaryawan(kar)) {
          return { ok: false, msg: 'Karyawan external harus keluar memakai kartu MK yang sedang terikat.' };
        }
        const now = nowWIB();
        const waktu = formatDateTime(now);
        const tanggal = formatDate(now);
        const jam = formatTime(now);
        const factoryStatus = getFactoryRecapStatus(kar.nik, tanggal);
        if (factoryStatus !== 'DI DALAM') {
          return { ok: false, msg: `${kar.nama} belum tercatat berada di dalam pabrik hari ini.` };
        }

        const sheetK = getSheet(SHEET_KELUAR_PABRIK);
        sheetK.appendRow([no, kar.nik, kar.nama, tanggal, jam, detectShift(now), loker || '']);
        safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, '', jam, no, loker || '');

        return {
          ok: true,
          msg: `Karyawan ${kar.nama} berhasil keluar (via ID Card)`,
          karyawan: kar,
          noKartuMK: no,
          waktu
        };
      }

      const binding = getBindingStatus(no);
      if (!binding.ok) return binding;

      if (binding.status !== 'BOUND') {
        return { ok: false, msg: `Kartu / ID ${no} tidak dalam status terikat.` };
      }

      const now = nowWIB();
      const waktu = formatDateTime(now);
      const tanggal = formatDate(now);
      const factoryStatus = getFactoryRecapStatus(binding.nik, tanggal);
      if (factoryStatus === 'SELESAI') {
        return { ok: false, msg: `${binding.nama} sudah tercatat keluar hari ini.` };
      }

      const sheetB = getSheet(SHEET_BINDING);
      sheetB.getRange(binding.row, 7).setValue('FREE');
      const releaseColumn = getHeaderIndex(sheetB, 'WAKTU_RELEASE');
      if (releaseColumn > 0) sheetB.getRange(binding.row, releaseColumn).setValue(waktu);

      const sheetK = getSheet(SHEET_KELUAR_PABRIK);
      const jam = formatTime(now);
      sheetK.appendRow([no, binding.nik, binding.nama, tanggal, jam, detectShift(now), loker || '']);
      safeUpdateRecapAbsen(tanggal, binding.nik, binding.nama, binding.dept, binding.jabatan, '', jam, no, loker || '');

      return {
        ok: true,
        msg: `Kartu ${no} berhasil dilepas dari ${binding.nama}`,
        karyawan: {
          nik: binding.nik,
          nama: binding.nama,
          dept: binding.dept,
          jabatan: binding.jabatan
        },
        noKartuMK: no,
        waktu
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

// ============================================================
//  3. SCAN AREA KERJA (Security)
// ============================================================
function scanAreaKerja(noKartuMK, tujuan, catatan, forceMode) {
  return withDocumentLock(function() {
    try {
      const no = assertCard(noKartuMK);
      
      let kar = getKaryawanByNIK(no);
      if (!kar) {
        const binding = getBindingStatus(no);
        if (!binding.ok) return binding;

        if (binding.status !== 'BOUND') {
          return { ok: false, msg: `Kartu / ID ${no} tidak dikenal atau tidak aktif.`, status: 'UNKNOWN' };
        }
        
        const master = getKaryawanByNIK(binding.nik) || {};
        kar = {
          nik: binding.nik,
          nama: binding.nama,
          type: asText(master.type),
          dept: binding.dept || asText(master.dept),
          jabatan: binding.jabatan || asText(master.jabatan)
        };
      }

      const now = nowWIB();
      const tanggal = formatDate(now);
      const waktu = formatDateTime(now);
      const factoryStatus = getFactoryRecapStatus(kar.nik, tanggal);
      if (!isExternalKaryawan(kar) && factoryStatus !== 'DI DALAM') {
        return { ok: false, msg: `${kar.nama} belum tercatat masuk pabrik hari ini.`, status: 'OUTSIDE_FACTORY' };
      }
      if (factoryStatus === 'SELESAI') {
        return { ok: false, msg: `${kar.nama} sudah tercatat keluar pabrik hari ini.`, status: 'OUTSIDE_FACTORY' };
      }

      const sheetA = getSheet(SHEET_AREA_KERJA);
      const dataA  = sheetA.getDataRange().getValues();
      let lastInOut = 'OUT';

      for (let i = dataA.length - 1; i >= 1; i--) {
        if (normalizeCard(dataA[i][0]) === no) {
          lastInOut = asText(dataA[i][1]);
          break;
        }
      }

      let inout = '';
      if (forceMode === 'IN') {
        inout = 'IN';
      } else if (forceMode === 'OUT') {
        inout = 'OUT';
      } else {
        inout = (lastInOut === 'OUT') ? 'IN' : 'OUT';
      }

      sheetA.appendRow([
        no,
        inout,
        tanggal,
        formatTime(now),
        kar.nik,
        kar.nama,
        tujuan || '',
        catatan || ''
      ]);

      return {
        ok: true,
        inout,
        noKartuMK: no,
        karyawan: kar,
        waktu,
        msg: `${kar.nama} -> ${inout === 'IN' ? 'MASUK Area Kerja' : 'KELUAR Area Kerja'}`
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

// ============================================================
//  4. DASHBOARD DATA
// ============================================================
function getDashboardData() {
  try {
    const sheetB = getSheet(SHEET_BINDING);
    const dataB  = sheetB.getDataRange().getValues();

    let totalBound = 0;
    const boundList = [];

    for (let i = 1; i < dataB.length; i++) {
      if (asText(dataB[i][6]) === 'BOUND') {
        totalBound++;
        boundList.push({
          noKartuMK: normalizeCard(dataB[i][0]),
          nik:        asText(dataB[i][1]),
          nama:       asText(dataB[i][2]),
          dept:       asText(dataB[i][3]),
          jabatan:    asText(dataB[i][4]),
          waktuBind:  asText(dataB[i][5])
        });
      }
    }

    const sheetA = getSheet(SHEET_AREA_KERJA);
    const dataA  = sheetA.getDataRange().getValues();
    const today  = formatDate(nowWIB());
    let logHariIni = 0;
    for (let i = 1; i < dataA.length; i++) {
      if (asText(dataA[i][2]) === today) logHariIni++;
    }

    return {
      ok: true,
      totalBound,
      boundList,
      logAreaKerjaHariIni: logHariIni
    };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
//  5. LOG AREA KERJA TERBARU (untuk security monitor)
// ============================================================
function getRecentAreaLogs(limit) {
  try {
    const n      = Math.max(1, Math.min(parseInt(limit, 10) || 30, 100));
    const sheetA = getSheet(SHEET_AREA_KERJA);
    const data   = sheetA.getDataRange().getValues();
    const rows   = [];

    for (let i = data.length - 1; i >= 1 && rows.length < n; i--) {
      rows.push({
        noKartuMK: normalizeCard(data[i][0]),
        inout:     asText(data[i][1]),
        tanggal:   asText(data[i][2]),
        jam:       asText(data[i][3]),
        nik:       asText(data[i][4]),
        nama:      asText(data[i][5])
      });
    }

    return { ok: true, data: rows };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}
