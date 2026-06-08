// ============================================================
//  NFC DAM ACCESS CONTROL SYSTEM — HOME PORTAL MODULE
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
//  DASHBOARD DATA
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
//  LOG AREA KERJA TERBARU (untuk security monitor)
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