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

function getModuleUrls() {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('CONFIG_MODUL');
    if (!sheet) {
      sheet = ss.insertSheet('CONFIG_MODUL');
      sheet.appendRow(['NAMA_MODUL', 'LINK_MODUL']);
      sheet.getRange("A1:B1").setFontWeight("bold");
    }
    
    const data = sheet.getDataRange().getValues();
    const urls = {
      GATE_PABRIK: '',
      AREA_KERJA: '',
      REPORT: ''
    };
    
    for (let i = 1; i < data.length; i++) {
      const name = asText(data[i][0]).toUpperCase();
      const link = asText(data[i][1]);
      if (name === 'GATE_PABRIK') urls.GATE_PABRIK = link;
      if (name === 'AREA_KERJA') urls.AREA_KERJA = link;
      if (name === 'REPORT') urls.REPORT = link;
    }
    
    return urls;
  } catch(e) {
    Logger.log("Error getModuleUrls: " + e.message);
    return { GATE_PABRIK: '', AREA_KERJA: '', REPORT: '' };
  }
}


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
  const existing = range.getValues()[0].map(asText);
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
  return no;
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
        result.push({ nik, nama, type, dept, jabatan });
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
        jabatan: asText(data[i][4])
      };
    }
  }
  return null;
}

// ============================================================
//  2. BINDING KARTU MK
// ============================================================



// ============================================================
//  3. SCAN AREA KERJA (Security)
// ============================================================

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
