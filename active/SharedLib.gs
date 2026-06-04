// ============================================================
//  SHARED LIBRARY — NFC DAM ACCESS CONTROL SYSTEM
//  PT Daya Anugrah Mulya
//  Google Apps Script — Shared Utilities & Constants
//  Updated: 2026-06-03 (Refactored from 5 duplicate copies)
// ============================================================

// ---- SHEET CONSTANTS ----
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

// ---- TEXT UTILITIES ----

function asText(value) {
  if (value === null || value === undefined) return '';
  try {
    return String(value);
  } catch(e) {
    Logger.log('SharedLib.asText: conversion failed — ' + e.message);
    return '';
  }
}

function normalizeHeader(value) {
  try {
    return asText(value).trim().toUpperCase().replace(/[\s_]+/g, '');
  } catch(e) {
    Logger.log('SharedLib.normalizeHeader: failed — ' + e.message);
    return '';
  }
}

function normalizeCard(value) {
  try {
    return asText(value).trim().toUpperCase();
  } catch(e) {
    Logger.log('SharedLib.normalizeCard: failed — ' + e.message);
    return '';
  }
}

// ---- SPREADSHEET UTILITIES ----

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    throw new Error('Gagal membuka spreadsheet: ' + e.message);
  }
}

function ensureHeader(sheet, headers) {
  if (!sheet || !headers || !headers.length) {
    throw new Error('SharedLib.ensureHeader: sheet atau headers tidak valid.');
  }

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
  if (!name) throw new Error('SharedLib.getSheet: nama sheet tidak boleh kosong.');

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

// ---- DATE/TIME UTILITIES ----

function nowWIB() {
  return new Date();
}

function formatDate(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  try {
    return Utilities.formatDate(d, 'Asia/Jakarta', 'dd/MM/yyyy');
  } catch(e) {
    Logger.log('SharedLib.formatDate: failed — ' + e.message);
    return '';
  }
}

function formatTime(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  try {
    return Utilities.formatDate(d, 'Asia/Jakarta', 'HH:mm:ss');
  } catch(e) {
    Logger.log('SharedLib.formatTime: failed — ' + e.message);
    return '';
  }
}

function formatDateTime(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  try {
    return Utilities.formatDate(d, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
  } catch(e) {
    Logger.log('SharedLib.formatDateTime: failed — ' + e.message);
    return '';
  }
}

function parseIsoDate(value) {
  try {
    const parts = asText(value).trim().split('-').map(function(part) { return parseInt(part, 10); });
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  } catch(e) {
    Logger.log('SharedLib.parseIsoDate: failed — ' + e.message);
    return null;
  }
}

function parseSheetDate(value) {
  try {
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
  } catch(e) {
    Logger.log('SharedLib.parseSheetDate: failed — ' + e.message);
    return null;
  }
}

function formatDateForSort(value) {
  try {
    const d = parseSheetDate(value);
    return d ? Utilities.formatDate(d, 'Asia/Jakarta', 'yyyyMMdd') : asText(value);
  } catch(e) {
    Logger.log('SharedLib.formatDateForSort: failed — ' + e.message);
    return asText(value);
  }
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
  try {
    const date = parseSheetDate(value);
    if (!date) return false;
    return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
  } catch(e) {
    return false;
  }
}

function detectShift(d) {
  try {
    const h = parseInt(Utilities.formatDate(d, 'Asia/Jakarta', 'HH'), 10);
    if (h >= 6 && h < 14)  return 'Shift 1';
    if (h >= 14 && h < 22) return 'Shift 2';
    return 'Shift 3';
  } catch(e) {
    return '';
  }
}

// ---- LOCKING ----

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

// ---- VALIDATION ----

function assertCard(noKartuMK) {
  const no = normalizeCard(noKartuMK);
  if (!no) throw new Error('Nomor kartu MK kosong.');
  if (!/^[A-Z0-9_-]{3,32}$/.test(no)) throw new Error('Format nomor kartu MK / NIK tidak valid.');
  return no;
}

// ---- KARYAWAN UTILITIES ----

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
  try {
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
  } catch(e) {
    Logger.log('SharedLib.getFactoryRecapStatus: failed — ' + e.message);
    return '';
  }
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

// ---- KARYAWAN LOOKUP ----

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

// ---- ROLE-BASED ACCESS CONTROL ----

/**
 * Check if a NIK has the required role.
 * @param {string} nik - Employee NIK
 * @param {string|string[]} requiredRole - e.g. 'ADMIN' or ['ADMIN','SUPERVISOR']
 * @returns {{ ok: boolean, msg: string, karyawan: object|null }}
 */
function requireRole(nik, requiredRole) {
  try {
    const karyawanMap = getKaryawanMapByNIK();
    const k = karyawanMap[nik];
    if (!k) return { ok: false, msg: 'NIK tidak ditemukan.', karyawan: null };

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userRole = (k.userLevel || 'KARYAWAN').toUpperCase();

    if (roles.indexOf(userRole) === -1) {
      return {
        ok: false,
        msg: 'Akses ditolak. Role ' + userRole + ' tidak diizinkan. Required: ' + roles.join('/'),
        karyawan: makeKaryawanPayload(k)
      };
    }

    return { ok: true, msg: 'OK', karyawan: makeKaryawanPayload(k) };
  } catch(e) {
    return { ok: false, msg: e.message, karyawan: null };
  }
}

/**
 * Quick guard for admin-only operations.
 * @param {string} nik
 * @returns {{ ok: boolean, msg: string }}
 */
function guardAdmin(nik) {
  const result = requireRole(nik, 'ADMIN');
  if (!result.ok) return result;
  return { ok: true, msg: 'OK' };
}

// ---- AUTH ----

function verifyLogin(nik, password) {
  try {
    const karyawanMap = getKaryawanMapByNIK();
    const k = karyawanMap[nik];

    if (!k) {
      return { ok: false, msg: 'NIK tidak ditemukan di database.' };
    }

    if (k.password && k.password !== password) {
      return { ok: false, msg: 'Password salah.' };
    }

    return {
      ok: true,
      karyawan: makeKaryawanPayload(k),
      depts: getAvailableDepts(karyawanMap)
    };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function verifySession(nik) {
  try {
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
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ---- GAS TEMPLATE ----

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---- ROUTING / CONFIG ----

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
      REPORT: '',
      HOME_PORTAL: ''
    };
    
    for (let i = 1; i < data.length; i++) {
      const name = asText(data[i][0]).toUpperCase();
      const link = asText(data[i][1]);
      if (name === 'GATE_PABRIK') urls.GATE_PABRIK = link;
      if (name === 'AREA_KERJA') urls.AREA_KERJA = link;
      if (name === 'REPORT') urls.REPORT = link;
      if (name === 'HOME_PORTAL') urls.HOME_PORTAL = link;
    }
    
    return urls;
  } catch(e) {
    Logger.log("Error getModuleUrls: " + e.message);
    return { GATE_PABRIK: '', AREA_KERJA: '', REPORT: '', HOME_PORTAL: '' };
  }
}