// ============================================================
//  NFC DAM ACCESS CONTROL SYSTEM — ROOT MODULE
//  PT Daya Anugrah Mulya
//  Google Apps Script - Backend
//  Updated: 2026-06-03 (Refactored — utilities moved to SharedLib.gs)
//  Dependencies: SharedLib.gs (all constants, utilities, auth, lookup)
// ============================================================

// ============================================================
//  CONFIG MODUL UPDATER (run once after deploy all)
// ============================================================
function updateConfigModul() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('CONFIG_MODUL');
  if (!sheet) {
    sheet = ss.insertSheet('CONFIG_MODUL');
    sheet.appendRow(['NAMA_MODUL', 'LINK_MODUL']);
    sheet.getRange("A1:B1").setFontWeight("bold");
  }
  
  const urls = {
    GATE_PABRIK: 'https://script.google.com/macros/s/1c0FSMDSbEq-1RJw5lrM4n_jeTJmnY91RNwKzn2-cOXYoDnmzoVXnOrCp/exec',
    AREA_KERJA: 'https://script.google.com/macros/s/1UCEB_JhTT9BMP2ov9ifU2JVxT43I_5U8AqMuz5okZwU5oEd21Y86pMHk/exec',
    REPORT: 'https://script.google.com/macros/s/16kVGhvtDyouiDaRGrnB4laINc9_wVQMFezVpGAtK8mpUFTN8x79ZV9V1/exec'
  };
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const name = asText(data[i][0]).toUpperCase();
    if (urls[name]) {
      sheet.getRange(i + 1, 2).setValue(urls[name]);
    }
  }
  
  for (const [name, url] of Object.entries(urls)) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (asText(data[i][0]).toUpperCase() === name) found = true;
    }
    if (!found) {
      sheet.appendRow([name, url]);
    }
  }
  
  return { ok: true, msg: 'CONFIG_MODUL updated!' };
}

// ============================================================
//  ENTRY POINT - Web App
// ============================================================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  
  if (action === 'updateConfigModul') {
    const result = updateConfigModul();
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
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
//  RECAP ABSEN ENGINE (root-specific business logic)
// ============================================================
function updateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker) {
  const sheet = getSheet(SHEET_RECAP_ABSEN);
  const lastRow = sheet.getLastRow();
  const key = makeRecapKey(tanggal, nik);
  let targetRow = 0;
  let existingJamMasuk = '';
  let existingJamKeluar = '';

  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS[SHEET_RECAP_ABSEN].length).getValues();
    for (let i = 0; i < data.length; i++) {
      if (makeRecapKey(data[i][0], data[i][1]) === key) {
        targetRow = i + 2;
        existingJamMasuk = asText(data[i][5]);
        existingJamKeluar = asText(data[i][6]);
        if (!noKartuMK && data[i][8]) noKartuMK = asText(data[i][8]);
        if (!noLoker && data[i][9]) noLoker = asText(data[i][9]);
        break;
      }
    }
  }

  const finalJamMasuk = jamMasuk ? (existingJamMasuk && existingJamMasuk < jamMasuk ? existingJamMasuk : jamMasuk) : existingJamMasuk;
  const finalJamKeluar = jamKeluar ? (existingJamKeluar && existingJamKeluar > jamKeluar ? existingJamKeluar : jamKeluar) : existingJamKeluar;
  const row = [
    asText(tanggal),
    asText(nik),
    asText(nama),
    asText(dept),
    asText(jabatan),
    finalJamMasuk,
    finalJamKeluar,
    getRecapStatus(finalJamMasuk, finalJamKeluar),
    asText(noKartuMK || ''),
    asText(noLoker || '')
  ];

  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function safeUpdateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker) {
  try {
    updateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker);
  } catch(e) {
    Logger.log('Gagal update recap ABSEN IN OUT MK: ' + e.message);
  }
}

function rebuildRecapAbsenInOutMK(nik) {
  // Admin-only guard
  if (nik) {
    const auth = guardAdmin(nik);
    if (!auth.ok) return auth;
  }

  return withDocumentLock(function() {
    try {
      const recapSheet = getSheet(SHEET_RECAP_ABSEN);
      const karyawanMap = getKaryawanMapByNIK();
      const recap = {};

      const masukData = getSheet(SHEET_MASUK_PABRIK).getDataRange().getValues();
      for (let i = 1; i < masukData.length; i++) {
        const tanggal = asText(masukData[i][3]).trim();
        const jam = asText(masukData[i][4]).trim();
        const nik = asText(masukData[i][1]).trim();
        if (!tanggal || !nik) continue;

        const key = makeRecapKey(tanggal, nik);
        const kar = karyawanMap[nik] || {};
        if (!recap[key]) {
          recap[key] = {
            tanggal,
            nik,
            nama: asText(masukData[i][2]) || asText(kar.nama),
            dept: asText(kar.dept),
            jabatan: asText(kar.jabatan),
            jamMasuk: '',
            jamKeluar: '',
            noKartuMK: asText(masukData[i][0]),
            noLoker: asText(masukData[i][6])
          };
        }
        if (!recap[key].jamMasuk || jam < recap[key].jamMasuk) recap[key].jamMasuk = jam;
        if (!recap[key].noKartuMK) recap[key].noKartuMK = asText(masukData[i][0]);
        if (!recap[key].noLoker) recap[key].noLoker = asText(masukData[i][6]);
      }

      const keluarData = getSheet(SHEET_KELUAR_PABRIK).getDataRange().getValues();
      for (let i = 1; i < keluarData.length; i++) {
        const tanggal = asText(keluarData[i][3]).trim();
        const jam = asText(keluarData[i][4]).trim();
        const nik = asText(keluarData[i][1]).trim();
        if (!tanggal || !nik) continue;

        const key = makeRecapKey(tanggal, nik);
        const kar = karyawanMap[nik] || {};
        if (!recap[key]) {
          recap[key] = {
            tanggal,
            nik,
            nama: asText(keluarData[i][2]) || asText(kar.nama),
            dept: asText(kar.dept),
            jabatan: asText(kar.jabatan),
            jamMasuk: '',
            jamKeluar: '',
            noKartuMK: asText(keluarData[i][0]),
            noLoker: ''
          };
        }
        if (!recap[key].jamKeluar || jam > recap[key].jamKeluar) recap[key].jamKeluar = jam;
        if (!recap[key].noKartuMK) recap[key].noKartuMK = asText(keluarData[i][0]);
      }

      const rows = Object.keys(recap)
        .sort()
        .map(function(key) {
          const r = recap[key];
          return [
            r.tanggal,
            r.nik,
            r.nama,
            r.dept,
            r.jabatan,
            r.jamMasuk,
            r.jamKeluar,
            getRecapStatus(r.jamMasuk, r.jamKeluar),
            r.noKartuMK,
            r.noLoker
          ];
        });

      if (recapSheet.getLastRow() > 1) {
        recapSheet.getRange(2, 1, recapSheet.getLastRow() - 1, SHEET_HEADERS[SHEET_RECAP_ABSEN].length).clearContent();
      }
      if (rows.length) {
        recapSheet.getRange(2, 1, rows.length, SHEET_HEADERS[SHEET_RECAP_ABSEN].length).setValues(rows);
      }
      recapSheet.autoResizeColumns(1, SHEET_HEADERS[SHEET_RECAP_ABSEN].length);

      return { ok: true, rows: rows.length, msg: 'Recap ABSEN IN OUT MK berhasil digenerate.' };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

function syncRecapAbsenInOutMK() {
  return rebuildRecapAbsenInOutMK();
}

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

// ============================================================
//  1. LOOKUP KARYAWAN
// ============================================================
// ============================================================
//  BINDING KARTU MK (root-specific business logic)
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
          nik:        asText(data[i][1]),
          nama:       asText(data[i][2]),
          dept:       asText(data[i][3]),
          jabatan:    asText(data[i][4]),
          waktuBind:  asText(data[i][5]),
          status:     asText(data[i][6]) || 'FREE',
          waktuRelease: asText(data[i][7]),
          row:        i + 1
        };
      }
    }

    const kar = getKaryawanByNIK(no);
    if (kar && !isExternalKaryawan(kar)) {
      const todayStatus = getFactoryRecapStatus(kar.nik, formatDate(nowWIB()));
      if (todayStatus === 'DI DALAM') {
        return {
          ok: true,
          noKartuMK: no,
          nik: kar.nik,
          nama: kar.nama,
          dept: kar.dept,
          jabatan: kar.jabatan,
          waktuBind: 'ID Card internal',
          status: 'BOUND',
          waktuRelease: '',
          row: 0,
          isInternalId: true
        };
      }
    }
    return { ok: true, status: 'FREE', noKartuMK: no };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function bindKartu(noKartuMK, nik, loker) {
  return withDocumentLock(function() {
    try {
      const no  = assertCard(noKartuMK);
      const kar = getKaryawanByNIK(nik);
      if (!kar) return { ok: false, msg: 'NIK tidak ditemukan: ' + nik };

      const now = nowWIB();
      const tanggal = formatDate(now);
      const jam = formatTime(now);
      const isExternal = isExternalKaryawan(kar);
      const factoryStatus = getFactoryRecapStatus(kar.nik, tanggal);

      if (factoryStatus === 'DI DALAM') {
        return { ok: false, msg: `${kar.nama} sudah tercatat masuk dan belum keluar.` };
      }
      if (factoryStatus === 'SELESAI') {
        return { ok: false, msg: `${kar.nama} sudah menyelesaikan absen hari ini.` };
      }

      if (isExternal && no === kar.nik) {
        return { ok: false, msg: 'Karyawan external wajib scan kartu MK, bukan NIK.' };
      }
      if (!isExternal && no !== kar.nik) {
        return { ok: false, msg: 'Karyawan internal wajib memakai NIK / ID internal sendiri.' };
      }

      if (!isExternal) {
        const now = nowWIB();
        const tanggal = formatDate(now);
        const jam = formatTime(now);
        const sheetM = getSheet(SHEET_MASUK_PABRIK);
        sheetM.appendRow([no, kar.nik, kar.nama, tanggal, jam, detectShift(now), loker || '']);
        safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, jam, '', no, loker || '');
        return {
          ok: true,
          msg: `Karyawan ${kar.nama} berhasil masuk (via ID Card)`,
          karyawan: kar,
          noKartuMK: no,
          waktu: formatDateTime(now),
          shift: detectShift(now)
        };
      }

      const existing = getBindingStatus(no);
      if (!existing.ok) return existing;
      if (existing.status === 'BOUND') {
        return {
          ok: false,
          msg: `Kartu ${no} sudah terikat dengan ${existing.nama}. Lepaskan dulu sebelum mengikat ulang.`,
          htmlMsg: `❌ Kartu <strong>${no}</strong> masih terikat!<br>
                    <div style="margin-top:8px; padding:8px; background:rgba(255,255,255,0.7); border-radius:4px; color:#333; font-size:13px; text-align:left; border-left:3px solid #dc3545;">
                      <strong>${escHtml(existing.nama)}</strong> (${escHtml(existing.nik)})<br>
                      ${escHtml(existing.dept || '-')} · ${escHtml(existing.jabatan || '-')}<br>
                      <span style="font-size:11px; color:#666;">Sejak: ${escHtml(existing.waktuBind || '-')}</span>
                    </div>
                    <div style="margin-top:6px; font-size:12px; color:#dc3545;">Harap selesaikan proses KELUAR pabrik terlebih dahulu.</div>`
        };
      }

      const sheetB = getSheet(SHEET_BINDING);
      const dataB  = sheetB.getDataRange().getValues();
      for (let i = 1; i < dataB.length; i++) {
        if (asText(dataB[i][1]).trim() === asText(nik).trim() && asText(dataB[i][6]) === 'BOUND') {
          return {
            ok: false,
            msg: `NIK ${nik} (${kar.nama}) sudah terikat di kartu ${asText(dataB[i][0])}. Selesaikan dulu.`
          };
        }
      }

      const waktu = formatDateTime(now);

      sheetB.appendRow([no, kar.nik, kar.nama, kar.dept, kar.jabatan, waktu, 'BOUND']);

      const sheetM = getSheet(SHEET_MASUK_PABRIK);
      sheetM.appendRow([no, kar.nik, kar.nama, tanggal, jam, detectShift(now), loker || '']);
      safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, jam, '', no, loker || '');

      return {
        ok: true,
        msg: `Kartu ${no} berhasil diikat ke ${kar.nama}`,
        karyawan: kar,
        noKartuMK: no,
        waktu,
        shift: detectShift(now)
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

function releaseKartu(noKartuMK, loker) {
  return withDocumentLock(function() {
    try {
      const no = assertCard(noKartuMK);
      
      const kar = getKaryawanByNIK(no);
      if (kar) {
        if (isExternalKaryawan(kar)) {
          return { ok: false, msg: 'Karyawan external harus keluar memakai kartu MK yang sedang terikat.' };
        }
        const now = nowWIB();
        const waktu = formatDateTime(now);
        const tanggal = formatDate(now);
        const jam = formatTime(now);
        const factoryStatus = getFactoryRecapStatus(kar.nik, tanggal);
        if (factoryStatus !== 'DI DALAM') {
          return { ok: false, msg: `${kar.nama} belum tercatat berada di dalam pabrik hari ini.` };
        }

        const sheetK = getSheet(SHEET_KELUAR_PABRIK);
        sheetK.appendRow([no, kar.nik, kar.nama, tanggal, jam, detectShift(now), loker || '']);
        safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, '', jam, no, loker || '');

        return {
          ok: true,
          msg: `Karyawan ${kar.nama} berhasil keluar (via ID Card)`,
          karyawan: kar,
          noKartuMK: no,
          waktu
        };
      }

      const binding = getBindingStatus(no);
      if (!binding.ok) return binding;

      if (binding.status !== 'BOUND') {
        return { ok: false, msg: `Kartu / ID ${no} tidak dalam status terikat.` };
      }

      const now = nowWIB();
      const waktu = formatDateTime(now);
      const tanggal = formatDate(now);
      const factoryStatus = getFactoryRecapStatus(binding.nik, tanggal);
      if (factoryStatus === 'SELESAI') {
        return { ok: false, msg: `${binding.nama} sudah tercatat keluar hari ini.` };
      }

      const sheetB = getSheet(SHEET_BINDING);
      sheetB.getRange(binding.row, 7).setValue('FREE');
      const releaseColumn = getHeaderIndex(sheetB, 'WAKTU_RELEASE');
      if (releaseColumn > 0) sheetB.getRange(binding.row, releaseColumn).setValue(waktu);

      const sheetK = getSheet(SHEET_KELUAR_PABRIK);
      const jam = formatTime(now);
      sheetK.appendRow([no, binding.nik, binding.nama, tanggal, jam, detectShift(now), loker || '']);
      safeUpdateRecapAbsen(tanggal, binding.nik, binding.nama, binding.dept, binding.jabatan, '', jam, no, loker || '');

      return {
        ok: true,
        msg: `Kartu ${no} berhasil dilepas dari ${binding.nama}`,
        karyawan: {
          nik: binding.nik,
          nama: binding.nama,
          dept: binding.dept,
          jabatan: binding.jabatan
        },
        noKartuMK: no,
        waktu
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

// ============================================================
//  3. SCAN AREA KERJA (Security)
// ============================================================
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
          nik: binding.nik,
          nama: binding.nama,
          type: asText(master.type),
          dept: binding.dept || asText(master.dept),
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
        if (normalizeCard(dataA[i][0]) === no) {
          lastInOut = asText(dataA[i][1]);
          break;
        }
      }

      let inout = '';
      if (forceMode === 'IN') {
        inout = 'IN';
      } else if (forceMode === 'OUT') {
        inout = 'OUT';
      } else {
        inout = (lastInOut === 'OUT') ? 'IN' : 'OUT';
      }

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
        ok: true,
        inout,
        noKartuMK: no,
        karyawan: kar,
        waktu,
        msg: `${kar.nama} -> ${inout === 'IN' ? 'MASUK Area Kerja' : 'KELUAR Area Kerja'}`
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

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
