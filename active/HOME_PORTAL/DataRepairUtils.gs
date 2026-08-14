// ============================================================
//  DATA REPAIR UTILITIES - NFC DAM ACCESS CONTROL SYSTEM
//  PT Daya Anugrah Mulya
//  Domain: Spreadsheet repair and ordered historical rebuild
//  Dependencies: SharedLib.gs, GateFunctions.gs
// ============================================================

function showSpreadsheetAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (_) {}
}

function stringifyRepairSamples_(samples) {
  return (samples || []).map(function(sample) {
    return [
      sample.sheetName || '',
      'row ' + sample.rowNumber,
      sample.nik || '-',
      sample.tanggal || '-',
      sample.jam || '-',
      (sample.beforeShift || '-') + ' -> ' + (sample.afterShift || '-')
    ].join(' | ');
  });
}

function appendRepairLog_(actionName, payload) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('LOG');
    if (!sheet) {
      sheet = ss.insertSheet('LOG');
    }

    const headers = ['WAKTU', 'ACTION', 'STATUS', 'RINGKASAN', 'DETAIL'];
    ensureHeader(sheet, headers);

    const detail = JSON.stringify(payload || {});
    sheet.appendRow([
      formatDateTime(nowWIB()),
      asText(actionName),
      asText(payload && payload.ok ? 'OK' : 'FAIL'),
      asText(payload && payload.msg),
      detail
    ]);
  } catch (e) {
    Logger.log('appendRepairLog_ failed: ' + e.message);
  }
}

function normalizeSheetDateValue_(value, parseOptions) {
  const parsed = parseSheetDate(value, parseOptions);
  if (parsed) return formatDate(parsed);
  return asText(value).trim();
}

function normalizeDisplayedTimeValue_(rawValue, displayValue) {
  const displayNormalized = normalizeTimeValue(displayValue) || asText(displayValue).trim();
  if (displayNormalized) return displayNormalized;
  return normalizeTimeValue(rawValue);
}

function resolveOperationalDateCell_(rawValue, displayValue, parseOptions) {
  const normalizedOptions = parseOptions || getFactoryOperationalDateParsingOptions_();
  const rawParsed = parseSheetDate(rawValue, normalizedOptions);
  if (rawParsed) {
    return {
      parsedDate: rawParsed,
      normalizedText: formatDate(rawParsed),
      normalizedValue: makeSheetDateValue(rawParsed, normalizedOptions),
      source: 'raw'
    };
  }

  const displayParsed = parseSheetDate(displayValue, normalizedOptions);
  if (displayParsed) {
    return {
      parsedDate: displayParsed,
      normalizedText: formatDate(displayParsed),
      normalizedValue: makeSheetDateValue(displayParsed, normalizedOptions),
      source: 'display'
    };
  }

  return {
    parsedDate: null,
    normalizedText: '',
    normalizedValue: '',
    source: ''
  };
}

function uniqueTextList_(values) {
  const seen = {};
  const result = [];
  (values || []).forEach(function(value) {
    const text = asText(value).trim();
    if (!text || seen[text]) return;
    seen[text] = true;
    result.push(text);
  });
  return result;
}

function sortFactoryRecapRows_(rows) {
  const parseOptions = getFactoryOperationalDateParsingOptions_();
  
  const mapped = (rows || []).map(function(row) {
    const parsedDate = parseSheetDate(row[0], parseOptions);
    return {
      row: row,
      time: parsedDate ? parsedDate.getTime() : 0,
      nik: asText(row[1]).trim(),
      masuk: normalizeTimeValue(row[5]),
      keluar: normalizeTimeValue(row[6])
    };
  });

  mapped.sort(function(a, b) {
    if (a.time !== b.time) return a.time - b.time;
    if (a.nik !== b.nik) return a.nik.localeCompare(b.nik);
    if (a.masuk !== b.masuk) return compareTimeValues(a.masuk, b.masuk);
    return compareTimeValues(a.keluar, b.keluar);
  });

  return mapped.map(function(item) {
    return item.row;
  });
}

function formatHistoricalRepairSummary_(report, title) {
  const heading = title || 'Pembersihan & pemulihan data sukses!';
  const renamedTabsCount = Array.isArray(report.renamedTabs) ? report.renamedTabs.length : (report.renamedTabs || 0);
  return heading + '\n' +
    '- Sheet diperbarui/di-rename: ' + renamedTabsCount + '\n' +
    '- NIK dibersihkan (.0): ' + (report.cleanedNiks || 0) + '\n' +
    '- Sel tanggal/jam dinormalkan: ' + (report.normalizedTemporalCells || 0) + '\n' +
    '- Label Shift Masuk Dikoreksi: ' + (report.fixedMasukShifts || 0) + '\n' +
    '- Label Shift Keluar Dikoreksi: ' + (report.fixedKeluarShifts || 0) + '\n' +
    '- Rekap Dipasangkan (SELESAI): ' + (report.pairedSelesai || 0) + '\n' +
    '- Rekap Masuk Aktif (DI DALAM): ' + (report.activeDiDalam || 0) + '\n' +
    '- Rekap Keluar Tanpa Masuk: ' + (report.keluarTanpaMasuk || 0) + '\n' +
    '- Binding Terbuka (FREE): ' + (report.fixedBindings || 0) + '\n' +
    '- Total Baris Rekap Baru: ' + (report.repairedRecaps || 0);
}

function ensureFactoryHeaderSheets_() {
  const issues = [];
  Object.keys(SHEET_HEADERS).forEach(function(sheetName) {
    try {
      getSheet(sheetName);
    } catch (e) {
      issues.push(sheetName + ': ' + e.message);
    }
  });
  if (issues.length) {
    throw new Error('Header sheet bermasalah. Perbaiki dulu:\n- ' + issues.join('\n- '));
  }
}

function sanitizeSheetNikColumn_(sheetName, nikColIndex) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  const range = sheet.getRange(2, nikColIndex, lastRow - 1, 1);
  const values = range.getValues();
  let changed = false;
  let cleanedCount = 0;

  for (let i = 0; i < values.length; i++) {
    const rawValue = asText(values[i][0]).trim();
    const cleanValue = rawValue.replace(/\.0$/, '');
    if (rawValue !== cleanValue) {
      values[i][0] = cleanValue;
      changed = true;
      cleanedCount++;
    }
  }

  if (changed) {
    range.setValues(values);
  }
  return cleanedCount;
}

function normalizeTemporalCellValue_(rawValue, mode, parseOptions) {
  if (mode === 'datetime') {
    return makeSheetDateTimeValue(rawValue, undefined, parseOptions);
  }
  return makeSheetDateValue(rawValue, parseOptions);
}

function temporalCellMatchesMode_(rawValue, normalizedValue, mode) {
  if (!normalizedValue || !(normalizedValue instanceof Date)) return true;
  if (!(rawValue instanceof Date)) return false;

  if (mode === 'datetime') {
    return rawValue.getTime() === normalizedValue.getTime();
  }

  return (
    rawValue.getFullYear() === normalizedValue.getFullYear() &&
    rawValue.getMonth() === normalizedValue.getMonth() &&
    rawValue.getDate() === normalizedValue.getDate() &&
    rawValue.getHours() === 0 &&
    rawValue.getMinutes() === 0 &&
    rawValue.getSeconds() === 0 &&
    rawValue.getMilliseconds() === 0
  );
}

function normalizeTemporalColumn_(sheetName, columnIndex, mode, numberFormat, parseOptions) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { normalizedCount: 0, sampleRows: [] };

  const range = sheet.getRange(2, columnIndex, lastRow - 1, 1);
  const values = range.getValues();
  let changed = false;
  let normalizedCount = 0;
  const sampleRows = [];

  for (let i = 0; i < values.length; i++) {
    const rawValue = values[i][0];
    if (rawValue === '' || rawValue === null || rawValue === undefined) continue;

    const normalizedValue = normalizeTemporalCellValue_(rawValue, mode, parseOptions);
    if (!normalizedValue) continue;
    if (temporalCellMatchesMode_(rawValue, normalizedValue, mode)) continue;

    values[i][0] = normalizedValue;
    changed = true;
    normalizedCount++;

    if (sampleRows.length < 10) {
      sampleRows.push({
        rowNumber: i + 2,
        beforeValue: asText(rawValue),
        afterValue: mode === 'datetime' ? formatDateTime(normalizedValue) : formatDate(normalizedValue)
      });
    }
  }

  if (changed) {
    range.setValues(values);
  }
  if (numberFormat) {
    range.setNumberFormat(numberFormat);
  }

  return {
    normalizedCount: normalizedCount,
    sampleRows: sampleRows
  };
}

function normalizeFactoryTemporalColumns_() {
  const operationalParseOptions = getFactoryOperationalDateParsingOptions_();
  const flexibleDateOptions = normalizeDateParseOptions_({
    preferredSlashOrder: 'DMY',
    allowMonthFirstFallback: true
  });
  const result = {
    masukDates: normalizeTemporalColumn_(SHEET_MASUK_PABRIK, 4, 'date', 'dd/MM/yyyy', operationalParseOptions),
    keluarDates: normalizeTemporalColumn_(SHEET_KELUAR_PABRIK, 4, 'date', 'dd/MM/yyyy', operationalParseOptions),
    areaDates: normalizeTemporalColumn_(SHEET_AREA_KERJA, 3, 'date', 'dd/MM/yyyy', operationalParseOptions),
    recapDates: normalizeTemporalColumn_(SHEET_RECAP_ABSEN, 1, 'date', 'dd/MM/yyyy', operationalParseOptions),
    bindingBind: normalizeTemporalColumn_(SHEET_BINDING, 6, 'datetime', 'dd/MM/yyyy HH:mm:ss', operationalParseOptions),
    bindingRelease: normalizeTemporalColumn_(SHEET_BINDING, 8, 'datetime', 'dd/MM/yyyy HH:mm:ss', operationalParseOptions),
    jadwalMulai: normalizeTemporalColumn_(SHEET_JADWAL, 5, 'date', 'dd/MM/yyyy', flexibleDateOptions),
    jadwalSelesai: normalizeTemporalColumn_(SHEET_JADWAL, 6, 'date', 'dd/MM/yyyy', flexibleDateOptions)
  };

  result.totalNormalized =
    (result.masukDates.normalizedCount || 0) +
    (result.keluarDates.normalizedCount || 0) +
    (result.areaDates.normalizedCount || 0) +
    (result.recapDates.normalizedCount || 0) +
    (result.bindingBind.normalizedCount || 0) +
    (result.bindingRelease.normalizedCount || 0) +
    (result.jadwalMulai.normalizedCount || 0) +
    (result.jadwalSelesai.normalizedCount || 0);

  return result;
}

function buildFactoryAffectedDates_(tanggal, nik, timeValue, eventType) {
  const baseDate = normalizeSheetDateValue_(tanggal, getFactoryOperationalDateParsingOptions_());
  const context = resolveFactoryEventContext(baseDate, nik, timeValue, eventType);
  return uniqueTextList_([baseDate, context && context.tanggal]);
}

function repairFactoryShiftColumn_(sheetName, eventType, shiftColIndex) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { fixedShiftCount: 0, cleanedNikCount: 0, sampleFixes: [] };
  }

  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const data = range.getValues();
  const displayData = range.getDisplayValues();
  let fixedShiftCount = 0;
  let cleanedNikCount = 0;
  let scannedRows = 0;
  let validRows = 0;
  let skippedInvalidDateRows = 0;
  let changed = false;
  const sampleFixes = [];
  const parseOptions = getFactoryOperationalDateParsingOptions_();

  for (let i = 0; i < data.length; i++) {
    scannedRows++;
    const row = data[i];
    const displayRow = displayData[i] || [];

    const rawNik = asText(row[1]).trim();
    const nik = rawNik.replace(/\.0$/, '');
    if (nik && nik !== rawNik) {
      row[1] = nik;
      cleanedNikCount++;
      changed = true;
    }

    const resolvedDate = resolveOperationalDateCell_(row[3], displayRow[3], parseOptions);
    const tanggal = resolvedDate.normalizedText;
    const jamStr = normalizeDisplayedTimeValue_(row[4], displayRow[4]);
    if (!tanggal || !jamStr) {
      if (!tanggal) skippedInvalidDateRows++;
      continue;
    }
    validRows++;

    const normalizedDateValue = resolvedDate.normalizedValue;
    if (normalizedDateValue && !temporalCellMatchesMode_(row[3], normalizedDateValue, 'date')) {
      row[3] = normalizedDateValue;
      changed = true;
    }

    const currentShift = asText(row[shiftColIndex - 1]).trim();
    const correctShift = detectShift(jamStr, eventType);
    if (correctShift && currentShift !== correctShift) {
      row[shiftColIndex - 1] = correctShift;
      fixedShiftCount++;
      changed = true;

      if (sampleFixes.length < 10) {
        sampleFixes.push({
          sheetName: sheetName,
          rowNumber: i + 2,
          nik: nik,
          tanggal: tanggal,
          jam: jamStr,
          beforeShift: currentShift,
          afterShift: correctShift
        });
      }
    }
  }

  if (changed) {
    range.setValues(data);
    sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat('dd/MM/yyyy');
    SpreadsheetApp.flush();
  }

  return {
    scannedRows: scannedRows,
    validRows: validRows,
    skippedInvalidDateRows: skippedInvalidDateRows,
    fixedShiftCount: fixedShiftCount,
    cleanedNikCount: cleanedNikCount,
    sampleFixes: sampleFixes
  };
}

function collectFactoryLogEvents_(sheetName, eventType, options) {
  const config = options || {};
  const shiftColIndex = config.shiftColIndex || 6;
  const repairSheet = config.repairSheet === true;
  const nikFilter = asText(config.nikFilter).trim();
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { events: [], fixedShiftCount: 0, cleanedNikCount: 0 };
  }

  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const data = range.getValues();
  const displayData = range.getDisplayValues();
  const events = [];
  let fixedShiftCount = 0;
  let cleanedNikCount = 0;
  let scannedRows = 0;
  let validRows = 0;
  let skippedInvalidDateRows = 0;
  let changed = false;
  const sampleFixes = [];
  const parseOptions = getFactoryOperationalDateParsingOptions_();

  const karyawanMap = config.karyawanMap || getKaryawanMapByNIK();

  for (let i = 0; i < data.length; i++) {
    scannedRows++;
    const row = data[i];
    const displayRow = displayData[i] || [];
    const rawNik = asText(row[1]).trim();
    const nik = rawNik.replace(/\.0$/, '');
    const resolvedDate = resolveOperationalDateCell_(row[3], displayRow[3], parseOptions);
    const tanggal = resolvedDate.normalizedText;
    const parsedDate = resolvedDate.parsedDate;
    const jamStr = normalizeDisplayedTimeValue_(row[4], displayRow[4]);

    if (repairSheet && nik && nik !== rawNik) {
      row[1] = nik;
      cleanedNikCount++;
      changed = true;
    }

    if (repairSheet) {
      if (resolvedDate.normalizedValue && !temporalCellMatchesMode_(row[3], resolvedDate.normalizedValue, 'date')) {
        row[3] = resolvedDate.normalizedValue;
        changed = true;
      }
      const correctShift = jamStr ? detectShift(jamStr, eventType) : '';
      const currentShift = asText(row[shiftColIndex - 1]).trim();
      if (correctShift && correctShift !== currentShift) {
        row[shiftColIndex - 1] = correctShift;
        fixedShiftCount++;
        changed = true;
        if (sampleFixes.length < 10) {
          sampleFixes.push({
            sheetName: sheetName,
            rowNumber: i + 2,
            nik: nik,
            tanggal: tanggal,
            jam: jamStr,
            beforeShift: currentShift,
            afterShift: correctShift
          });
        }
      }
    }

    if (nikFilter && nik !== nikFilter) continue;
    if (!nik || !tanggal || !parsedDate || !jamStr) {
      if (!tanggal || !parsedDate) skippedInvalidDateRows++;
      continue;
    }
    validRows++;

    const master = karyawanMap[nik] || {};
    const workContext = resolveFactoryEventContext(tanggal, nik, jamStr, eventType, config.jadwalCache);
    const recapDate = asText(workContext.tanggal).trim() || tanggal;
    const recapDateValue = workContext.tanggalValue || resolvedDate.normalizedValue || makeSheetDateValue(recapDate, parseOptions);
    events.push({
      nik: nik,
      nama: asText(row[2]) || asText(master.nama),
      dept: asText(master.dept),
      jabatan: asText(master.jabatan),
      card: normalizeCard(row[0]),
      loker: asText(row[6] || ''),
      jamStr: jamStr,
      eventDate: tanggal,
      eventDateValue: resolvedDate.normalizedValue || makeSheetDateValue(tanggal, parseOptions),
      recapDate: recapDate,
      recapDateValue: recapDateValue,
      shift: asText(workContext.shiftLabel).trim() || detectShift(jamStr, eventType),
      timeMs: parsedDate.getTime() + (timeStrToMinutes(jamStr) || 0) * 60000,
      used: false
    });
  }

  if (changed) {
    range.setValues(data);
  }

  return {
    events: events,
    scannedRows: scannedRows,
    validRows: validRows,
    skippedInvalidDateRows: skippedInvalidDateRows,
    fixedShiftCount: fixedShiftCount,
    cleanedNikCount: cleanedNikCount,
    sampleFixes: sampleFixes
  };
}

function buildFactoryRecapRowsFromEvents_(masukEvents, keluarEvents) {
  const grouped = {};
  const rows = [];
  const stats = {
    pairedSelesai: 0,
    activeDiDalam: 0,
    keluarTanpaMasuk: 0
  };

  function ensureGroup(event) {
    const key = event.nik + '|' + event.recapDate;
    if (!grouped[key]) {
      grouped[key] = {
        tanggal: event.recapDate,
        tanggalValue: event.recapDateValue || makeSheetDateValue(event.recapDate, getFactoryOperationalDateParsingOptions_()),
        nik: event.nik,
        nama: event.nama,
        dept: event.dept,
        jabatan: event.jabatan,
        firstMasuk: null,
        lastKeluar: null
      };
    }
    const group = grouped[key];
    if (!group.nama && event.nama) group.nama = event.nama;
    if (!group.dept && event.dept) group.dept = event.dept;
    if (!group.jabatan && event.jabatan) group.jabatan = event.jabatan;
    if (!group.tanggalValue && event.recapDateValue) group.tanggalValue = event.recapDateValue;
    return group;
  }

  (masukEvents || []).forEach(function(event) {
    const group = ensureGroup(event);
    if (!group.firstMasuk || event.timeMs < group.firstMasuk.timeMs) {
      group.firstMasuk = event;
    }
  });

  (keluarEvents || []).forEach(function(event) {
    const group = ensureGroup(event);
    if (!group.lastKeluar || event.timeMs > group.lastKeluar.timeMs) {
      group.lastKeluar = event;
    }
  });

  Object.keys(grouped).forEach(function(key) {
    const group = grouped[key];
    const masukEvent = group.firstMasuk;
    const keluarEvent = group.lastKeluar;
    const jamMasuk = masukEvent ? masukEvent.jamStr : '';
    const jamKeluar = keluarEvent ? keluarEvent.jamStr : '';
    const status = getRecapStatus(jamMasuk, jamKeluar);

    rows.push([
      // ISO 'yyyy-MM-dd' — Google Sheets NEVER auto-parses this in any locale
      formatDateISO(parseAnyDate(group.tanggal)) || group.tanggal,
      group.nik,
      group.nama,
      group.dept,
      group.jabatan,
      jamMasuk,
      jamKeluar,
      status,
      masukEvent ? masukEvent.card : (keluarEvent ? keluarEvent.card : ''),
      masukEvent ? masukEvent.loker : (keluarEvent ? keluarEvent.loker : '')
    ]);

    if (status === 'SELESAI') {
      stats.pairedSelesai++;
    } else if (status === 'DI DALAM') {
      stats.activeDiDalam++;
    } else if (status === 'KELUAR TANPA MASUK') {
      stats.keluarTanpaMasuk++;
    }
  });

  return {
    rows: sortFactoryRecapRows_(rows),
    stats: stats
  };
}

function rewriteFactoryRecapSheet_(rows, options) {
  const config = options || {};
  const sheetRecap = getSheet(SHEET_RECAP_ABSEN);
  const recapWidth = SHEET_HEADERS[SHEET_RECAP_ABSEN].length;
  const recapLastRow = sheetRecap.getLastRow();
  const existingRows = recapLastRow > 1
    ? sheetRecap.getRange(2, 1, recapLastRow - 1, recapWidth).getValues()
    : [];
  let finalRows;

  if (config.nikFilter) {
    const targetNik = asText(config.nikFilter).trim();
    const affectedDates = uniqueTextList_(config.affectedDates || rows.map(function(row) { return row[0]; }));
    const affectedMap = {};
    affectedDates.forEach(function(dateText) {
      affectedMap[dateText] = true;
    });

    const keptRows = existingRows.filter(function(row) {
      const rowNik = asText(row[1]).trim();
      const rowDate = normalizeSheetDateValue_(row[0], getFactoryOperationalDateParsingOptions_());
      return !(rowNik === targetNik && affectedMap[rowDate]);
    });

    const replacementRows = rows.filter(function(row) {
      return affectedMap[normalizeSheetDateValue_(row[0], getFactoryOperationalDateParsingOptions_())];
    });

    finalRows = sortFactoryRecapRows_(keptRows.concat(replacementRows));
  } else {
    finalRows = sortFactoryRecapRows_(rows);
  }

  if (recapLastRow > 1) {
    sheetRecap.getRange(2, 1, recapLastRow - 1, recapWidth).clearContent();
  }
  if (finalRows.length > 0) {
    sheetRecap.getRange(2, 1, finalRows.length, recapWidth).setValues(finalRows);
    // Plain text for date and time columns so locale cannot reformat
    sheetRecap.getRange(2, 1, finalRows.length, 1).setNumberFormat('@');  // TANGGAL
    sheetRecap.getRange(2, 6, finalRows.length, 2).setNumberFormat('@');  // JAM MASUK / JAM KELUAR
  }
  return finalRows.length;
}

function buildFactoryRecapRowsForNik_(nik) {
  const targetNik = asText(nik).trim().replace(/\.0$/, '');
  const karyawanMap = getKaryawanMapByNIK();
  const masukResult = collectFactoryLogEvents_(SHEET_MASUK_PABRIK, 'masuk', {
    nikFilter: targetNik,
    repairSheet: false,
    karyawanMap: karyawanMap
  });
  const keluarResult = collectFactoryLogEvents_(SHEET_KELUAR_PABRIK, 'keluar', {
    nikFilter: targetNik,
    repairSheet: false,
    karyawanMap: karyawanMap
  });
  return buildFactoryRecapRowsFromEvents_(masukResult.events, keluarResult.events);
}

function refreshFactoryRecapForNik_(nik, affectedDates) {
  const targetNik = asText(nik).trim().replace(/\.0$/, '');
  if (!targetNik) return { recapRows: 0, rows: [], stats: {} };

  const recapBuild = buildFactoryRecapRowsForNik_(targetNik);
  const dates = uniqueTextList_(affectedDates || recapBuild.rows.map(function(row) { return row[0]; }));
  const recapRows = rewriteFactoryRecapSheet_(recapBuild.rows, {
    nikFilter: targetNik,
    affectedDates: dates
  });

  try {
    CacheService.getScriptCache().removeAll(['absen:*']);
  } catch (_) {}

  return {
    recapRows: recapRows,
    rows: recapBuild.rows,
    affectedDates: dates,
    stats: recapBuild.stats
  };
}

// getFactoryFlowStatusFromLogs_ — DIPINDAH ke GateFunctions.gs (runtime dependency)
// Fungsi ini masih bisa dipanggil dari sini karena GAS project share satu scope.
// Jangan redefinisikan di sini untuk menghindari duplikasi definisi.


function repairFactoryMasukLog_() {
  return repairFactoryShiftColumn_(SHEET_MASUK_PABRIK, 'masuk', 6);
}

function repairFactoryKeluarLog_() {
  return repairFactoryShiftColumn_(SHEET_KELUAR_PABRIK, 'keluar', 6);
}

function repairFactoryMasukLog() {
  return withDocumentLock(function() {
    try {
      ensureFactoryHeaderSheets_();
      const result = repairFactoryMasukLog_();
      const sampleLines = stringifyRepairSamples_(result.sampleFixes);
      const msg = 'Perbaikan log masuk selesai.\n' +
        '- Baris dicek: ' + result.scannedRows + '\n' +
        '- Baris valid operasional: ' + result.validRows + '\n' +
        '- Tanggal invalid dilewati: ' + result.skippedInvalidDateRows + '\n' +
        '- NIK dibersihkan (.0): ' + result.cleanedNikCount + '\n' +
        '- Shift masuk dikoreksi: ' + result.fixedShiftCount +
        (sampleLines.length ? '\n\nContoh koreksi:\n- ' + sampleLines.slice(0, 5).join('\n- ') : '\n\nTidak ada baris yang perlu dikoreksi.');
      showSpreadsheetAlert_(msg);
      appendRepairLog_('repairFactoryMasukLog', { ok: true, msg: msg, report: result });
      return { ok: true, msg: msg, report: result };
    } catch (e) {
      const msg = 'Gagal perbaiki log masuk: ' + e.message;
      showSpreadsheetAlert_(msg);
      appendRepairLog_('repairFactoryMasukLog', { ok: false, msg: msg });
      return { ok: false, msg: msg };
    }
  });
}

function repairFactoryKeluarLog() {
  return withDocumentLock(function() {
    try {
      ensureFactoryHeaderSheets_();
      const result = repairFactoryKeluarLog_();
      const sampleLines = stringifyRepairSamples_(result.sampleFixes);
      const msg = 'Perbaikan log keluar selesai.\n' +
        '- Baris dicek: ' + result.scannedRows + '\n' +
        '- Baris valid operasional: ' + result.validRows + '\n' +
        '- Tanggal invalid dilewati: ' + result.skippedInvalidDateRows + '\n' +
        '- NIK dibersihkan (.0): ' + result.cleanedNikCount + '\n' +
        '- Shift keluar dikoreksi: ' + result.fixedShiftCount +
        (sampleLines.length ? '\n\nContoh koreksi:\n- ' + sampleLines.slice(0, 5).join('\n- ') : '\n\nTidak ada baris yang perlu dikoreksi.');
      showSpreadsheetAlert_(msg);
      appendRepairLog_('repairFactoryKeluarLog', { ok: true, msg: msg, report: result });
      return { ok: true, msg: msg, report: result };
    } catch (e) {
      const msg = 'Gagal perbaiki log keluar: ' + e.message;
      showSpreadsheetAlert_(msg);
      appendRepairLog_('repairFactoryKeluarLog', { ok: false, msg: msg });
      return { ok: false, msg: msg };
    }
  });
}

function rebuildHistoricalRecapDataset_(options) {
  const config = options || {};
  const karyawanMap = getKaryawanMapByNIK();

  // Pre-load jadwal 1x untuk seluruh proses rebuild.
  // Tanpa ini, setiap baris log akan membaca ulang sheet JADWAL_SHIFT
  // (ribuan kali, menyebabkan timeout 6 menit GAS).
  const jadwalCache = (typeof buildJadwalCache_ === 'function')
    ? buildJadwalCache_()
    : { getForDate: function() { return []; } };

  const masukResult = collectFactoryLogEvents_(SHEET_MASUK_PABRIK, 'masuk', {
    shiftColIndex: 6,
    repairSheet: config.repairLogs === true,
    karyawanMap: karyawanMap,
    jadwalCache: jadwalCache
  });
  const keluarResult = collectFactoryLogEvents_(SHEET_KELUAR_PABRIK, 'keluar', {
    shiftColIndex: 6,
    repairSheet: config.repairLogs === true,
    karyawanMap: karyawanMap,
    jadwalCache: jadwalCache
  });

  const recapBuild = buildFactoryRecapRowsFromEvents_(masukResult.events, keluarResult.events);
  const recapRows = rewriteFactoryRecapSheet_(recapBuild.rows);
  const report = {
    fixedMasukShifts: masukResult.fixedShiftCount,
    fixedKeluarShifts: keluarResult.fixedShiftCount,
    cleanedNiks: masukResult.cleanedNikCount + keluarResult.cleanedNikCount,
    repairedRecaps: recapRows,
    fixedBindings: 0,
    pairedSelesai: recapBuild.stats.pairedSelesai,
    activeDiDalam: recapBuild.stats.activeDiDalam,
    keluarTanpaMasuk: recapBuild.stats.keluarTanpaMasuk
  };

  if (config.syncBindings !== false) {
    const sheetBinding = getSheet(SHEET_BINDING);
    const dataBinding = sheetBinding.getDataRange().getValues();
    const activeDiDalamNiks = {};

    recapBuild.rows.forEach(function(row) {
      if (row[7] === 'DI DALAM') {
        activeDiDalamNiks[asText(row[1]).trim()] = true;
      }
    });

    for (let i = 1; i < dataBinding.length; i++) {
      const status = asText(dataBinding[i][6]).toUpperCase();
      const nik = asText(dataBinding[i][1]).trim();
      if (status === 'BOUND' && !activeDiDalamNiks[nik]) {
        sheetBinding.getRange(i + 1, 7).setValue('FREE');
        report.fixedBindings++;
      }
    }
  }

  try {
    CacheService.getScriptCache().removeAll(['absen:*']);
  } catch (_) {}

  return report;
}

const REPAIR_PROGRESS_JOB_PROPERTY_KEY = 'DAM_REPAIR_PROGRESS_JOB';

function createHistoricalRepairReport_() {
  return {
    renamedTabs: [],
    cleanedNiks: 0,
    normalizedTemporalCells: 0,
    fixedMasukShifts: 0,
    fixedKeluarShifts: 0,
    repairedRecaps: 0,
    fixedBindings: 0,
    pairedSelesai: 0,
    activeDiDalam: 0,
    keluarTanpaMasuk: 0,
    msg: ''
  };
}

function getRepairProgressStore_() {
  return PropertiesService.getDocumentProperties();
}

function getRepairJobTitle_(jobType) {
  return jobType === 'rebuild_recap'
    ? 'Generate Ulang Recap Absen'
    : 'Perbaikan Data Spreadsheet';
}

function getRepairJobSuccessTitle_(jobType) {
  return jobType === 'rebuild_recap'
    ? 'Generate ulang recap absen selesai!'
    : 'Pembersihan & pemulihan data sukses!';
}

function getRepairJobSteps_(jobType) {
  if (jobType === 'rebuild_recap') {
    return [
      { id: 'prepare_factory_sheets', label: 'Menyiapkan nama sheet dan header' },
      { id: 'rebuild_recap', label: 'Membangun ulang recap dari log pabrik' }
    ];
  }

  return [
    { id: 'prepare_factory_sheets', label: 'Menyiapkan nama sheet dan header' },
    { id: 'clean_nik_columns', label: 'Membersihkan format NIK di sheet utama' },
    { id: 'normalize_temporal_columns', label: 'Menormalkan tanggal dan jam' },
    { id: 'repair_masuk_log', label: 'Memperbaiki shift log masuk pabrik' },
    { id: 'repair_keluar_log', label: 'Memperbaiki shift log keluar pabrik' },
    { id: 'rebuild_recap', label: 'Membangun ulang recap absen dari log' }
  ];
}

function buildRepairProgressJobState_(jobType) {
  const now = nowWIB();
  const steps = getRepairJobSteps_(jobType);
  return {
    jobId: Utilities.getUuid(),
    type: jobType,
    title: getRepairJobTitle_(jobType),
    status: 'running',
    totalSteps: steps.length,
    completedSteps: 0,
    currentStepId: steps.length ? steps[0].id : '',
    currentStepLabel: steps.length ? steps[0].label : '',
    currentStepNumber: steps.length ? 1 : 0,
    message: 'Proses disiapkan dan siap dijalankan bertahap.',
    startedAt: formatDateTime(now),
    startedAtMs: now.getTime(),
    updatedAt: formatDateTime(now),
    updatedAtMs: now.getTime(),
    finishedAt: '',
    finishedAtMs: 0,
    logs: ['[' + formatTime(now) + '] Proses dibuat.'],
    report: createHistoricalRepairReport_(),
    stepStates: steps.map(function(step, index) {
      return {
        id: step.id,
        label: step.label,
        order: index + 1,
        status: index === 0 ? 'ready' : 'pending',
        detail: ''
      };
    })
  };
}

function touchRepairProgressJobState_(job) {
  const now = nowWIB();
  job.updatedAt = formatDateTime(now);
  job.updatedAtMs = now.getTime();
}

function decorateRepairProgressJobState_(job) {
  if (!job) return null;
  const totalSteps = Math.max(1, parseInt(job.totalSteps, 10) || 1);
  const completedSteps = Math.max(0, parseInt(job.completedSteps, 10) || 0);
  job.totalSteps = totalSteps;
  job.completedSteps = completedSteps;
  job.progressPct = Math.max(0, Math.min(100, Math.round((completedSteps / totalSteps) * 100)));
  job.isFinished = job.status === 'done' || job.status === 'error';
  job.lastKnownStep = job.currentStepLabel || '';
  return job;
}

function saveRepairProgressJobState_(job) {
  touchRepairProgressJobState_(job);
  getRepairProgressStore_().setProperty(
    REPAIR_PROGRESS_JOB_PROPERTY_KEY,
    JSON.stringify(job)
  );
  return decorateRepairProgressJobState_(job);
}

function loadRepairProgressJobState_() {
  try {
    const raw = getRepairProgressStore_().getProperty(REPAIR_PROGRESS_JOB_PROPERTY_KEY);
    if (!raw) return null;
    return decorateRepairProgressJobState_(JSON.parse(raw));
  } catch (e) {
    Logger.log('loadRepairProgressJobState_ failed: ' + e.message);
    return null;
  }
}

function appendRepairProgressLog_(job, message) {
  const stamp = formatTime(nowWIB()) || '';
  const line = '[' + stamp + '] ' + asText(message);
  job.logs = Array.isArray(job.logs) ? job.logs : [];
  job.logs.push(line);
  if (job.logs.length > 25) {
    job.logs = job.logs.slice(job.logs.length - 25);
  }
}

function updateRepairProgressStepState_(job, stepIndex, status, detail) {
  if (!job || !Array.isArray(job.stepStates) || stepIndex < 0 || stepIndex >= job.stepStates.length) return;
  job.stepStates[stepIndex].status = status;
  if (detail !== undefined) {
    job.stepStates[stepIndex].detail = asText(detail);
  }
  const step = job.stepStates[stepIndex];
  job.currentStepId = step.id;
  job.currentStepLabel = step.label;
  job.currentStepNumber = step.order;
}

function summarizeStepResultDetail_(stepId, result, report) {
  if (stepId === 'prepare_factory_sheets') {
    const renamedCount = Array.isArray(report.renamedTabs) ? report.renamedTabs.length : 0;
    return renamedCount
      ? 'Nama sheet/header siap. Sheet rename: ' + renamedCount + '.'
      : 'Nama sheet dan header sudah siap.';
  }
  if (stepId === 'clean_nik_columns') {
    return 'NIK dibersihkan: ' + (result.cleanedNiks || 0) + ' sel.';
  }
  if (stepId === 'normalize_temporal_columns') {
    return 'Tanggal/jam dinormalkan: ' + (result.normalizedTemporalCells || 0) + ' sel.';
  }
  if (stepId === 'repair_masuk_log') {
    return 'Log masuk valid: ' + (result.validRows || 0) + '/' + (result.scannedRows || 0) +
      ' baris, shift dikoreksi: ' + (result.fixedShiftCount || 0) +
      ', tanggal invalid dilewati: ' + (result.skippedInvalidDateRows || 0) + '.';
  }
  if (stepId === 'repair_keluar_log') {
    return 'Log keluar valid: ' + (result.validRows || 0) + '/' + (result.scannedRows || 0) +
      ' baris, shift dikoreksi: ' + (result.fixedShiftCount || 0) +
      ', tanggal invalid dilewati: ' + (result.skippedInvalidDateRows || 0) + '.';
  }
  if (stepId === 'rebuild_recap') {
    return 'Rekap dibangun ulang: ' + (report.repairedRecaps || 0) + ' baris.';
  }
  return asText(result && result.detail);
}

function executeRepairProgressStep_(job, step) {
  const report = job.report || createHistoricalRepairReport_();

  if (step.id === 'prepare_factory_sheets') {
    const ss = getSpreadsheet();
    const sheetAreaTruncated = ss.getSheetByName('REGISTRASI MASUK KELUAR AREA KE');
    if (sheetAreaTruncated && !ss.getSheetByName(SHEET_AREA_KERJA)) {
      sheetAreaTruncated.setName(SHEET_AREA_KERJA);
      report.renamedTabs.push('REGISTRASI MASUK KELUAR AREA KE -> ' + SHEET_AREA_KERJA);
    }
    ensureFactoryHeaderSheets_();
    job.report = report;
    return { detail: summarizeStepResultDetail_(step.id, {}, report) };
  }

  if (step.id === 'clean_nik_columns') {
    let cleanedNiks = 0;
    cleanedNiks += sanitizeSheetNikColumn_(SHEET_KARYAWAN, 1);
    cleanedNiks += sanitizeSheetNikColumn_(SHEET_BINDING, 2);
    cleanedNiks += sanitizeSheetNikColumn_(SHEET_AREA_KERJA, 5);
    cleanedNiks += sanitizeSheetNikColumn_(SHEET_RECAP_ABSEN, 2);
    cleanedNiks += sanitizeSheetNikColumn_(SHEET_JADWAL, 1);
    report.cleanedNiks += cleanedNiks;
    job.report = report;
    return {
      cleanedNiks: cleanedNiks,
      detail: summarizeStepResultDetail_(step.id, { cleanedNiks: cleanedNiks }, report)
    };
  }

  if (step.id === 'normalize_temporal_columns') {
    const temporalNormalization = normalizeFactoryTemporalColumns_();
    report.normalizedTemporalCells += temporalNormalization.totalNormalized || 0;
    job.report = report;
    return {
      normalizedTemporalCells: temporalNormalization.totalNormalized || 0,
      detail: summarizeStepResultDetail_(step.id, temporalNormalization, report)
    };
  }

  if (step.id === 'repair_masuk_log') {
    const masukRepair = repairFactoryMasukLog_();
    report.cleanedNiks += masukRepair.cleanedNikCount || 0;
    report.fixedMasukShifts = masukRepair.fixedShiftCount || 0;
    job.report = report;
    return {
      fixedShiftCount: masukRepair.fixedShiftCount || 0,
      detail: summarizeStepResultDetail_(step.id, masukRepair, report)
    };
  }

  if (step.id === 'repair_keluar_log') {
    const keluarRepair = repairFactoryKeluarLog_();
    report.cleanedNiks += keluarRepair.cleanedNikCount || 0;
    report.fixedKeluarShifts = keluarRepair.fixedShiftCount || 0;
    job.report = report;
    return {
      fixedShiftCount: keluarRepair.fixedShiftCount || 0,
      detail: summarizeStepResultDetail_(step.id, keluarRepair, report)
    };
  }

  if (step.id === 'rebuild_recap') {
    // repairLogs=true agar shift dikoreksi ulang sebelum membangun recap
    // Ini memastikan data yang masuk ke recap sudah bersih meski step repair_*_log
    // sudah dijalankan sebelumnya (idempotent, aman dijalankan 2x).
    const alreadyRepaired = (job.report && (job.report.fixedMasukShifts !== undefined || job.report.fixedKeluarShifts !== undefined));
    const rebuildReport = rebuildHistoricalRecapDataset_({
      repairLogs: !alreadyRepaired, // hanya repair ulang jika step repair belum dijalankan (rebuild_recap standalone)
      syncBindings: true
    });
    report.repairedRecaps = rebuildReport.repairedRecaps || 0;
    report.fixedBindings = rebuildReport.fixedBindings || 0;
    report.pairedSelesai = rebuildReport.pairedSelesai || 0;
    report.activeDiDalam = rebuildReport.activeDiDalam || 0;
    report.keluarTanpaMasuk = rebuildReport.keluarTanpaMasuk || 0;
    job.report = report;
    return {
      repairedRecaps: report.repairedRecaps,
      detail: summarizeStepResultDetail_(step.id, rebuildReport, report)
    };
  }

  return { detail: 'Langkah selesai.' };
}

function startRepairProgressJob(jobType) {
  const normalizedType = asText(jobType).trim().toLowerCase();
  if (normalizedType !== 'fix_all' && normalizedType !== 'rebuild_recap') {
    return { ok: false, msg: 'Jenis proses tidak dikenali.' };
  }

  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 menit tanpa update = dianggap crash
  const existing = loadRepairProgressJobState_();
  if (existing && existing.status === 'running') {
    const updatedAtMs = parseInt(existing.updatedAtMs, 10) || 0;
    const ageMs = nowWIB().getTime() - updatedAtMs;
    const isStale = updatedAtMs === 0 || ageMs > STALE_THRESHOLD_MS;

    if (!isStale && existing.type === normalizedType) {
      return { ok: true, reused: true, job: existing };
    }
    if (!isStale && existing.type !== normalizedType) {
      return {
        ok: false,
        msg: 'Masih ada proses lain yang berjalan: ' + existing.title + '. Tunggu selesai dulu.'
      };
    }
    // Job lama sudah tidak aktif (stale/crash), buat yang baru
    Logger.log('startRepairProgressJob: job lama stale (' + Math.round(ageMs / 60000) + ' menit), dibuat ulang.');
  }

  const job = buildRepairProgressJobState_(normalizedType);
  appendRepairProgressLog_(job, 'Proses siap dijalankan.');
  saveRepairProgressJobState_(job);
  return { ok: true, reused: false, job: job };
}

function getRepairProgressState(jobId) {
  const job = loadRepairProgressJobState_();
  if (!job) return { ok: false, msg: 'Belum ada proses yang tersimpan.' };
  if (jobId && job.jobId !== jobId) {
    return { ok: false, msg: 'ID proses tidak cocok dengan status terakhir.' };
  }
  return { ok: job.status !== 'error', job: job, msg: job.message || '' };
}

function runRepairProgressStep(jobId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    const current = loadRepairProgressJobState_();
    return { ok: true, busy: true, job: current };
  }

  try {
    const job = loadRepairProgressJobState_();
    if (!job) return { ok: false, msg: 'Status proses tidak ditemukan.' };
    if (jobId && job.jobId !== jobId) {
      return { ok: false, msg: 'ID proses tidak cocok dengan status terakhir.', job: job };
    }
    if (job.status === 'done') {
      return { ok: true, job: job, msg: job.message || '' };
    }
    if (job.status === 'error') {
      return { ok: false, msg: job.message || 'Proses berhenti karena error.', job: job };
    }

    const steps = getRepairJobSteps_(job.type);
    const stepIndex = Math.max(0, parseInt(job.completedSteps, 10) || 0);
    if (stepIndex >= steps.length) {
      job.status = 'done';
      job.message = formatHistoricalRepairSummary_(job.report, getRepairJobSuccessTitle_(job.type));
      job.finishedAt = formatDateTime(nowWIB());
      job.finishedAtMs = nowWIB().getTime();
      saveRepairProgressJobState_(job);
      return { ok: true, job: job, msg: job.message };
    }

    const step = steps[stepIndex];
    updateRepairProgressStepState_(job, stepIndex, 'running', 'Sedang diproses...');
    appendRepairProgressLog_(job, 'Mulai: ' + step.label);
    saveRepairProgressJobState_(job);

    const stepResult = executeRepairProgressStep_(job, step);
    job.completedSteps = stepIndex + 1;
    updateRepairProgressStepState_(job, stepIndex, 'done', stepResult.detail || 'Selesai');
    appendRepairProgressLog_(job, step.label + ' selesai. ' + (stepResult.detail || ''));

    if (job.completedSteps >= steps.length) {
      job.status = 'done';
      job.message = formatHistoricalRepairSummary_(job.report, getRepairJobSuccessTitle_(job.type));
      job.finishedAt = formatDateTime(nowWIB());
      job.finishedAtMs = nowWIB().getTime();
      appendRepairProgressLog_(job, 'Proses selesai.');
      appendRepairLog_(
        job.type === 'rebuild_recap' ? 'rebuildRecapAbsenInOutMK' : 'fixAllSpreadsheetErrors',
        { ok: true, msg: job.message, report: job.report }
      );
    } else {
      const nextStep = steps[job.completedSteps];
      updateRepairProgressStepState_(job, job.completedSteps, 'ready', job.stepStates[job.completedSteps].detail);
      job.currentStepId = nextStep.id;
      job.currentStepLabel = nextStep.label;
      job.currentStepNumber = job.completedSteps + 1;
      job.message = 'Langkah terakhir selesai. Lanjut ke: ' + nextStep.label;
    }

    saveRepairProgressJobState_(job);
    return { ok: true, job: job, msg: stepResult.detail || '' };
  } catch (e) {
    const failedJob = loadRepairProgressJobState_() || buildRepairProgressJobState_('fix_all');
    failedJob.status = 'error';
    failedJob.message = 'Gagal memproses: ' + e.message;
    failedJob.finishedAt = formatDateTime(nowWIB());
    failedJob.finishedAtMs = nowWIB().getTime();
    appendRepairProgressLog_(failedJob, failedJob.message);
    saveRepairProgressJobState_(failedJob);
    appendRepairLog_(
      failedJob.type === 'rebuild_recap' ? 'rebuildRecapAbsenInOutMK' : 'fixAllSpreadsheetErrors',
      { ok: false, msg: failedJob.message, report: failedJob.report }
    );
    return { ok: false, msg: failedJob.message, job: failedJob };
  } finally {
    lock.releaseLock();
  }
}

function fixAllSpreadsheetErrorsNow_() {
  return withDocumentLock(function() {
    try {
      const job = buildRepairProgressJobState_('fix_all');
      const steps = getRepairJobSteps_('fix_all');
      for (let i = 0; i < steps.length; i++) {
        executeRepairProgressStep_(job, steps[i]);
        job.completedSteps = i + 1;
      }
      job.message = formatHistoricalRepairSummary_(job.report, getRepairJobSuccessTitle_('fix_all'));
      job.report.msg = job.message;
      showSpreadsheetAlert_(job.message);
      appendRepairLog_('fixAllSpreadsheetErrors', { ok: true, msg: job.message, report: job.report });
      return { ok: true, report: job.report, msg: job.message };
    } catch (e) {
      const msg = 'Gagal perbaiki data: ' + e.message;
      showSpreadsheetAlert_(msg);
      appendRepairLog_('fixAllSpreadsheetErrors', { ok: false, msg: msg });
      return { ok: false, msg: msg };
    }
  });
}

function fixAllSpreadsheetErrors() {
  showRepairProgressDialog_(
    'fix_all',
    'Perbaikan Data Spreadsheet',
    'Sistem akan membersihkan NIK, menormalkan tanggal dan jam, memperbaiki shift, lalu membangun ulang recap secara bertahap.'
  );
}

// ============================================================
//  AUTO-REPAIR TERJADWAL (nightly trigger)
// ============================================================
// Dijadwalkan malam hari (bukan jam kerja) supaya withDocumentLock di
// fixAllSpreadsheetErrorsNow_ tidak bentrok dengan lock antrian gate scan
// yang sedang aktif dipakai saat jam operasional pabrik.
const NIGHTLY_REPAIR_TRIGGER_HANDLER = 'runNightlyDataRepairJob_';
const NIGHTLY_REPAIR_HOUR = 2; // 02:00 Asia/Jakarta (lihat appsscript.json timeZone)

function runNightlyDataRepairJob_() {
  const result = fixAllSpreadsheetErrorsNow_();
  appendRepairLog_('nightlyDataRepairJob', {
    ok: result && result.ok,
    msg: result && result.msg,
    trigger: 'time-driven'
  });
  return result;
}

function setupNightlyDataRepairTrigger() {
  try {
    removeNightlyDataRepairTrigger_();
    ScriptApp.newTrigger(NIGHTLY_REPAIR_TRIGGER_HANDLER)
      .timeBased()
      .atHour(NIGHTLY_REPAIR_HOUR)
      .everyDays(1)
      .create();
    showSpreadsheetAlert_(
      'Auto-repair malam hari aktif. Sistem akan otomatis menjalankan "Fix & Clean All Spreadsheet Errors" setiap hari sekitar jam ' +
      NIGHTLY_REPAIR_HOUR + ':00 WIB.'
    );
    appendRepairLog_('setupNightlyDataRepairTrigger', { ok: true, hour: NIGHTLY_REPAIR_HOUR });
  } catch (e) {
    const msg = 'Gagal mengaktifkan auto-repair malam hari: ' + e.message;
    showSpreadsheetAlert_(msg);
    appendRepairLog_('setupNightlyDataRepairTrigger', { ok: false, msg: msg });
  }
}

function removeNightlyDataRepairTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === NIGHTLY_REPAIR_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return removed;
}

function disableNightlyDataRepairTrigger() {
  const removed = removeNightlyDataRepairTrigger_();
  showSpreadsheetAlert_(
    removed > 0
      ? 'Auto-repair malam hari dinonaktifkan.'
      : 'Auto-repair malam hari memang belum aktif — tidak ada yang perlu dinonaktifkan.'
  );
  appendRepairLog_('disableNightlyDataRepairTrigger', { ok: true, removed: removed });
}
