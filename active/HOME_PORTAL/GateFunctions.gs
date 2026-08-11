// ============================================================
//  NFC DAM ACCESS CONTROL — GATE PABRIK FUNCTIONS
//  PT Daya Anugrah Mulya
//  Domain: Binding kartu MK, absen masuk/keluar pabrik
//  Dependencies: SharedLib.gs
// ============================================================

// ── Factory Flow Status (dipindah dari DataRepairUtils.gs — runtime dependency) ──
/**
 * Cek status kehadiran karyawan di pabrik pada tanggal kerja tertentu.
 * Membaca langsung dari SHEET_MASUK_PABRIK & SHEET_KELUAR_PABRIK via buildFactoryRecapRowsForNik_.
 * @param {string} nik
 * @param {string} tanggal - tanggal kerja (format apapun)
 * @returns {'DI DALAM'|'SELESAI'|'KELUAR TANPA MASUK'|''}
 */
function getFactoryFlowStatusFromLogs_(nik, tanggal) {
  const targetNik = asText(nik).trim().replace(/\.0$/, '');
  const targetDate = normalizeSheetDateValue_(tanggal, getFactoryOperationalDateParsingOptions_());
  if (!targetNik || !targetDate) return '';

  const recapBuild = buildFactoryRecapRowsForNik_(targetNik);
  for (let i = 0; i < recapBuild.rows.length; i++) {
    const row = recapBuild.rows[i];
    if (asText(row[1]).trim() === targetNik && normalizeSheetDateValue_(row[0], getFactoryOperationalDateParsingOptions_()) === targetDate) {
      return asText(row[7]).trim();
    }
  }
  return '';
}

// ── Recap Absen Engine ────────────────────────────────────
function updateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker) {
  return withDocumentLock(function() {
    try {
      const sheet = getSheet(SHEET_RECAP_ABSEN);
      const lastRow = sheet.getLastRow();
      const eventType = jamMasuk ? 'masuk' : (jamKeluar ? 'keluar' : '');
      const timeValue = jamMasuk || jamKeluar || '';
      
      const workContext = resolveFactoryEventContext(tanggal, nik, timeValue, eventType);
      // Always store as ISO yyyy-MM-dd — 100% locale-proof, Sheets never auto-parses
      const recapDateISO = formatDateISO(parseAnyDate(asText(workContext.tanggal).trim() || tanggal))
                         || formatDateISO(parseAnyDate(tanggal))
                         || asText(tanggal).trim();
      const targetNik = asText(nik).trim().replace(/\.0$/, '');
      // Normalize for comparison using yyyyMMdd sort key
      const normTargetDate = formatDateForSort(recapDateISO);
      
      // Resolve header indices dynamically (no hardcoded column numbers)
      const colTanggal   = 1; // always col 1 per SHEET_HEADERS
      const colNik       = getHeaderIndex(sheet, 'NIK');  // FIX A-2: dynamic, bukan hardcoded [1]
      const colJamMasuk  = getHeaderIndex(sheet, 'JAM MASUK');
      const colJamKeluar = getHeaderIndex(sheet, 'JAM KELUAR');
      const colStatus    = getHeaderIndex(sheet, 'STATUS');
      const colNoKartu   = getHeaderIndex(sheet, 'NO KARTU MK');
      const colNoLoker   = getHeaderIndex(sheet, 'NO LOKER');

      let foundRow = -1;
      let existingJamMasuk = jamMasuk;
      let existingJamKeluar = jamKeluar;

      if (lastRow > 1) {
        // Baca sampai kolom mana pun yang paling besar antara TANGGAL dan NIK
        const readCols = Math.max(colTanggal, colNik > 0 ? colNik : 2);
        const data = sheet.getRange(2, 1, lastRow - 1, readCols).getDisplayValues();
        for (let i = data.length - 1; i >= 0; i--) {
          // FIX A-2: index kolom NIK dari header, bukan hardcoded 1
          const rowNik = asText(data[i][(colNik > 0 ? colNik : 2) - 1]).trim().replace(/\.0$/, '');
          if (rowNik === targetNik) {
            const rowDate = asText(data[i][colTanggal - 1]).trim();
            if (formatDateForSort(rowDate) === normTargetDate) {
              foundRow = i + 2;
              break;
            }
          }
        }
      }
      
      if (foundRow > 1) {
        const existingJams = [
          colJamMasuk  > 0 ? asText(sheet.getRange(foundRow, colJamMasuk).getDisplayValue()).trim()  : '',
          colJamKeluar > 0 ? asText(sheet.getRange(foundRow, colJamKeluar).getDisplayValue()).trim() : ''
        ];
        existingJamMasuk  = existingJamMasuk  || existingJams[0];
        existingJamKeluar = existingJamKeluar || existingJams[1];
        const updatedStatus = getRecapStatus(existingJamMasuk, existingJamKeluar);
        
        if (jamMasuk  && colJamMasuk  > 0) sheet.getRange(foundRow, colJamMasuk).setValue(jamMasuk);
        if (jamKeluar && colJamKeluar > 0) sheet.getRange(foundRow, colJamKeluar).setValue(jamKeluar);
        if (colStatus   > 0) sheet.getRange(foundRow, colStatus).setValue(updatedStatus);
        if (noKartuMK && colNoKartu  > 0) sheet.getRange(foundRow, colNoKartu).setValue(noKartuMK);
        if (noLoker   && colNoLoker  > 0) sheet.getRange(foundRow, colNoLoker).setValue(noLoker);
      } else {
        const status = getRecapStatus(jamMasuk, jamKeluar);
        const newRow = [
          recapDateISO,    // ISO 'yyyy-MM-dd' — Google Sheets never auto-parses this
          targetNik,
          nama || '',
          dept || '',
          jabatan || '',
          jamMasuk || '',
          jamKeluar || '',
          status,
          noKartuMK || '',
          noLoker || ''
        ];
        sheet.appendRow(newRow);
        const newRowIdx = sheet.getLastRow();
        // Set all date/time columns as plain text so Sheets never reformats
        sheet.getRange(newRowIdx, 1).setNumberFormat('@');  // TANGGAL = plain text
        if (colJamMasuk  > 0) sheet.getRange(newRowIdx, colJamMasuk).setNumberFormat('@');
        if (colJamKeluar > 0) sheet.getRange(newRowIdx, colJamKeluar).setNumberFormat('@');
      }
      
      try { CacheService.getScriptCache().removeAll(['absen:*']); } catch(e) {}
      return { ok: true, msg: 'Recap updated incrementally' };
    } catch(e) {
      Logger.log('updateRecapAbsen failed: ' + e.message);
      return { ok: false, msg: e.message };
    }
  });
}

function safeUpdateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker) {
  try {
    updateRecapAbsen(tanggal, nik, nama, dept, jabatan, jamMasuk, jamKeluar, noKartuMK, noLoker);
  } catch(e) {
    Logger.log('Gagal update recap ABSEN IN OUT MK: ' + e.message);
  }
}

function rebuildRecapAbsenInOutMKNow_() {
  return withDocumentLock(function() {
    try {
      const report = rebuildHistoricalRecapDataset_({
        repairLogs: false,
        syncBindings: true
      });
      const msg = formatHistoricalRepairSummary_(report, 'Rekap ABSEN IN OUT MK berhasil digenerate ulang.');
      showSpreadsheetAlert_(msg);
      appendRepairLog_('rebuildRecapAbsenInOutMK', { ok: true, msg: msg, report: report });
      return { ok: true, msg: msg, report: report };
    } catch(e) {
      const msg = 'Gagal generate ulang recap: ' + e.message;
      showSpreadsheetAlert_(msg);
      appendRepairLog_('rebuildRecapAbsenInOutMK', { ok: false, msg: msg });
      return { ok: false, msg: msg };
    }
  });
}

function rebuildRecapAbsenInOutMK() {
  showRepairProgressDialog_(
    'rebuild_recap',
    'Generate Ulang Recap Absen',
    'Sistem akan membangun ulang recap dari log masuk dan keluar pabrik secara bertahap, lalu menutup binding yang sudah tidak aktif.'
  );
}

// ── Binding Status ────────────────────────────────────────
function buildBindingSnapshotFromRow_(row, rowNumber) {
  const waktuBind = parseSheetDateTime(row[5]);
  const waktuRelease = parseSheetDateTime(row[7]);
  const waktuReleaseText = waktuRelease
    ? formatDateTime(waktuRelease)
    : asText(row[7]);
  const hasRelease = Boolean(asText(waktuReleaseText).trim());
  const snapshot = {
    ok: true,
    noKartuMK: normalizeCard(row[0]),
    nik: asText(row[1]),
    nama: asText(row[2]),
    dept: asText(row[3]),
    jabatan: asText(row[4]),
    waktuBind: waktuBind ? formatDateTime(waktuBind) : asText(row[5]),
    status: hasRelease ? 'FREE' : 'BOUND',
    storedStatus: asText(row[6]).trim().toUpperCase(),
    waktuRelease: waktuReleaseText,
    row: rowNumber
  };

  if (snapshot.status !== 'BOUND') {
    snapshot.nik = '';
    snapshot.nama = '';
    snapshot.dept = '';
    snapshot.jabatan = '';
  }

  return snapshot;
}

function findOpenBindingSnapshotByNik_(nik, data) {
  const targetNik = asText(nik).trim();
  if (!targetNik) return null;

  for (let i = data.length - 1; i >= 1; i--) {
    if (asText(data[i][1]).trim() !== targetNik) continue;
    const snapshot = buildBindingSnapshotFromRow_(data[i], i + 1);
    if (snapshot.status === 'BOUND') return snapshot;
  }

  return null;
}

function getBindingStatus(noKartuMK) {
  try {
    const sheet = getSheet(SHEET_BINDING);
    const data  = sheet.getDataRange().getValues();
    const no    = assertCard(noKartuMK);
    let latestReleased = null;

    for (let i = data.length - 1; i >= 1; i--) {
      if (normalizeCard(data[i][0]) === no) {
        const snapshot = buildBindingSnapshotFromRow_(data[i], i + 1);
        if (snapshot.status === 'BOUND') return snapshot;
        if (!latestReleased) latestReleased = snapshot;
      }
    }

    if (latestReleased) return latestReleased;
    return { ok: true, status: 'FREE', noKartuMK: no, nik: '', nama: '', dept: '', jabatan: '', waktuBind: '', waktuRelease: '' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ── Bind Kartu (Masuk Pabrik) ─────────────────────────────
function bindKartu(noKartuMK, nik, loker, userLat, userLng) {
  // ── VALIDASI GPS LOKASI (sebelum lock apapun) ─────────────
  // Hanya divalidasi jika dipanggil dari Gate Pabrik (yang mengirimkan userLat)
  if (userLat !== undefined && userLng !== undefined) {
    var lat = parseFloat(userLat);
    var lng = parseFloat(userLng);
    if (isNaN(lat) || isNaN(lng)) {
      return {
        ok: false,
        gpsBlocked: true,
        msg: 'Verifikasi lokasi diperlukan untuk masuk pabrik. Pastikan GPS/lokasi diaktifkan di browser Anda.'
      };
    }
    var distM = haversineDistance_(lat, lng, FACTORY_GPS_LAT, FACTORY_GPS_LNG);
    if (distM > FACTORY_GPS_RADIUS_M) {
      return {
        ok: false,
        gpsBlocked: true,
        msg: 'Anda berada ' + Math.round(distM) + ' meter dari lokasi pabrik. ' +
             'Masuk pabrik hanya dapat dilakukan dalam radius ' + FACTORY_GPS_RADIUS_M + ' meter dari gate.'
      };
    }
  }

  // ── BACA di luar lock (tidak perlu exclusive access) ──────
  try {
    var no  = assertCard(noKartuMK);
    var kar = getKaryawanByNIK(nik);
    if (!kar) return { ok: false, msg: 'NIK tidak ditemukan: ' + nik };
    if (no === kar.nik) return { ok: false, msg: 'Masuk pabrik wajib scan kartu MK fisik, bukan NIK / KTP.' };

    var now        = nowWIB();
    var tanggal    = formatDate(now);
    var jam        = formatTime(now);
    var shiftLabel = detectShift(now, 'masuk');
    var workCtx    = resolveFactoryEventContext(tanggal, kar.nik, jam, 'masuk');
    var recapTgl   = workCtx.tanggal || tanggal;

    var existing = getBindingStatus(no);
    if (!existing.ok) return existing;
    if (existing.status === 'BOUND') {
      return {
        ok: false,
        msg: `Kartu ${no} sudah terikat dengan ${existing.nama}.`,
        htmlMsg: `❌ Kartu <strong>${escHtml(no)}</strong> masih terikat!<br>
                  <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.7);border-radius:4px;color:#333;font-size:13px;text-align:left;border-left:3px solid #dc3545;">
                    <strong>${escHtml(existing.nama)}</strong> (${escHtml(existing.nik)})<br>
                    ${escHtml(existing.dept||'-')} · ${escHtml(existing.jabatan||'-')}<br>
                    <span style="font-size:11px;color:#666;">Sejak: ${escHtml(existing.waktuBind||'-')}</span>
                  </div>
                  <div style="margin-top:8px;font-size:12px;color:#dc3545;">Harap datang ke <strong>Security</strong> untuk release binding.</div>`,
        requiresSecurityRelease: true, boundCardNo: no
      };
    }
  } catch(ePre) {
    return { ok: false, msg: ePre.message };
  }

  // ── TULIS di dalam per-card lock (paralel dengan kartu lain) ─
  // withCardLock memakai global lock hanya ~200ms untuk set PropertiesService,
  // lalu melepasnya → kartu lain bisa diproses secara simultan.
  var _no = '';
  try { _no = assertCard(noKartuMK); } catch(e) { return { ok: false, msg: e.message }; }

  // scanResult menampung data yang perlu dipakai safeUpdateRecapAbsen (di luar lock)
  var scanResult = null;

  var lockResult = withCardLock(_no, function() {
    try {
      var no2  = assertCard(noKartuMK);
      var kar2 = getKaryawanByNIK(nik);
      if (!kar2) return { ok: false, msg: 'NIK tidak ditemukan: ' + nik };

      var now2        = nowWIB();
      var tanggal2    = formatDate(now2);
      var jam2        = formatTime(now2);
      var shiftLabel2 = detectShift(now2, 'masuk');
      var workCtx2    = resolveFactoryEventContext(tanggal2, kar2.nik, jam2, 'masuk');
      var recapTgl2   = workCtx2.tanggal || tanggal2;

      // Re-check dalam card lock (handle race condition tipis antara pre-check & lock)
      var ex2 = getBindingStatus(no2);
      if (!ex2.ok) return ex2;
      if (ex2.status === 'BOUND') {
        return { ok: false, msg: `Kartu ${no2} sudah terikat dengan ${ex2.nama}.`, requiresSecurityRelease: true, boundCardNo: no2 };
      }

      var factoryStatus = getFactoryFlowStatusFromLogs_(kar2.nik, recapTgl2);
      if (factoryStatus === 'DI DALAM') return { ok: false, msg: `${kar2.nama} sudah tercatat masuk dan belum keluar.` };
      if (factoryStatus === 'SELESAI')  return { ok: false, msg: `${kar2.nama} sudah menyelesaikan absen hari ini.` };

      // Cek NIK sudah terikat di kartu lain
      var sheetB = getSheet(SHEET_BINDING);
      var dataB  = sheetB.getDataRange().getValues();
      var existingNikBinding = findOpenBindingSnapshotByNik_(nik, dataB);
      if (existingNikBinding) {
        var oldKartu = existingNikBinding.noKartuMK;
        return {
          ok: false, msg: `NIK ${nik} sudah terikat di kartu ${oldKartu}.`,
          htmlMsg: `❌ NIK <strong>${escHtml(nik)}</strong> masih terikat di kartu <strong>${escHtml(oldKartu)}</strong>.<br>
                    <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.7);border-radius:4px;color:#333;font-size:13px;border-left:3px solid #dc3545;">
                      Harap ke Security untuk lepas binding kartu lama.
                    </div>`,
          requiresSecurityRelease: true, boundCardNo: oldKartu
        };
      }

      // ── TULIS: binding + log masuk (kedua appendRow aman concurrent per Google API) ──
      var tanggal2Str   = formatDateISO(now2);        // ISO 'yyyy-MM-dd' for storage
      var waktu2        = formatDateTime(now2);         // 'dd/MM/yyyy HH:mm:ss' plain text
      sheetB.appendRow([no2, kar2.nik, kar2.nama, kar2.dept, kar2.jabatan, waktu2, 'BOUND']);
      applyNumberFormatToCell_(sheetB, sheetB.getLastRow(), 6, '@');  // plain text

      var sheetMasuk = getSheet(SHEET_MASUK_PABRIK);
      sheetMasuk.appendRow([no2, kar2.nik, kar2.nama, tanggal2Str, jam2, shiftLabel2, loker || '']);
      applyNumberFormatToCell_(sheetMasuk, sheetMasuk.getLastRow(), 4, '@');  // plain text

      // Simpan data untuk recap update di luar lock
      scanResult = { tanggal: tanggal2, nik: kar2.nik, nama: kar2.nama, dept: kar2.dept,
                     jabatan: kar2.jabatan, jam: jam2, noKartu: no2, loker: loker || '' };

      return { ok: true, msg: `Kartu ${no2} berhasil diikat ke ${kar2.nama}`, karyawan: kar2, noKartuMK: no2, waktu: waktu2, shift: shiftLabel2 };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });

  // ── Update RECAP di luar lock (sheet berbeda, tidak perlu serialisasi per-kartu) ──
  if (lockResult && lockResult.ok && scanResult) {
    safeUpdateRecapAbsen(scanResult.tanggal, scanResult.nik, scanResult.nama,
                         scanResult.dept, scanResult.jabatan, scanResult.jam,
                         '', scanResult.noKartu, scanResult.loker);
  }
  return lockResult;
}

// ── Release Kartu (Keluar Pabrik) ─────────────────────────
function releaseKartu(noKartuMK, loker, userLat, userLng) {
  // FIX E-3: Pastikan kolom WAKTU_RELEASE ada sebelum proses apapun
  try {
    const sheetBPrep = getSheet(SHEET_BINDING);
    ensureOptionalHeaders(sheetBPrep, OPTIONAL_SHEET_HEADERS[SHEET_BINDING] || []);
  } catch(ePrepBinding) {
    Logger.log('releaseKartu: gagal ensure WAKTU_RELEASE column — ' + ePrepBinding.message);
  }

  // ── VALIDASI GPS LOKASI (sebelum lock apapun) ─────────────
  // Pengecualian untuk force release oleh security (tidak pakai GPS)
  if (asText(loker).trim().toUpperCase() !== 'FORCE_RELEASE') {
    // Hanya divalidasi jika dipanggil dari Gate Pabrik (yang mengirimkan userLat)
    if (userLat !== undefined && userLng !== undefined) {
      var lat = parseFloat(userLat);
      var lng = parseFloat(userLng);
      if (isNaN(lat) || isNaN(lng)) {
        return {
          ok: false,
          gpsBlocked: true,
          msg: 'Verifikasi lokasi diperlukan untuk keluar pabrik. Pastikan GPS/lokasi diaktifkan di browser Anda.'
        };
      }
      var distM = haversineDistance_(lat, lng, FACTORY_GPS_LAT, FACTORY_GPS_LNG);
      if (distM > FACTORY_GPS_RADIUS_M) {
        return {
          ok: false,
          gpsBlocked: true,
          msg: 'Anda berada ' + Math.round(distM) + ' meter dari lokasi pabrik. ' +
               'Keluar pabrik hanya dapat dilakukan dalam radius ' + FACTORY_GPS_RADIUS_M + ' meter dari gate.'
        };
      }
    }
  }

  // ── BACA di luar lock ─────────────────────────────────────
  var binding;
  try {
    var no0 = assertCard(noKartuMK);
    if (asText(loker).trim().toUpperCase() === 'FORCE_RELEASE') {
      return { ok: false, msg: 'Release paksa mandiri dinonaktifkan. Datang ke Security.' };
    }
    binding = getBindingStatus(no0);
    if (!binding.ok) return binding;
    if (binding.status !== 'BOUND') return { ok: false, msg: `Kartu / ID ${no0} tidak dalam status terikat.` };
  } catch(ePre) {
    return { ok: false, msg: ePre.message };
  }

  // ── TULIS di dalam per-card lock (paralel dengan kartu lain) ─
  var _no2 = '';
  try { _no2 = assertCard(noKartuMK); } catch(e) { return { ok: false, msg: e.message }; }

  var releaseData = null;

  var lockResult2 = withCardLock(_no2, function() {
    try {
      var no = assertCard(noKartuMK);

      // Re-check dalam card lock
      var binding2 = getBindingStatus(no);
      if (!binding2.ok) return binding2;
      if (binding2.status !== 'BOUND') return { ok: false, msg: `Kartu / ID ${no} tidak dalam status terikat.` };

      var now          = nowWIB();
      var waktuValue   = makeSheetDateTimeValue(now);
      var waktu        = formatDateTime(now);
      var tanggalValue = makeSheetDateValue(now);
      var tanggal      = formatDate(now);
      var jam          = formatTime(now);
      var workCtx      = resolveFactoryEventContext(tanggal, binding2.nik, jam, 'keluar');
      var recapTgl     = workCtx.tanggal || tanggal;
      var factoryStatus = getFactoryFlowStatusFromLogs_(binding2.nik, recapTgl);
      if (factoryStatus === 'SELESAI')   return { ok: false, msg: `${binding2.nama} sudah tercatat keluar hari ini.` };
      if (factoryStatus !== 'DI DALAM') return { ok: false, msg: `${binding2.nama} belum tercatat berada di dalam pabrik hari ini.` };

      // ── TULIS: update binding status + log keluar ──
      var sheetB = getSheet(SHEET_BINDING);
      sheetB.getRange(binding2.row, 7).setValue('FREE');
      var releaseCol = getHeaderIndex(sheetB, 'WAKTU_RELEASE');
      if (releaseCol > 0) {
        sheetB.getRange(binding2.row, releaseCol).setValue(waktu);
        applyNumberFormatToCell_(sheetB, binding2.row, releaseCol, '@');  // plain text
      }

      var sheetKeluar = getSheet(SHEET_KELUAR_PABRIK);
      var tanggalStr = formatDateISO(now);  // ISO 'yyyy-MM-dd' for storage
      sheetKeluar.appendRow([no, binding2.nik, binding2.nama, tanggalStr, jam, detectShift(now, 'keluar'), loker || '']);
      applyNumberFormatToCell_(sheetKeluar, sheetKeluar.getLastRow(), 4, '@');  // plain text

      // Simpan data untuk recap update di luar lock
      releaseData = { tanggal: tanggal, nik: binding2.nik, nama: binding2.nama,
                      dept: binding2.dept, jabatan: binding2.jabatan, jam: jam,
                      noKartu: no, loker: loker || '' };

      return {
        ok: true, msg: `Kartu ${no} berhasil dilepas dari ${binding2.nama}`,
        karyawan: { nik: binding2.nik, nama: binding2.nama, dept: binding2.dept, jabatan: binding2.jabatan },
        noKartuMK: no, waktu
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });

  // ── Update RECAP di luar lock (sheet berbeda, tidak perlu serialisasi per-kartu) ──
  if (lockResult2 && lockResult2.ok && releaseData) {
    safeUpdateRecapAbsen(releaseData.tanggal, releaseData.nik, releaseData.nama,
                         releaseData.dept, releaseData.jabatan, '',
                         releaseData.jam, releaseData.noKartu, releaseData.loker);
  }
  return lockResult2;
}

function getRecentFactoryGateLogs(limit) {
  try {
    const maxItems = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
    const events = [];

    function collectRecentRows_(sheetName, eventCode, eventLabel, timeHeader) {
      const sheet = getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;

      const lastCol = sheet.getLastColumn();
      const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      const displays = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

      for (let i = values.length - 1; i >= 0 && events.length < maxItems * 4; i--) {
        const tanggalDisplay = asText(displays[i][3]).trim() || formatDate(values[i][3]);
        const jamDisplay = asText(displays[i][4]).trim() || asText(values[i][4]).trim();
        const sortDate = formatDateForSort(values[i][3]) || formatDateForSort(tanggalDisplay);
        const sortTime = jamDisplay.replace(/[^0-9]/g, '').padEnd(6, '0').slice(0, 6);

        events.push({
          sortKey: sortDate + '|' + sortTime,
          type: eventCode,
          label: eventLabel,
          noKartuMK: normalizeCard(values[i][0]),
          nik: asText(values[i][1]),
          nama: asText(values[i][2]),
          tanggal: tanggalDisplay,
          jam: jamDisplay,
          shift: asText(values[i][5]),
          noLoker: asText(values[i][6]),
          sourceSheet: sheetName,
          timeHeader: timeHeader
        });
      }
    }

    collectRecentRows_(SHEET_MASUK_PABRIK, 'IN', 'Masuk Pabrik', 'JAM MASUK');
    collectRecentRows_(SHEET_KELUAR_PABRIK, 'OUT', 'Keluar Pabrik', 'JAM KELUAR');

    events.sort(function(a, b) {
      return b.sortKey.localeCompare(a.sortKey);
    });

    return {
      ok: true,
      data: events.slice(0, maxItems).map(function(item) {
        delete item.sortKey;
        return item;
      })
    };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
