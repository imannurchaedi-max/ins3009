// ============================================================
//  NFC DAM ACCESS CONTROL SYSTEM — REPORT MODULE
//  PT Daya Anugrah Mulya
//  Google Apps Script - Backend
//  Updated: 2026-06-03 (Refactored — utilities moved to SharedLib.gs)
//  Dependencies: SharedLib.gs (all constants, utilities, auth, lookup)
// ============================================================

// ============================================================
//  ENTRY POINT - Web App
// ============================================================
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.sessionNik = (e && e.parameter && e.parameter.nik) ? e.parameter.nik : '';
  return template
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

// ============================================================
//  REPORT MODULE — getAbsenReport, getAreaActivityReport
// ============================================================
function toDateKey(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Asia/Jakarta', 'yyyyMMdd');
  }

  const text = asText(value).trim();
  let match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return match[3] + match[2] + match[1];

  match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return match[1] + match[2] + match[3];

  return formatDateForSort(text);
}

function buildAbsenReportCacheKey(nik, deptFilter, periodType, periodValue) {
  return [
    'absen',
    asText(nik).trim() || '-',
    asText(deptFilter).trim() || '-',
    asText(periodType).trim() || '-',
    asText(periodValue).trim() || '-'
  ].join(':');
}

function getAbsenReport(nik, deptFilter, periodType, periodValue) {
  try {
    const targetNik = asText(nik).trim();
    const filterDpt = asText(deptFilter).trim();
    if (!targetNik && !filterDpt) return { ok: false, msg: 'Kriteria pencarian (NIK atau Departemen) wajib diisi.' };

    const range = getPeriodRange(periodType, periodValue);
    const cache = CacheService.getScriptCache();
    const cacheKey = buildAbsenReportCacheKey(targetNik, filterDpt, periodType, periodValue);
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const sheet = getSheet(SHEET_RECAP_ABSEN);
    const lastRow = sheet.getLastRow();
    const width = SHEET_HEADERS[SHEET_RECAP_ABSEN].length;
    if (lastRow <= 1) {
      const emptyResult = { ok: true, period: range.label, total: 0, complete: 0, active: 0, data: [] };
      cache.put(cacheKey, JSON.stringify(emptyResult), 90);
      return emptyResult;
    }

    const data = sheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();
    const startKey = Utilities.formatDate(range.start, 'Asia/Jakarta', 'yyyyMMdd');
    const endKey = Utilities.formatDate(range.end, 'Asia/Jakarta', 'yyyyMMdd');

    const rows = [];
    let complete = 0;
    let active = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const dateKey = toDateKey(row[0]);
      if (!dateKey || dateKey < startKey || dateKey > endKey) continue;

      const rowNik = asText(row[1]).trim();
      const rowDept = asText(row[3]).trim();
      
      if (targetNik && rowNik !== targetNik) continue;
      if (filterDpt && rowDept !== filterDpt) continue;

      const status = asText(row[7]);
      if (status === 'SELESAI') complete++;
      if (status === 'DI DALAM') active++;

      rows.push({
        tanggal: asText(row[0]),
        nik: rowNik,
        nama: asText(row[2]),
        dept: rowDept,
        jabatan: asText(row[4]),
        jamMasuk: asText(row[5]),
        jamKeluar: asText(row[6]),
        status,
        noKartuMK: asText(row[8]),
        noLoker: asText(row[9]),
        sortKey: dateKey + '|' + asText(row[5] || '')
      });
    }

    rows.sort(function(a, b) {
      return a.sortKey === b.sortKey ? a.jamMasuk.localeCompare(b.jamMasuk) : a.sortKey.localeCompare(b.sortKey);
    });
    rows.forEach(function(row) { delete row.sortKey; });

    const result = {
      ok: true,
      period: range.label,
      total: rows.length,
      complete,
      active,
      data: rows
    };
    cache.put(cacheKey, JSON.stringify(result), 90);
    return result;
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
