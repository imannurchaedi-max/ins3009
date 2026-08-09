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
  template.initialTab = (e && e.parameter && e.parameter.tab) ? e.parameter.tab : '';
  return template.evaluate()
    .setTitle('DAM Access Control')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('DAM Access Control')
      .addItem('Buka Portal DAM', 'openHomePortalLauncher')
      .addSeparator()
      .addItem('1. Repair Shift Log Masuk', 'repairFactoryMasukLog')
      .addItem('2. Repair Shift Log Keluar', 'repairFactoryKeluarLog')
      .addItem('3. Rebuild Recap Absen Dari Log', 'rebuildRecapAbsenInOutMK')
      .addSeparator()
      .addItem('🛠️ Fix & Clean All Spreadsheet Errors', 'fixAllSpreadsheetErrors')
      .addToUi();
  } catch(e) {
    Logger.log('Menu spreadsheet tidak tersedia: ' + e.message);
  }
}

function showRepairProgressDialog_(jobType, title, description) {
  const template = HtmlService.createTemplateFromFile('RepairProgressDialog');
  template.jobType = asText(jobType);
  template.dialogTitle = asText(title);
  template.dialogDescription = asText(description);

  const html = template.evaluate()
    .setWidth(540)
    .setHeight(620);

  SpreadsheetApp.getUi().showModelessDialog(
    html,
    asText(title) || 'Progress Perbaikan'
  );
}

function openHomePortalLauncher() {
  const ui = SpreadsheetApp.getUi();
  const urls = getModuleUrls();
  const portalUrl = asText(urls && urls.HOME_PORTAL).trim();

  if (!portalUrl) {
    ui.alert(
      'Portal DAM belum tersedia',
      'URL HOME_PORTAL belum terisi di CONFIG_MODUL. Jalankan deploy agar link resmi tersinkron.',
      ui.ButtonSet.OK
    );
    return;
  }

  const safeUrl = portalUrl
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 24px;
            color: #17324d;
            background: #f7fafc;
          }
          .card {
            background: #ffffff;
            border: 1px solid #d8e1ea;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(23, 50, 77, 0.08);
          }
          h2 {
            margin: 0 0 12px;
            font-size: 22px;
          }
          p {
            margin: 0 0 14px;
            font-size: 14px;
            line-height: 1.6;
          }
          .actions {
            margin-top: 20px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .btn {
            display: inline-block;
            padding: 12px 18px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 700;
            font-size: 14px;
          }
          .btn-primary {
            background: #1f5f97;
            color: #ffffff;
          }
          .url-box {
            margin-top: 16px;
            padding: 12px;
            background: #f3f7fb;
            border: 1px solid #d8e1ea;
            border-radius: 10px;
            word-break: break-all;
            font-size: 12px;
            color: #4a6076;
          }
          .note {
            margin-top: 16px;
            font-size: 12px;
            color: #5f7285;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Portal DAM Resmi</h2>
          <p>Gunakan tombol di bawah ini untuk membuka portal DAM dari link resmi yang aktif saat ini.</p>
          <p>Launcher ini selalu membaca URL <strong>HOME_PORTAL</strong> dari sheet <strong>CONFIG_MODUL</strong>, jadi user tidak lagi diarahkan ke link lama.</p>
          <div class="actions">
            <a class="btn btn-primary" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Buka Portal DAM</a>
          </div>
          <div class="url-box">${safeUrl}</div>
          <div class="note">Jika tab DAM lama masih terbuka, tutup dulu tab itu lalu buka ulang dari tombol ini.</div>
        </div>
      </body>
    </html>
  `).setWidth(520).setHeight(340);

  ui.showModalDialog(html, 'Buka Portal DAM');
}

// searchKaryawan tersedia di SharedLib.gs (implementasi yang benar & lengkap)
// Dihapus dari sini karena: duplikat, memanggil getAllKaryawan() yang tidak ada → crash
