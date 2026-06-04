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