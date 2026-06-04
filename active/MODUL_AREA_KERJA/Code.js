// ============================================================
//  NFC DAM ACCESS CONTROL SYSTEM — AREA KERJA MODULE
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
//  SCAN AREA KERJA (Area-specific business logic)
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
          nik: asText(data[i][1]), nama: asText(data[i][2]),
          dept: asText(data[i][3]), jabatan: asText(data[i][4]),
          waktuBind: asText(data[i][5]), status: asText(data[i][6]) || 'FREE',
          waktuRelease: asText(data[i][7]), row: i + 1
        };
      }
    }

    const kar = getKaryawanByNIK(no);
    if (kar && !isExternalKaryawan(kar)) {
      const todayStatus = getFactoryRecapStatus(kar.nik, formatDate(nowWIB()));
      if (todayStatus === 'DI DALAM') {
        return {
          ok: true, noKartuMK: no, nik: kar.nik, nama: kar.nama,
          dept: kar.dept, jabatan: kar.jabatan, waktuBind: 'ID Card internal',
          status: 'BOUND', waktuRelease: '', row: 0, isInternalId: true
        };
      }
    }
    return { ok: true, status: 'FREE', noKartuMK: no };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

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
          nik: binding.nik, nama: binding.nama,
          type: asText(master.type), dept: binding.dept || asText(master.dept),
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
        if (normalizeCard(dataA[i][0]) === no) { lastInOut = asText(dataA[i][1]); break; }
      }


      let inout = '';
      if (forceMode === 'IN') inout = 'IN';
      else if (forceMode === 'OUT') inout = 'OUT';
      else inout = (lastInOut === 'OUT') ? 'IN' : 'OUT';

      sheetA.appendRow([
        no,
        inout,
        tanggal,
        formatTime(now),
        kar.nik,
        kar.nama,
        kar.dept || '',
        kar.jabatan || ''
      ]);

      return {
        ok: true, inout, noKartuMK: no, karyawan: kar, waktu,
        msg: `${kar.nama} -> ${inout === 'IN' ? 'MASUK Area Kerja' : 'KELUAR Area Kerja'}`
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
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
          nik: asText(dataB[i][1]), nama: asText(dataB[i][2]),
          dept: asText(dataB[i][3]), jabatan: asText(dataB[i][4]),
          waktuBind: asText(dataB[i][5])
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

    return { ok: true, totalBound, boundList, logAreaKerjaHariIni: logHariIni };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
//  LOG AREA KERJA TERBARU
// ============================================================
function getRecentAreaLogs(limit) {
  try {
    const n = Math.max(1, Math.min(parseInt(limit, 10) || 30, 100));
    const sheetA = getSheet(SHEET_AREA_KERJA);
    const data   = sheetA.getDataRange().getValues();
    const rows   = [];
    for (let i = data.length - 1; i >= 1 && rows.length < n; i--) {
      rows.push({
        noKartuMK: normalizeCard(data[i][0]), inout: asText(data[i][1]),
        tanggal: asText(data[i][2]), jam: asText(data[i][3]),
        nik: asText(data[i][4]), nama: asText(data[i][5])
      });
    }
    return { ok: true, data: rows };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}