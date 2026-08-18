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
const SHEET_JADWAL            = 'JADWAL_SHIFT';
const SHEET_GATE_REQUESTS     = 'ANDROID_GATE_REQUESTS';
const SHEET_ANDROID_DIAGNOSTICS = 'ANDROID_DIAGNOSTICS';
const SHEET_ANDROID_SESSIONS  = 'ANDROID_SESSIONS';

const SHEET_HEADERS = {
  [SHEET_KARYAWAN]: ['NIK','NAMA','TYPE KAYARAWAN','DEPT','JABATAN','USER LEVEL','PASSWORD'],
  [SHEET_MASUK_PABRIK]: ['NO KARTU MK','NIK','NAMA','TANGGAL','JAM MASUK','SHIFT'],
  [SHEET_KELUAR_PABRIK]: ['NO KARTU MK','NIK','NAMA','TANGGAL','JAM KELUAR','SHIFT'],
  [SHEET_AREA_KERJA]: ['NO KARTU MK','INOUT','TANGGAL','JAM CATAT','NIK','NAMA','TUJUAN','CATATAN'],
  [SHEET_BINDING]: ['NO_KARTU_MK','NIK','NAMA','DEPT','JABATAN','WAKTU_BIND','STATUS'],
  [SHEET_RECAP_ABSEN]: ['TANGGAL','NIK','NAMA','DEPARTEMEN','JABATAN','JAM MASUK','JAM KELUAR','STATUS','NO KARTU MK','NO LOKER'],
  [SHEET_JADWAL]: ['NIK','NAMA','DEPT','SHIFT','TANGGAL_MULAI','TANGGAL_SELESAI'],
  [SHEET_GATE_REQUESTS]: ['REQUEST_ID','ACTION','PARTITION_KEY','NO_KARTU_MK','NIK','STATUS','CREATED_AT','UPDATED_AT','ATTEMPT_COUNT','PAYLOAD_JSON','RESPONSE_JSON','LAST_ERROR'],
  [SHEET_ANDROID_DIAGNOSTICS]: ['EVENT_ID','EVENT_AT','RECEIVED_AT','SOURCE','ACTION','PHASE','OUTCOME','FAILURE_KIND','REQUEST_ID','HTTP_STATUS','LATENCY_MS','MESSAGE','NIK','ROLE','DEVICE_SESSION_ID','PAYLOAD_JSON'],
  [SHEET_ANDROID_SESSIONS]: ['TOKEN','NIK','CREATED_AT','EXPIRES_AT']
};

const OPTIONAL_SHEET_HEADERS = {
  [SHEET_BINDING]: ['WAKTU_RELEASE'],
  [SHEET_MASUK_PABRIK]: ['NO LOKER'],
  [SHEET_KELUAR_PABRIK]: ['NO LOKER']
};

const CANONICAL_FACTORY_DATE_FORMAT    = 'dd/MM/yyyy';
const CANONICAL_FACTORY_TIME_FORMAT    = 'HH:mm:ss';
const CANONICAL_FACTORY_DT_FORMAT      = 'dd/MM/yyyy HH:mm:ss';
const FACTORY_OPERATION_START_DATE = new Date(2026, 3, 25);
const FACTORY_OPERATION_MAX_FUTURE_DAYS = 2;

// ---- GPS / LOCATION CONSTANTS ----
const FACTORY_GPS_LAT      = -6.4931996266991305;
const FACTORY_GPS_LNG      = 107.42188564795138;
const FACTORY_GPS_RADIUS_M = 200;  // meter — max distance allowed from factory gate

/**
 * haversineDistance_ — Menghitung jarak dua titik GPS dalam meter.
 * Formula Haversine, akurat untuk jarak pendek (<10km).
 * @param {number} lat1 - Latitude titik user
 * @param {number} lng1 - Longitude titik user
 * @param {number} lat2 - Latitude titik referensi (pabrik)
 * @param {number} lng2 - Longitude titik referensi (pabrik)
 * @returns {number} Jarak dalam meter
 */
function haversineDistance_(lat1, lng1, lat2, lng2) {
  const R = 6371000; // radius bumi dalam meter
  const toRad = function(deg) { return deg * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
          * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- TEXT UTILITIES ----

function asText(value) {
  if (value === null || value === undefined) return '';
  try {
    let str = String(value).trim();
    if (str.endsWith('.0')) {
      str = str.slice(0, -2);
    }
    return str;
  } catch(e) {
    Logger.log('SharedLib.asText: conversion failed — ' + e.message);
    return '';
  }
}

function escHtml(value) {
  return asText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function formatDateUI(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  try {
    return Utilities.formatDate(d, 'Asia/Jakarta', 'd - MMM - yyyy');
  } catch(e) {
    Logger.log('SharedLib.formatDateUI: failed — ' + e.message);
    return '';
  }
}

/**
 * formatDateISO — Formats a Date as 'yyyy-MM-dd' (ISO 8601).
 * USE THIS FOR STORAGE to Google Sheets — Google Sheets NEVER
 * auto-parses this format, making it locale-proof (100% safe).
 * For DISPLAY to users, use formatDate() which returns dd/MM/yyyy.
 */
function formatDateISO(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  try {
    return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd');
  } catch(e) {
    Logger.log('SharedLib.formatDateISO: failed — ' + e.message);
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

/**
 * parseAnyDate — Locale-agnostic date parser.
 * Accepts: Date object, "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd",
 *          "dd/MM/yyyy HH:mm:ss", "yyyy-MM-dd HH:mm:ss"
 * Rule: If the first number > 12 it MUST be the day (not month).
 * Fallback ambiguous cases → DD/MM/YYYY (Indonesian standard).
 * @param {*} value - raw value from sheet cell or user input
 * @returns {Date|null} - Date object in local time, or null if invalid
 */
function parseAnyDate(value) {
  if (!value && value !== 0) return null;
  // Already a Date object
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }
  const text = String(value).trim();
  if (!text) return null;

  // ISO format: yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return createStrictDateTime_(
      parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10),
      parseInt(m[4]||'0',10), parseInt(m[5]||'0',10), parseInt(m[6]||'0',10)
    );
  }

  // Localized: d1/d2/yyyy [HH:mm[:ss]]
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const a = parseInt(m[1],10);
    const b = parseInt(m[2],10);
    const yyyy = parseInt(m[3],10);
    const hh = parseInt(m[4]||'0',10);
    const mm = parseInt(m[5]||'0',10);
    const ss = parseInt(m[6]||'0',10);
    // If first number > 12 → must be day (DD/MM/YYYY)
    if (a > 12) return createStrictDateTime_(yyyy, b-1, a, hh, mm, ss);
    // If second number > 12 → must be day in month position (MM/DD/YYYY)
    if (b > 12) return createStrictDateTime_(yyyy, a-1, b, hh, mm, ss);
    // Ambiguous: default to DD/MM/YYYY (Indonesian)
    return createStrictDateTime_(yyyy, b-1, a, hh, mm, ss);
  }

  // Dash-separated: d1-d2-yyyy
  m = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) {
    const a = parseInt(m[1],10);
    const b = parseInt(m[2],10);
    const yyyy = parseInt(m[3],10);
    if (a > 12) return createStrictDateTime_(yyyy, b-1, a, 0, 0, 0);
    if (b > 12) return createStrictDateTime_(yyyy, a-1, b, 0, 0, 0);
    return createStrictDateTime_(yyyy, b-1, a, 0, 0, 0);
  }

  return null;
}

/**
 * ensureTextColumnFormat_ — Set entire column to plain text (@) so
 * Google Sheets never reformats stored strings based on user locale.
 * @param {Sheet} sheet
 * @param {number} colIndex - 1-based column index
 */
function ensureTextColumnFormat_(sheet, colIndex) {
  try {
    if (!sheet || !colIndex) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    sheet.getRange(2, colIndex, lastRow - 1, 1).setNumberFormat('@');
  } catch(e) {
    Logger.log('SharedLib.ensureTextColumnFormat_: failed — ' + e.message);
  }
}

function createStrictDateTime_(year, monthIndex, day, hour, minute, second) {
  const dateValue = new Date(year, monthIndex, day, hour || 0, minute || 0, second || 0, 0);
  if (
    isNaN(dateValue.getTime()) ||
    dateValue.getFullYear() !== year ||
    dateValue.getMonth() !== monthIndex ||
    dateValue.getDate() !== day ||
    dateValue.getHours() !== (hour || 0) ||
    dateValue.getMinutes() !== (minute || 0) ||
    dateValue.getSeconds() !== (second || 0)
  ) {
    return null;
  }
  return dateValue;
}

function cloneDateOnly_(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return null;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function normalizeDateParseOptions_(options) {
  const config = options || {};
  return {
    preferredSlashOrder: asText(config.preferredSlashOrder).trim().toUpperCase() === 'MDY' ? 'MDY' : 'DMY',
    allowMonthFirstFallback: config.allowMonthFirstFallback === true,
    requireWindowMatch: config.requireWindowMatch === true,
    minDate: cloneDateOnly_(config.minDate),
    maxDate: cloneDateOnly_(config.maxDate),
    referenceDate: cloneDateOnly_(config.referenceDate)
  };
}

function getFactoryOperationalDateParsingOptions_(overrides) {
  const maxDate = cloneDateOnly_(nowWIB()) || new Date();
  maxDate.setDate(maxDate.getDate() + FACTORY_OPERATION_MAX_FUTURE_DAYS);
  return normalizeDateParseOptions_(Object.assign({
    preferredSlashOrder: 'DMY',
    allowMonthFirstFallback: true,
    requireWindowMatch: true,
    minDate: FACTORY_OPERATION_START_DATE,
    maxDate: maxDate
  }, overrides || {}));
}

function isDateWithinParseWindow_(dateValue, options) {
  if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) return false;
  const config = normalizeDateParseOptions_(options);
  const dateOnly = cloneDateOnly_(dateValue);
  if (config.minDate && dateOnly.getTime() < config.minDate.getTime()) return false;
  if (config.maxDate && dateOnly.getTime() > config.maxDate.getTime()) return false;
  return true;
}

function applyParseWindowToDate_(dateValue, options) {
  if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) return null;
  const config = normalizeDateParseOptions_(options);
  if (!config.requireWindowMatch) return new Date(dateValue.getTime());
  return isDateWithinParseWindow_(dateValue, config) ? new Date(dateValue.getTime()) : null;
}

function chooseSlashDateCandidate_(preferredCandidate, alternateCandidate, options) {
  const config = normalizeDateParseOptions_(options);
  const preferred = preferredCandidate instanceof Date && !isNaN(preferredCandidate.getTime()) ? preferredCandidate : null;
  const alternate = alternateCandidate instanceof Date && !isNaN(alternateCandidate.getTime()) ? alternateCandidate : null;

  if (!preferred && !alternate) return null;
  if (!alternate) return applyParseWindowToDate_(preferred, config);
  if (!preferred) {
    if (!config.allowMonthFirstFallback) return null;
    return applyParseWindowToDate_(alternate, config);
  }

  const preferredWindowed = applyParseWindowToDate_(preferred, config);
  const alternateWindowed = applyParseWindowToDate_(alternate, config);
  if (preferredWindowed && !alternateWindowed) return preferredWindowed;
  if (!preferredWindowed && alternateWindowed) return alternateWindowed;
  if (preferredWindowed && alternateWindowed && config.referenceDate) {
    const refTime = config.referenceDate.getTime();
    const preferredDistance = Math.abs(cloneDateOnly_(preferredWindowed).getTime() - refTime);
    const alternateDistance = Math.abs(cloneDateOnly_(alternateWindowed).getTime() - refTime);
    return preferredDistance <= alternateDistance ? preferredWindowed : alternateWindowed;
  }
  if (preferredWindowed && alternateWindowed) return preferredWindowed;
  if (config.requireWindowMatch) return null;
  return preferred;
}

function parseLocalizedDateTime_(text, options) {
  const config = normalizeDateParseOptions_(options);
  const match = asText(text).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const first = parseInt(match[1], 10);
  const second = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const hour = parseInt(match[4] || '0', 10);
  const minute = parseInt(match[5] || '0', 10);
  const secondValue = parseInt(match[6] || '0', 10);

  const dmyCandidate = createStrictDateTime_(year, second - 1, first, hour, minute, secondValue);
  const mdyCandidate = createStrictDateTime_(year, first - 1, second, hour, minute, secondValue);

  if (config.preferredSlashOrder === 'MDY') {
    return chooseSlashDateCandidate_(mdyCandidate, dmyCandidate, config);
  }
  return chooseSlashDateCandidate_(dmyCandidate, mdyCandidate, config);
}

function parseSheetDateTime(value, options) {
  try {
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return applyParseWindowToDate_(value, options);
    }

    const text = asText(value).trim();
    if (!text) return null;

    const localizedParsed = parseLocalizedDateTime_(text, options);
    if (localizedParsed) return localizedParsed;

    let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
      return applyParseWindowToDate_(createStrictDateTime_(
        parseInt(match[1], 10),
        parseInt(match[2], 10) - 1,
        parseInt(match[3], 10),
        parseInt(match[4] || '0', 10),
        parseInt(match[5] || '0', 10),
        parseInt(match[6] || '0', 10)
      ), options);
    }

    match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
      return applyParseWindowToDate_(createStrictDateTime_(
        parseInt(match[3], 10),
        parseInt(match[2], 10) - 1,
        parseInt(match[1], 10),
        parseInt(match[4] || '0', 10),
        parseInt(match[5] || '0', 10),
        parseInt(match[6] || '0', 10)
      ), options);
    }

    return null;
  } catch(e) {
    Logger.log('SharedLib.parseSheetDateTime: failed - ' + e.message);
    return null;
  }
}

function makeSheetDateValue(value, options) {
  try {
    const parsed = parseSheetDate(value, options);
    if (!parsed) return '';
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  } catch(e) {
    Logger.log('SharedLib.makeSheetDateValue: failed - ' + e.message);
    return '';
  }
}

function makeSheetDateTimeValue(dateValue, timeValue, options) {
  try {
    if (timeValue === undefined) {
      const directParsed = parseSheetDateTime(dateValue, options);
      return directParsed || '';
    }

    const baseDate = parseSheetDate(dateValue, options);
    if (!baseDate) return '';

    const normalizedTime = normalizeTimeValue(timeValue);
    const match = normalizedTime.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) {
      return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    }

    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10)
    );
  } catch(e) {
    Logger.log('SharedLib.makeSheetDateTimeValue: failed - ' + e.message);
    return '';
  }
}

function applyNumberFormatToColumn_(sheet, columnIndex, pattern, startRow) {
  try {
    if (!sheet || !columnIndex || !pattern) return;
    const beginRow = Math.max(2, parseInt(startRow, 10) || 2);
    const totalRows = sheet.getLastRow() - beginRow + 1;
    if (totalRows <= 0) return;
    sheet.getRange(beginRow, columnIndex, totalRows, 1).setNumberFormat(pattern);
  } catch (e) {
    Logger.log('SharedLib.applyNumberFormatToColumn_: failed - ' + e.message);
  }
}

function applyNumberFormatToCell_(sheet, rowIndex, columnIndex, pattern) {
  try {
    if (!sheet || !rowIndex || !columnIndex || !pattern) return;
    sheet.getRange(rowIndex, columnIndex).setNumberFormat(pattern);
  } catch (e) {
    Logger.log('SharedLib.applyNumberFormatToCell_: failed - ' + e.message);
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

function parseSheetDate(value, options) {
  try {
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return cloneDateOnly_(applyParseWindowToDate_(value, options));
    }

    const text = asText(value).trim();
    const parsedDateTime = parseSheetDateTime(text, options);
    return cloneDateOnly_(parsedDateTime);
  } catch(e) {
    Logger.log('SharedLib.parseSheetDate: failed — ' + e.message);
    return null;
  }
}

function formatDateForSort(value) {
  try {
    const d = parseSheetDate(value, getFactoryOperationalDateParsingOptions_());
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
    label: formatDateUI(start) + ' - ' + formatDateUI(end)
  };
}

function isDateInRange(value, range) {
  try {
    const date = parseSheetDate(value, getFactoryOperationalDateParsingOptions_());
    if (!date) return false;
    return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
  } catch(e) {
    return false;
  }
}

function detectShift(d, eventType) {
  try {
    let mins = null;
    if (Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.getTime())) {
      const parts = Utilities.formatDate(d, 'Asia/Jakarta', 'HH:mm').split(':');
      mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    } else {
      mins = timeStrToMinutes(d);
    }
    if (mins === null) return 'Shift 1';

    const type = (asText(eventType) || 'masuk').toLowerCase().trim() === 'keluar' ? 'keluar' : 'masuk';
    const labels = ['Shift 1', 'Shift 2', 'Shift 3'];

    // Prioritas khusus Shift 3 KELUAR (dini hari 00:00-07:59).
    // Jam ini adalah zona eksklusif Shift 3 keluar. Meski Shift 1 juga overlap
    // (window keluar 05:00-15:59), secara operasional keluar jam 00:00-07:59
    // PASTI dari Shift 3 (masuk malam sebelumnya jam 22:00).
    if (type === 'keluar' && mins <= 7 * 60 + 59) {
      const shift3Match = getShiftEventMatch_('Shift 3', mins, 'keluar');
      if (shift3Match.matches) return 'Shift 3';
    }

    // Prioritas khusus Shift 3 MASUK (malam 21:00-23:59).
    if (type === 'masuk' && mins >= 21 * 60) {
      const shift3Match = getShiftEventMatch_('Shift 3', mins, 'masuk');
      if (shift3Match.matches) return 'Shift 3';
    }

    // Fallback: ambil shift dengan jarak terdekat ke waktu referensi shift.
    let bestLabel = 'Shift 1';
    let bestDistance = Infinity;

    for (let i = 0; i < labels.length; i++) {
      const match = getShiftEventMatch_(labels[i], mins, type);
      if (!match.matches) continue;
      if (match.distance < bestDistance) {
        bestDistance = match.distance;
        bestLabel = labels[i];
      }
    }

    return bestLabel;
  } catch(e) {
    Logger.log('SharedLib.detectShift: failed — ' + e.message);
    return 'Shift 1';
  }
}

// ---- SHIFT CONFIG & KETERLAMBATAN UTILITIES ----

// Jam standar shift dalam menit sejak 00:00.
// Aturan operasional:
// - Masuk valid mulai 1 jam sebelum shift dimulai.
// - Keluar valid sampai 2 jam setelah shift selesai.
// - Jika masuk setelah jam mulai => telat.
// - Jika keluar sebelum jam selesai => pulang cepat.
const SHIFT_CONFIG = {
  'Shift 1': { startTotal: 6 * 60 + 0,  endTotal: 13 * 60 + 59, preStartMinutes: 60, postEndMinutes: 120, crossMidnight: false },
  'Shift 2': { startTotal: 14 * 60 + 0, endTotal: 21 * 60 + 59, preStartMinutes: 60, postEndMinutes: 120, crossMidnight: false },
  'Shift 3': { startTotal: 22 * 60 + 0, endTotal: 5 * 60 + 59,  preStartMinutes: 60, postEndMinutes: 120, crossMidnight: true },
  'Non Shift 08:00-16:00': { startTotal: 8 * 60 + 0, endTotal: 16 * 60 + 0, preStartMinutes: 60, postEndMinutes: 120, crossMidnight: false },
  'Non Shift 10:00-18:00': { startTotal: 10 * 60 + 0, endTotal: 18 * 60 + 0, preStartMinutes: 60, postEndMinutes: 120, crossMidnight: false }
};

const SHIFT_ALIASES = {
  'SHIFT1': 'Shift 1',
  'SHIFT 1': 'Shift 1',
  'SHIFT2': 'Shift 2',
  'SHIFT 2': 'Shift 2',
  'SHIFT3': 'Shift 3',
  'SHIFT 3': 'Shift 3',
  'NONSHIFT08': 'Non Shift 08:00-16:00',
  'NON SHIFT 08': 'Non Shift 08:00-16:00',
  'NON SHIFT 08:00-16:00': 'Non Shift 08:00-16:00',
  'NONSHIFT 08:00-16:00': 'Non Shift 08:00-16:00',
  '08:00-16:00': 'Non Shift 08:00-16:00',
  '08.00-16.00': 'Non Shift 08:00-16:00',
  'NONSHIFT10': 'Non Shift 10:00-18:00',
  'NON SHIFT 10': 'Non Shift 10:00-18:00',
  'NON SHIFT 10:00-18:00': 'Non Shift 10:00-18:00',
  'NONSHIFT 10:00-18:00': 'Non Shift 10:00-18:00',
  '10:00-18:00': 'Non Shift 10:00-18:00',
  '10.00-18.00': 'Non Shift 10:00-18:00'
};

function normalizeShiftLabel(shiftLabel) {
  const raw = asText(shiftLabel).trim();
  if (!raw) return '';
  const compact = raw.toUpperCase().replace(/[_\s]+/g, ' ');
  return SHIFT_ALIASES[compact] || SHIFT_ALIASES[compact.replace(/\s+/g, '')] || raw;
}

function getShiftDefinition_(shiftLabel) {
  const normalized = normalizeShiftLabel(shiftLabel);
  return SHIFT_CONFIG[normalized] || null;
}

function getShiftRange_(shiftLabel) {
  const cfg = getShiftDefinition_(shiftLabel);
  if (!cfg) return null;
  const startAbs = cfg.startTotal;
  const endAbs = cfg.crossMidnight || cfg.endTotal < cfg.startTotal
    ? cfg.endTotal + 24 * 60
    : cfg.endTotal;
  return {
    label: normalizeShiftLabel(shiftLabel),
    startAbs: startAbs,
    endAbs: endAbs,
    preStartMinutes: cfg.preStartMinutes || 0,
    postEndMinutes: cfg.postEndMinutes || 0,
    crossMidnight: !!cfg.crossMidnight
  };
}

function getShiftEventMatch_(shiftLabel, minute, eventType) {
  const range = getShiftRange_(shiftLabel);
  if (!range || minute === null || minute === undefined) {
    return { matches: false, distance: Infinity, actualAbs: null };
  }

  const type = eventType === 'keluar' ? 'keluar' : 'masuk';
  const windowStart = type === 'masuk'
    ? range.startAbs - range.preStartMinutes
    : range.startAbs;
  const windowEnd = type === 'keluar'
    ? range.endAbs + range.postEndMinutes
    : range.endAbs;
  const refPoint = type === 'masuk' ? range.startAbs : range.endAbs;

  const candidates = [minute, minute + 24 * 60];
  let bestActualAbs = null;
  let bestDistance = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const actualAbs = candidates[i];
    if (actualAbs < windowStart || actualAbs > windowEnd) continue;
    const distance = Math.abs(actualAbs - refPoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestActualAbs = actualAbs;
    }
  }

  return {
    matches: bestActualAbs !== null,
    distance: bestDistance,
    actualAbs: bestActualAbs
  };
}

function timeStrToMinutes(value) {
  try {
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      const parts = Utilities.formatDate(value, 'Asia/Jakarta', 'HH:mm').split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    const text = asText(value).trim();
    const match = text.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  } catch(e) {
    Logger.log('SharedLib.timeStrToMinutes: failed — ' + e.message);
    return null;
  }
}

function normalizeTimeValue(value) {
  try {
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, 'Asia/Jakarta', 'HH:mm:ss');
    }
    const text = asText(value).trim();
    const match = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return '';
    return (
      String(parseInt(match[1], 10)).padStart(2, '0') + ':' +
      String(parseInt(match[2], 10)).padStart(2, '0') + ':' +
      String(parseInt(match[3] || '0', 10)).padStart(2, '0')
    );
  } catch(e) {
    Logger.log('SharedLib.normalizeTimeValue: failed - ' + e.message);
    return '';
  }
}

// Sel tanggal boleh berupa objek Date asli (peninggalan sebelum sel dikunci '@')
// atau teks ISO/dd-MM-yyyy. Selalu kembalikan teks ISO 'yyyy-MM-dd' yang aman
// ditampilkan, supaya asText() tidak jatuh ke Date.toString() bawaan JS
// (pola bug sama seperti normalizeTimeValue di atas).
function normalizeDateDisplayValue_(value, parseOptions) {
  try {
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return formatDateISO(value);
    }
    const parsed = parseSheetDate(value, parseOptions);
    if (parsed) return formatDateISO(parsed);
    return asText(value).trim();
  } catch(e) {
    Logger.log('SharedLib.normalizeDateDisplayValue_: failed - ' + e.message);
    return asText(value).trim();
  }
}

function compareTimeValues(a, b) {
  const minuteA = timeStrToMinutes(a);
  const minuteB = timeStrToMinutes(b);
  if (minuteA === null || minuteB === null) {
    return normalizeTimeValue(a).localeCompare(normalizeTimeValue(b));
  }
  if (minuteA < minuteB) return -1;
  if (minuteA > minuteB) return 1;
  return normalizeTimeValue(a).localeCompare(normalizeTimeValue(b));
}

function isMinuteInRange(minute, startMinute, endMinute) {
  if (minute === null || minute === undefined) return false;
  if (startMinute <= endMinute) return minute >= startMinute && minute <= endMinute;
  return minute >= startMinute || minute <= endMinute;
}

function isMinuteInRanges(minute, ranges) {
  if (!Array.isArray(ranges)) return false;
  return ranges.some(function(range) {
    return isMinuteInRange(minute, range.start, range.end);
  });
}

function matchesShiftEventTime(shiftLabel, timeValue, eventType) {
  const minute = timeStrToMinutes(timeValue);
  if (minute === null) return false;
  return getShiftEventMatch_(shiftLabel, minute, eventType === 'keluar' ? 'keluar' : 'masuk').matches;
}

function inferShiftByEventTime(timeValue, eventType) {
  const minute = timeStrToMinutes(timeValue);
  if (minute === null) return '';
  const labels = ['Shift 1', 'Shift 2', 'Shift 3'];
  let bestLabel = '';
  let bestDistance = Infinity;
  for (let i = 0; i < labels.length; i++) {
    const match = getShiftEventMatch_(labels[i], minute, eventType === 'keluar' ? 'keluar' : 'masuk');
    if (!match.matches) continue;
    if (match.distance < bestDistance) {
      bestDistance = match.distance;
      bestLabel = labels[i];
    }
  }
  return bestLabel;
}

function resolveFactoryWorkDate(tanggal, timeValue, eventType) {
  try {
    const parseOptions = getFactoryOperationalDateParsingOptions_();
    const baseDate = parseIsoDate(tanggal) || parseSheetDate(tanggal, parseOptions);
    const normalizedDate = baseDate ? formatDate(baseDate) : asText(tanggal).trim();
    const shiftLabel = detectShift(timeValue, eventType);
    const minute = timeStrToMinutes(timeValue);
    const shiftDef = getShiftDefinition_(shiftLabel);

    if (!baseDate) {
      return { tanggal: normalizedDate, tanggalValue: null, shiftLabel: shiftLabel, source: 'raw' };
    }

    if (shiftLabel === 'Shift 3' && shiftDef && minute !== null && minute < shiftDef.startTotal) {
      const previousDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      previousDate.setDate(previousDate.getDate() - 1);
      return {
        tanggal: formatDate(previousDate),
        tanggalValue: new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate()),
        shiftLabel: shiftLabel,
        source: 'shift3_prev_day'
      };
    }

    return {
      tanggal: normalizedDate,
      tanggalValue: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()),
      shiftLabel: shiftLabel,
      source: 'same_day'
    };
  } catch (e) {
    Logger.log('SharedLib.resolveFactoryWorkDate: failed - ' + e.message);
    return {
      tanggal: asText(tanggal).trim(),
      tanggalValue: null,
      shiftLabel: detectShift(timeValue, eventType),
      source: 'error'
    };
  }
}

function resolveFactoryEventContext(tanggal, nik, timeValue, eventType, jadwalCache) {
  try {
    const targetNik = asText(nik).trim().replace(/\.0$/, '');
    if (targetNik) {
      return resolveRecapShiftContext(tanggal, targetNik, timeValue, eventType, jadwalCache);
    }
    return resolveFactoryWorkDate(tanggal, timeValue, eventType);
  } catch (e) {
    Logger.log('SharedLib.resolveFactoryEventContext: failed - ' + e.message);
    return resolveFactoryWorkDate(tanggal, timeValue, eventType);
  }
}

function getExpectedShiftForNikOnDate(nik, tanggal) {
  try {
    if (typeof getKaryawanExpectedForDate !== 'function') return '';
    const expectedList = getKaryawanExpectedForDate(tanggal);
    if (!Array.isArray(expectedList)) return '';
    const targetNik = asText(nik).trim();
    for (let i = 0; i < expectedList.length; i++) {
      if (asText(expectedList[i].nik).trim() === targetNik) {
        return asText(expectedList[i].shift).trim();
      }
    }
    return '';
  } catch(e) {
    Logger.log('SharedLib.getExpectedShiftForNikOnDate: failed - ' + e.message);
    return '';
  }
}

function resolveRecapShiftContext(tanggal, nik, timeValue, eventType, jadwalCache) {
  try {
    const parseOptions = getFactoryOperationalDateParsingOptions_();
    const baseDate = parseIsoDate(tanggal) || parseSheetDate(tanggal, parseOptions);
    if (!baseDate) {
      return { tanggal: asText(tanggal).trim(), tanggalValue: null, shiftLabel: inferShiftByEventTime(timeValue, eventType), source: 'raw' };
    }

    const currentDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const previousDate = new Date(currentDate);
    previousDate.setDate(previousDate.getDate() - 1);

    const currentLabel = formatDate(currentDate);
    const previousLabel = formatDate(previousDate);

    // Gunakan jadwalCache jika tersedia (batch mode), fallback ke sheet read
    function getExpected(tanggalLabel) {
      if (jadwalCache && typeof jadwalCache.getForDate === 'function') {
        return jadwalCache.getForDate(tanggalLabel);
      }
      return getKaryawanExpectedForDate(tanggalLabel);
    }

    function getShiftForNik(expectedList) {
      const targetNik = asText(nik).trim();
      for (let i = 0; i < expectedList.length; i++) {
        if (asText(expectedList[i].nik).trim() === targetNik) return asText(expectedList[i].shift).trim();
      }
      return '';
    }

    const expectedToday = getShiftForNik(getExpected(currentLabel));
    const expectedPrev  = getShiftForNik(getExpected(previousLabel));
    const inferredShift = inferShiftByEventTime(timeValue, eventType);
    const minute = timeStrToMinutes(timeValue);

    if (eventType === 'keluar') {
      if (expectedPrev === 'Shift 3' && matchesShiftEventTime('Shift 3', timeValue, 'keluar')) {
        return { tanggal: previousLabel, tanggalValue: new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate()), shiftLabel: 'Shift 3', source: 'jadwal_prev' };
      }
      if (expectedToday && matchesShiftEventTime(expectedToday, timeValue, 'keluar')) {
        return { tanggal: currentLabel, tanggalValue: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()), shiftLabel: expectedToday, source: 'jadwal_today' };
      }
      if (inferredShift === 'Shift 3' && minute !== null && minute <= (7 * 60)) {
        return { tanggal: previousLabel, tanggalValue: new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate()), shiftLabel: 'Shift 3', source: 'infer_prev' };
      }
      return { tanggal: currentLabel, tanggalValue: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()), shiftLabel: expectedToday || inferredShift || '', source: 'default_keluar' };
    }

    if (expectedToday && matchesShiftEventTime(expectedToday, timeValue, 'masuk')) {
      return { tanggal: currentLabel, tanggalValue: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()), shiftLabel: expectedToday, source: 'jadwal_today' };
    }
    return { tanggal: currentLabel, tanggalValue: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()), shiftLabel: expectedToday || inferredShift || '', source: 'default_masuk' };
  } catch(e) {
    Logger.log('SharedLib.resolveRecapShiftContext: failed - ' + e.message);
    return { tanggal: asText(tanggal).trim(), tanggalValue: null, shiftLabel: '', source: 'error' };
  }
}

/**
 * Hitung menit keterlambatan.
 * Nilai negatif = hadir sebelum jam shift mulai (on time).
 * @param {string|Date} jamMasukValue - jam masuk aktual
 * @param {string} shiftLabel         - 'Shift 1' / 'Shift 2' / 'Shift 3'
 * @returns {number|null}             - null jika data tidak valid
 */
function getLateMinutes(jamMasukValue, shiftLabel) {
  try {
    const cfg = getShiftDefinition_(shiftLabel);
    if (!cfg) return null;
    const actual = timeStrToMinutes(jamMasukValue);
    if (actual === null) return null;
    return actual - cfg.startTotal;
  } catch(e) {
    Logger.log('SharedLib.getLateMinutes: failed — ' + e.message);
    return null;
  }
}

/**
 * Kategorikan keterlambatan berdasarkan menit.
 * @param {number|null} minutes
 * @returns {'ontime'|'ringan'|'sedang'|'berat'|'unknown'}
 */
function getLateCategory(minutes) {
  if (minutes === null || minutes === undefined) return 'unknown';
  if (minutes <= 0)  return 'ontime';
  if (minutes < 15)  return 'ringan';   //  1 – 14 menit
  if (minutes < 30)  return 'sedang';   // 15 – 29 menit
  return 'berat';                        // >= 30 menit
}

/**
 * Hitung menit lembur (jam keluar aktual melebihi jam selesai shift).
 * Mengembalikan 0 jika belum keluar atau belum lewat jam shift selesai.
 * Shift 3 (cross-midnight): jam keluar < 06:00 dihitung sebagai lembur jika > endTotal.
 * @param {string|Date} jamKeluarValue - jam keluar aktual
 * @param {string} shiftLabel           - 'Shift 1' / 'Shift 2' / 'Shift 3'
 * @returns {number}                    - menit lembur (0 jika tidak ada)
 */
function getOvertimeMinutes(jamKeluarValue, shiftLabel) {
  try {
    const range = getShiftRange_(shiftLabel);
    if (!range) return 0;
    const actual = timeStrToMinutes(jamKeluarValue);
    if (actual === null) return 0;
    const match = getShiftEventMatch_(shiftLabel, actual, 'keluar');
    const effectiveActual = match.actualAbs !== null ? match.actualAbs : actual;
    const over = effectiveActual - range.endAbs;
    return over > 0 ? over : 0;
  } catch(e) {
    Logger.log('SharedLib.getOvertimeMinutes: failed — ' + e.message);
    return 0;
  }
}

function getEarlyLeaveMinutes(jamKeluarValue, shiftLabel) {
  try {
    const range = getShiftRange_(shiftLabel);
    if (!range) return 0;
    const actual = timeStrToMinutes(jamKeluarValue);
    if (actual === null) return 0;
    const match = getShiftEventMatch_(shiftLabel, actual, 'keluar');
    const effectiveActual = match.actualAbs !== null ? match.actualAbs : actual;
    const early = range.endAbs - effectiveActual;
    return early > 0 ? early : 0;
  } catch (e) {
    Logger.log('SharedLib.getEarlyLeaveMinutes: failed - ' + e.message);
    return 0;
  }
}

/**
 * Format menit ke string ringkas, misal: 89 → "1j 29m", 14 → "14m"
 * @param {number} minutes
 * @returns {string}
 */
function formatDurationMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m + 'm';
  return h + 'j ' + (m > 0 ? m + 'm' : '');
}

// ---- LOCKING ----

/**
 * Lock GLOBAL — dipakai untuk operasi berat seperti repair & jadwal.
 * JANGAN gunakan untuk gate scan (pakai withCardLock).
 */
function withDocumentLock(work) {
  const MAX_ATTEMPTS = 3;
  const LOCK_WAIT_MS = 30000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Prioritaskan document lock agar operasi sheet berat tidak
    // memblokir withCardLock(), yang memakai script lock singkat
    // untuk semaphore per-kartu.
    const lock = LockService.getDocumentLock() || LockService.getScriptLock();
    if (lock.tryLock(LOCK_WAIT_MS)) {
      try {
        return work();
      } finally {
        lock.releaseLock();
      }
    }
    if (attempt < MAX_ATTEMPTS) {
      Utilities.sleep(500 + attempt * 300);
    }
  }
  return { ok: false, msg: 'Sistem sedang sibuk. Silakan coba lagi.' };
}

/**
 * Lock PER KARTU — untuk gate scan masuk/keluar.
 *
 * Cara kerja:
 *   1. Ambil global lock hanya ~200ms untuk check-then-set per-card lock
 *      di PropertiesService (atomic, tidak bisa race condition).
 *   2. Lepas global lock → kartu LAIN bisa scan paralel sekarang.
 *   3. Jalankan fn() tanpa global lock.
 *   4. Selesai → hapus card lock.
 *
 * Hasil: 100 kartu berbeda = 100 proses paralel, tidak saling block.
 * Global lock hanya dipakai 100–200ms, bukan 1–5 detik.
 *
 * @param {string} cardNo - Nomor kartu / NIK
 * @param {function} fn   - Fungsi yang dijalankan setelah card lock berhasil
 * @returns {*} Hasil dari fn(), atau { ok:false, msg } jika gagal dapat lock
 */
function withCardLock(cardNo, fn) {
  const CARD_LOCK_TTL_MS  = 90 * 1000;  // lock expire otomatis setelah 90 detik
  const GLOBAL_LOCK_MS    = 5000;        // max tunggu global lock (hanya untuk set props)
  const lockKey           = 'CKLK_' + String(cardNo).replace(/[^A-Z0-9]/gi, '_');
  const ps                = PropertiesService.getScriptProperties();

  // Step 1: Global lock sebentar hanya untuk atomic check-then-set
  const globalLock = LockService.getScriptLock();
  if (!globalLock.tryLock(GLOBAL_LOCK_MS)) {
    return { ok: false, msg: 'Sistem terlalu sibuk, coba scan ulang.' };
  }

  let cardLocked = false;
  try {
    const existing = ps.getProperty(lockKey);
    if (existing) {
      const ageMs = Date.now() - parseInt(existing, 10);
      if (ageMs < CARD_LOCK_TTL_MS) {
        // Kartu ini sedang diproses oleh request lain
        return { ok: false, msg: 'Kartu sedang diproses, coba scan ulang dalam beberapa detik.' };
      }
      // Lock lama sudah expire (script crash sebelumnya), lanjut
    }
    ps.setProperty(lockKey, String(Date.now()));
    cardLocked = true;
  } finally {
    globalLock.releaseLock(); // Lepas global lock secepat mungkin
  }

  // Step 2: Jalankan operasi scan TANPA global lock
  // → kartu lain bisa scan paralel sekarang
  try {
    return fn();
  } finally {
    if (cardLocked) {
      try { ps.deleteProperty(lockKey); } catch(e) {}
    }
  }
}

// ---- VALIDATION ----

function assertCard(noKartuMK) {
  const no = normalizeCard(noKartuMK);
  if (!no) throw new Error('Nomor kartu MK kosong.');
  if (!/^[A-Z0-9_-]{3,32}$/.test(no)) throw new Error('Format nomor kartu MK tidak valid.');
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
  const parsedDate = parseSheetDate(tanggal, getFactoryOperationalDateParsingOptions_());
  const normDate = parsedDate ? formatDate(parsedDate) : asText(tanggal).trim();
  const normNik = asText(nik).trim().replace(/\.0$/, '');
  return normDate + '|' + normNik;
}

function getRecapSourceSnapshot(nik, recapTanggal) {
  try {
    const targetNik = asText(nik).trim();
    const targetTanggal = asText(recapTanggal).trim();
    const snapshot = {
      nama: '',
      dept: '',
      jabatan: '',
      jamMasuk: '',
      jamKeluar: '',
      noKartuMK: '',
      noLoker: ''
    };

    if (!targetNik || !targetTanggal) return snapshot;

    const master = getKaryawanByNIK(targetNik) || {};
    snapshot.nama = asText(master.nama);
    snapshot.dept = asText(master.dept);
    snapshot.jabatan = asText(master.jabatan);

    function absorbRow(row, eventType) {
      const rowNik = asText(row[1]).trim();
      if (rowNik !== targetNik) return;

      const rowTanggal = parseSheetDate(row[3]) ? formatDate(parseSheetDate(row[3])) : asText(row[3]).trim();
      const rowJam = normalizeTimeValue(row[4]);
      if (!rowTanggal || !rowJam) return;

      const recapContext = resolveRecapShiftContext(rowTanggal, targetNik, rowJam, eventType);
      if (asText(recapContext.tanggal).trim() !== targetTanggal) return;

      const rowNama = asText(row[2]).trim();
      const rowKartu = normalizeCard(row[0]);
      const rowLoker = asText(row[6] || '').trim();

      if (!snapshot.nama && rowNama) snapshot.nama = rowNama;
      if (!snapshot.noKartuMK && rowKartu) snapshot.noKartuMK = rowKartu;
      if (!snapshot.noLoker && rowLoker) snapshot.noLoker = rowLoker;

      if (eventType === 'masuk') {
        if (!snapshot.jamMasuk || compareTimeValues(rowJam, snapshot.jamMasuk) < 0) {
          snapshot.jamMasuk = rowJam;
          if (rowKartu) snapshot.noKartuMK = rowKartu;
          if (rowLoker) snapshot.noLoker = rowLoker;
        }
        return;
      }

      if (!snapshot.jamKeluar || compareTimeValues(rowJam, snapshot.jamKeluar) > 0) {
        snapshot.jamKeluar = rowJam;
        if (!snapshot.noKartuMK && rowKartu) snapshot.noKartuMK = rowKartu;
        if (!snapshot.noLoker && rowLoker) snapshot.noLoker = rowLoker;
      }
    }

    const masukData = getSheet(SHEET_MASUK_PABRIK).getDataRange().getValues();
    for (let i = 1; i < masukData.length; i++) absorbRow(masukData[i], 'masuk');

    const keluarData = getSheet(SHEET_KELUAR_PABRIK).getDataRange().getValues();
    for (let i = 1; i < keluarData.length; i++) absorbRow(keluarData[i], 'keluar');

    return snapshot;
  } catch(e) {
    Logger.log('SharedLib.getRecapSourceSnapshot: failed - ' + e.message);
    return {
      nama: '',
      dept: '',
      jabatan: '',
      jamMasuk: '',
      jamKeluar: '',
      noKartuMK: '',
      noLoker: ''
    };
  }
}

// ---- KARYAWAN LOOKUP ----

function getKaryawanMapByNIK() {
  const sheet = getSheet(SHEET_KARYAWAN);
  const data = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < data.length; i++) {
    const nik = asText(data[i][0]).trim();
    const nama = asText(data[i][1]).trim();
    if (!nik || !nama) continue; // Skip ghost rows or empty NIK/Nama
    map[nik] = {
      nik,
      nama: nama,
      type: asText(data[i][2]).trim() || 'TIDAK_ADA_DATA',
      dept: asText(data[i][3]).trim() || 'TIDAK_ADA_DATA',
      jabatan: asText(data[i][4]).trim() || 'TIDAK_ADA_DATA',
      userLevel: asText(data[i][5]).toUpperCase().trim() || 'USER',
      password: asText(data[i][6]).trim()
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
      const nama = asText(data[i][1]).trim();
      if (!nama) continue; // Skip ghost rows
      return {
        nik: target,
        nama: nama,
        type: asText(data[i][2]).trim() || 'TIDAK_ADA_DATA',
        dept: asText(data[i][3]).trim() || 'TIDAK_ADA_DATA',
        jabatan: asText(data[i][4]).trim() || 'TIDAK_ADA_DATA',
        userLevel: asText(data[i][5]).toUpperCase().trim() || 'USER'
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
      depts: getAvailableDepts(karyawanMap),
      sessionToken: generateSessionToken_(nik)
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

// ---- ANDROID SESSION TOKEN (real bearer token, bukan lookup by NIK) ----

const ANDROID_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

/**
 * Terbitkan session token baru untuk NIK yang berhasil login, simpan di
 * SHEET_ANDROID_SESSIONS. Dipanggil dari verifyLogin() — dipakai jalur Android saja,
 * jalur web (google.script.run) tetap memakai verifySession(nik) seperti sebelumnya.
 */
function generateSessionToken_(nik) {
  const token = Utilities.getUuid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ANDROID_SESSION_TTL_MS);
  const sheet = getSheet(SHEET_ANDROID_SESSIONS);
  sheet.appendRow([token, asText(nik).trim(), now.toISOString(), expiresAt.toISOString()]);

  // Sweep sesekali (bukan setiap login) supaya sheet tidak tumbuh tanpa batas.
  if (Math.random() < 0.05) {
    try { cleanupExpiredAndroidSessions_(); } catch(e) {
      Logger.log('SharedLib.generateSessionToken_: cleanup gagal — ' + e.message);
    }
  }

  return token;
}

/**
 * Hapus baris session yang sudah lewat EXPIRES_AT dari SHEET_ANDROID_SESSIONS.
 */
function cleanupExpiredAndroidSessions_() {
  const sheet = getSheet(SHEET_ANDROID_SESSIONS);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const rowsToDelete = [];

  for (let i = 1; i < data.length; i++) {
    const expiresAt = new Date(data[i][3]);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < now.getTime()) {
      rowsToDelete.push(i + 1); // 1-indexed sheet row
    }
  }

  for (let j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
}

/**
 * Validasi token bearer Android terhadap SHEET_ANDROID_SESSIONS.
 * @returns {{nik: string}|null}
 */
function validateSessionToken_(token) {
  const target = asText(token).trim();
  if (!target) return null;

  const sheet = getSheet(SHEET_ANDROID_SESSIONS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (asText(data[i][0]).trim() !== target) continue;

    const expiresAt = new Date(data[i][3]);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return null;
    }
    return { nik: asText(data[i][1]).trim() };
  }
  return null;
}

/**
 * Verifikasi session Android yang sesungguhnya (verifikasi token, bukan lookup by NIK).
 * Dipakai khusus oleh Code.js::doPost() action 'verifySession' untuk Android.
 */
function verifySessionToken_(token) {
  try {
    const validated = validateSessionToken_(token);
    if (!validated) {
      return { ok: false, msg: 'Sesi tidak valid atau kadaluarsa, silakan login ulang.' };
    }

    const karyawanMap = getKaryawanMapByNIK();
    const k = karyawanMap[validated.nik];
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

/**
 * Guard dipakai doPost() sebelum menjalankan action mutasi/PII Android
 * (bindKartu, releaseKartu, scanAreaKerja, submitGateRequest, getKaryawanByNIK).
 */
function requireAndroidSessionToken_(payload) {
  const validated = validateSessionToken_(payload && payload.sessionToken);
  if (!validated) {
    return { ok: false, msg: 'Sesi tidak valid atau kadaluarsa, silakan login ulang.' };
  }
  return { ok: true };
}

/**
 * API key Android — dibaca dari Script Properties supaya bisa dirotasi tanpa
 * deploy ulang kode. Fallback ke literal lama agar deployment existing tidak putus
 * sebelum Script Property 'ANDROID_API_KEY' diisi.
 */
function getAndroidApiKey_() {
  const stored = PropertiesService.getScriptProperties().getProperty('ANDROID_API_KEY');
  return stored || 'DAM_ANDROID_SECURE_KEY_2026';
}

// ---- GAS TEMPLATE ----

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---- ROUTING / CONFIG ----
// CONFIG_MODUL sheet dikelola SEPENUHNYA oleh: npm run deploy
// Jangan pernah tulis URL ke CONFIG_MODUL secara manual dari GAS Editor.
// Source of truth satu-satunya: scripts/module-config.json

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
