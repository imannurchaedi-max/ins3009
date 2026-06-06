// ============================================================
//  NFC DAM ACCESS CONTROL SYSTEM — HOME PORTAL MODULE
//  PT Daya Anugrah Mulya
//  Google Apps Script - Backend Entry Point
//  Updated: 2026-06-06 (Consolidated single-page shell)
//  Dependencies: SharedLib.gs, Functions.gs
// ============================================================

// ============================================================
//  ENTRY POINT - Web App
// ============================================================
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
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
//  SEARCH KARYAWAN (autocomplete)
// ============================================================
function searchKaryawan(q) {
  try {
    const query = asText(q).trim().toUpperCase();
    if (!query || query.length < 2) return { ok: true, data: [] };

    const allKaryawan = getAllKaryawan();
    const results = allKaryawan
      .filter(k => {
        const nik  = asText(k.nik).toUpperCase();
        const nama = asText(k.nama).toUpperCase();
        return nik.includes(query) || nama.includes(query);
      })
      .slice(0, 15)
      .map(k => ({
        nik:     asText(k.nik),
        nama:    asText(k.nama),
        dept:    asText(k.dept),
        jabatan: asText(k.jabatan),
        type:    asText(k.type)
      }));

    return { ok: true, data: results };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}
