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
      .addSeparator()
      .addItem('⏰ Aktifkan Auto-Repair Malam Hari', 'setupNightlyDataRepairTrigger')
      .addItem('🌙 Nonaktifkan Auto-Repair Malam Hari', 'disableNightlyDataRepairTrigger')
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

// ============================================================
//  ENTRY POINT - Android App API (doPost)
// ============================================================
function getIsoWeekCodeForApi_(dateValue) {
  const base = dateValue instanceof Date && !isNaN(dateValue.getTime())
    ? new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()))
    : new Date();
  const day = base.getUTCDay() || 7;
  base.setUTCDate(base.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(base.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((base - yearStart) / 86400000) + 1) / 7);
  return base.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

function resolveAndroidAbsenPeriod_(payload) {
  const periodType = asText(payload && payload.periodType).trim().toLowerCase();
  const periodValue = asText(payload && payload.periodValue).trim();
  if (periodType && periodValue) {
    return { periodType: periodType, periodValue: periodValue };
  }

  const startDate = parseIsoDate(payload && payload.startDate);
  const endDate = parseIsoDate(payload && payload.endDate);
  if (startDate && endDate) {
    const sameDay = Utilities.formatDate(startDate, 'Asia/Jakarta', 'yyyyMMdd') === Utilities.formatDate(endDate, 'Asia/Jakarta', 'yyyyMMdd');
    if (sameDay) {
      return {
        periodType: 'date',
        periodValue: Utilities.formatDate(endDate, 'Asia/Jakarta', 'yyyy-MM-dd')
      };
    }

    const sameMonth = Utilities.formatDate(startDate, 'Asia/Jakarta', 'yyyyMM') === Utilities.formatDate(endDate, 'Asia/Jakarta', 'yyyyMM');
    if (sameMonth) {
      return {
        periodType: 'month',
        periodValue: Utilities.formatDate(endDate, 'Asia/Jakarta', 'yyyy-MM')
      };
    }

    const sameWeek = getIsoWeekCodeForApi_(startDate) === getIsoWeekCodeForApi_(endDate);
    if (sameWeek) {
      return {
        periodType: 'week',
        periodValue: getIsoWeekCodeForApi_(endDate)
      };
    }
  }

  const fallbackDate = endDate || startDate || nowWIB();
  return {
    periodType: 'week',
    periodValue: getIsoWeekCodeForApi_(fallbackDate)
  };
}

function doPost(e) {
  const API_KEY = getAndroidApiKey_(); // Rotatable via Script Property 'ANDROID_API_KEY'

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ ok: false, msg: 'Invalid request: No payload.' });
    }

    const payload = JSON.parse(e.postData.contents);
    const apiKey = payload.apiKey;
    
    if (apiKey !== API_KEY) {
      return responseJson({ ok: false, msg: 'Invalid API Key / Unauthorized.' });
    }

    const action = payload.action;
    let result = { ok: false, msg: 'Unknown action' };

    // API Router
    switch(action) {
      case 'verifyLogin':
        result = verifyLogin(payload.nik, payload.password);
        break;
      case 'verifySession':
        result = verifySessionToken_(payload.sessionToken);
        break;
      case 'getBindingStatus':
        result = getBindingStatus(payload.noKartuMK);
        break;
      case 'submitGateRequest': {
        const sessionCheckSGR = requireAndroidSessionToken_(payload);
        if (!sessionCheckSGR.ok) { result = sessionCheckSGR; break; }
        result = submitGateRequest(payload);
        break;
      }
      case 'getGateRequestStatus':
        result = getGateRequestStatus(payload.requestId);
        break;
      case 'pingAndroidGateway':
        result = pingAndroidGateway(payload);
        break;
      case 'logAndroidDiagnostics':
        result = logAndroidDiagnostics(payload);
        break;
      case 'bindKartu': {
        const sessionCheckBind = requireAndroidSessionToken_(payload);
        if (!sessionCheckBind.ok) { result = sessionCheckBind; break; }
        result = bindKartu(payload.noKartuMK, payload.nik, payload.loker, payload.lat, payload.lng);
        break;
      }
      case 'releaseKartu': {
        const sessionCheckRelease = requireAndroidSessionToken_(payload);
        if (!sessionCheckRelease.ok) { result = sessionCheckRelease; break; }
        result = releaseKartu(payload.noKartuMK, payload.loker, payload.lat, payload.lng);
        break;
      }
      case 'scanAreaKerja': {
        const sessionCheckScan = requireAndroidSessionToken_(payload);
        if (!sessionCheckScan.ok) { result = sessionCheckScan; break; }
        result = scanAreaKerja(payload.noKartuMK, payload.tujuan, payload.catatan, payload.forceMode);
        break;
      }
      case 'getDashboardData':
        result = getDashboardData(payload.basis, payload.basisValue, payload.deptFilter, payload.typeFilter, payload.basisDate);
        break;
      case 'getKehadiranDashboard':
        result = getKehadiranDashboard(
          payload.tanggal,
          payload.shiftFilter,
          payload.deptFilter,
          payload.typeFilter,
          {
            detailLimit: payload.detailLimit,
            anomaliLimit: payload.anomaliLimit,
            useCache: payload.useCache
          }
        );
        break;
      case 'getRecentAreaLogs':
        result = getRecentAreaLogs(payload.limit);
        break;
      case 'getAreaActivityReport':
        result = getAreaActivityReport(
          payload.nik,
          payload.deptFilter,
          payload.periodType,
          payload.periodValue,
          payload.page,
          payload.pageSize,
          payload.recapPage,
          payload.recapPageSize,
          payload.search,
          payload.sort
        );
        break;
      case 'getAbsenReport':
        var reportPeriod = resolveAndroidAbsenPeriod_(payload);
        result = getAbsenReport(
          payload.nik,
          payload.deptFilter,
          reportPeriod.periodType,
          reportPeriod.periodValue,
          payload.page,
          payload.pageSize,
          payload.search,
          payload.sort,
          payload.typeFilter
        );
        break;
      case 'searchKaryawan':
        result = searchKaryawan(payload.query);
        break;
      case 'getKaryawanByNIK': {
        const sessionCheckLookup = requireAndroidSessionToken_(payload);
        if (!sessionCheckLookup.ok) { result = sessionCheckLookup; break; }
        var karyawan = getKaryawanByNIK(payload.nik);
        result = karyawan
          ? { ok: true, karyawan: makeKaryawanPayload(karyawan) }
          : { ok: false, msg: 'NIK tidak ditemukan: ' + asText(payload.nik).trim() };
        break;
      }
      default:
        result = { ok: false, msg: 'Action not mapped: ' + action };
    }

    return responseJson(result);

  } catch (err) {
    return responseJson({ ok: false, msg: 'Server error: ' + err.message });
  }
}

function responseJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
