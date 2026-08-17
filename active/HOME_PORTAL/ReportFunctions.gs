// ============================================================
//  NFC DAM ACCESS CONTROL — REPORT FUNCTIONS
//  PT Daya Anugrah Mulya
//  Domain: Laporan absen pabrik, laporan aktivitas area kerja
//  Dependencies: SharedLib.gs
// ============================================================

// ── Date Key Helpers ──────────────────────────────────────
function toDateKey(value) {
  const parsed = parseSheetDate(value, getFactoryOperationalDateParsingOptions_());
  if (parsed) {
    return Utilities.formatDate(parsed, 'Asia/Jakarta', 'yyyyMMdd');
  }
  return formatDateForSort(value);
}

const DEFAULT_REPORT_PAGE_SIZE = 25;
const MAX_REPORT_PAGE_SIZE = 100;

function formatSheetDateValue(value) {
  const parsed = parseSheetDate(value, getFactoryOperationalDateParsingOptions_());
  return parsed ? formatDate(parsed) : asText(value);
}

function formatSheetTimeValue(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return formatTime(value);
  }
  const normalized = normalizeTimeValue(value);
  if (normalized) return normalized;
  const parsed = parseSheetDateTime(value);
  return parsed ? formatTime(parsed) : asText(value);
}

function formatDisplayedDateValue(rawValue, displayedValue) {
  const text = asText(displayedValue).trim();
  if (text) {
    const parsed = parseSheetDate(text, getFactoryOperationalDateParsingOptions_());
    if (parsed) return formatDateUI(parsed);
  }
  const sheetValue = formatSheetDateValue(rawValue);
  const parsedSheet = parseSheetDate(sheetValue, getFactoryOperationalDateParsingOptions_());
  return parsedSheet ? formatDateUI(parsedSheet) : sheetValue;
}

function formatDisplayedTimeValue(rawValue, displayedValue) {
  const text = asText(displayedValue).trim();
  if (text) {
    const normalized = normalizeTimeValue(text);
    if (normalized) return normalized;
    const parsed = parseSheetDateTime(text);
    if (parsed) return formatTime(parsed);
  }
  return formatSheetTimeValue(rawValue);
}

function buildTimeSortKey(rawValue, displayedValue) {
  const text = formatDisplayedTimeValue(rawValue, displayedValue);
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    return [
      match[1].padStart(2, '0'),
      match[2],
      (match[3] || '00')
    ].join(':');
  }
  return text;
}

function buildPaginationMeta_(totalRows, page, pageSize) {
  const rawPageSize = asText(pageSize).trim().toUpperCase();
  const safePageSize = rawPageSize === 'ALL'
    ? Math.max(1, totalRows || 1)
    : Math.max(10, Math.min(parseInt(pageSize, 10) || DEFAULT_REPORT_PAGE_SIZE, MAX_REPORT_PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize) || 1);
  const currentPage = Math.min(totalPages, Math.max(1, parseInt(page, 10) || 1));
  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(totalRows, startIndex + safePageSize);
  return {
    currentPage: currentPage,
    pageSize: safePageSize,
    totalPages: totalPages,
    startIndex: startIndex,
    endIndex: endIndex,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages
  };
}

// ── Absen Report (Rekap masuk/keluar pabrik) ──────────────
function getAbsenReport(nik, deptFilter, periodType, periodValue, page, pageSize, search, sort, typeFilter) {
  try {
    const targetNik = asText(nik).trim();
    const filterDpt = asText(deptFilter).trim();
    // Boleh kosong jika admin/security (tampil semua data periode)
    const reportPage = parseInt(page, 10) || 1;
    const reportPageSize = parseInt(pageSize, 10) || DEFAULT_REPORT_PAGE_SIZE;
    const fullReport = getAbsenReportFullData_(targetNik, filterDpt, periodType, periodValue, typeFilter);
    if (!fullReport.ok) return fullReport;

    let rows = fullReport.rows;
    
    // 1. Filter Search (Nama / NIK / Dept)
    if (search && search.trim() !== '') {
      const qs = search.toLowerCase().trim();
      rows = rows.filter(function(r) {
        return (r.nama && r.nama.toLowerCase().indexOf(qs) > -1) ||
               (r.nik && r.nik.toLowerCase().indexOf(qs) > -1) ||
               (r.dept && r.dept.toLowerCase().indexOf(qs) > -1);
      });
    }
    
    // 2. Sort Logic
    if (sort) {
      rows.sort(function(a, b) {
        let valA = '', valB = '';
        if (sort.indexOf('tanggal') === 0) {
          const partsA = (a.tanggal||'').split('/');
          const partsB = (b.tanggal||'').split('/');
          valA = partsA.length === 3 ? partsA[2]+partsA[1]+partsA[0] : a.tanggal;
          valB = partsB.length === 3 ? partsB[2]+partsB[1]+partsB[0] : b.tanggal;
        } else if (sort.indexOf('nama') === 0) {
          valA = (a.nama||'').toLowerCase();
          valB = (b.nama||'').toLowerCase();
        } else if (sort.indexOf('jam_masuk') === 0) {
          valA = (a.jamMasuk||'99:99').replace(':','');
          valB = (b.jamMasuk||'99:99').replace(':','');
        }
        
        if (valA < valB) return sort.indexOf('desc') > -1 ? 1 : -1;
        if (valA > valB) return sort.indexOf('desc') > -1 ? -1 : 1;
        return 0;
      });
    }

    const filteredTotal = rows.length;
    let filteredComplete = 0;
    let filteredActive = 0;
    
    if (search && search.trim() !== '') {
      rows.forEach(function(r) {
         if (r.status === 'SELESAI') filteredComplete++;
         if (r.status === 'DI DALAM') filteredActive++;
      });
    } else {
      filteredComplete = fullReport.complete;
      filteredActive = fullReport.active;
    }

    const meta = buildPaginationMeta_(filteredTotal, reportPage, reportPageSize);
    const visibleRows = rows.slice(meta.startIndex, meta.endIndex);
    const result = {
      ok: true,
      period: fullReport.period,
      total: filteredTotal,
      complete: filteredComplete,
      active: filteredActive,
      data: visibleRows,
      visibleCount: visibleRows.length,
      hasMore: meta.hasNext,
      page: meta.currentPage,
      pageSize: meta.pageSize,
      totalPages: meta.totalPages,
      hasPrev: meta.hasPrev,
      hasNext: meta.hasNext,
      startRow: filteredTotal === 0 ? 0 : meta.startIndex + 1,
      endRow: meta.endIndex
    };
    return result;
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function exportAbsenReportCsv(nik, deptFilter, periodType, periodValue, typeFilter) {
  try {
    const report = getAbsenReportFullData_(nik, deptFilter, periodType, periodValue, typeFilter);
    if (!report.ok) return report;

    const rows = [
      ['PERIODE', report.period],
      ['TOTAL', report.total],
      [],
      ['TANGGAL', 'NIK', 'NAMA', 'DEPARTEMEN', 'JABATAN', 'JAM MASUK', 'JAM KELUAR', 'STATUS', 'NO KARTU MK', 'NO LOKER']
    ];

    report.rows.forEach(function(row) {
      rows.push([
        row.tanggal || '',
        row.nik || '',
        row.nama || '',
        row.dept || '',
        row.jabatan || '',
        row.jamMasuk || '',
        row.jamKeluar || '',
        row.status || '',
        row.noKartuMK || '',
        row.noLoker || ''
      ]);
    });

    const csv = rows.map(function(row) {
      return row.map(csvCellServer_).join(',');
    }).join('\r\n');

    return {
      ok: true,
      period: report.period,
      total: report.total,
      filename: buildAbsenExportFilename_(nik, periodValue),
      csv: '\ufeff' + csv
    };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ── Area Activity Report (Log scan area kerja) ────────────
function getAreaActivityReport(nik, deptFilter, periodType, periodValue, page, pageSize, recapPage, recapPageSize, search, sort) {
  try {
    const targetNik = asText(nik).trim();
    const filterDpt = asText(deptFilter).trim();
    // Boleh kosong jika admin/security (tampil semua data periode)
    const reportPage = parseInt(page, 10) || 1;
    const reportPageSize = parseInt(pageSize, 10) || DEFAULT_REPORT_PAGE_SIZE;
    const summaryPage = parseInt(recapPage, 10) || 1;
    const summaryPageSize = parseInt(recapPageSize, 10) || reportPageSize;
    const fullReport = getAreaActivityReportFullData_(targetNik, filterDpt, periodType, periodValue);
    if (!fullReport.ok) return fullReport;

    let rows = fullReport.rows;
    let recap = fullReport.recap;

    // 1. Filter Search (Nama / NIK / Dept)
    if (search && search.trim() !== '') {
      const qs = search.toLowerCase().trim();
      rows = rows.filter(function(r) {
        return (r.nama && r.nama.toLowerCase().indexOf(qs) > -1) ||
               (r.nik && r.nik.toLowerCase().indexOf(qs) > -1) ||
               (r.dept && r.dept.toLowerCase().indexOf(qs) > -1);
      });
      recap = recap.filter(function(r) {
        return (r.nama && r.nama.toLowerCase().indexOf(qs) > -1) ||
               (r.nik && r.nik.toLowerCase().indexOf(qs) > -1) ||
               (r.dept && r.dept.toLowerCase().indexOf(qs) > -1);
      });
    }

    // 2. Sort Logic
    if (sort) {
      rows.sort(function(a, b) {
        let valA = '', valB = '';
        if (sort.indexOf('tanggal') === 0) {
          // Both format (d - MMM - yyyy or dd/MM/yyyy)
          valA = (a.sortKey || a.tanggal || '');
          valB = (b.sortKey || b.tanggal || '');
        } else if (sort.indexOf('nama') === 0) {
          valA = (a.nama||'').toLowerCase();
          valB = (b.nama||'').toLowerCase();
        }
        if (valA < valB) return sort.indexOf('desc') > -1 ? 1 : -1;
        if (valA > valB) return sort.indexOf('desc') > -1 ? -1 : 1;
        return 0;
      });
    }

    const rowMeta = buildPaginationMeta_(rows.length, reportPage, reportPageSize);
    const visibleRows = rows.slice(rowMeta.startIndex, rowMeta.endIndex);
    const recapMeta = buildPaginationMeta_(recap.length, summaryPage, summaryPageSize);
    const visibleRekap = recap.slice(recapMeta.startIndex, recapMeta.endIndex);
    const result = {
      ok: true,
      period: fullReport.period,
      total: fullReport.total,
      inCount: fullReport.inCount,
      outCount: fullReport.outCount,
      data: visibleRows,
      recapData: visibleRekap,
      recapTotal: recap.length,
      recapPage: recapMeta.currentPage,
      recapPageSize: recapMeta.pageSize,
      recapTotalPages: recapMeta.totalPages,
      recapHasPrev: recapMeta.hasPrev,
      recapHasNext: recapMeta.hasNext,
      recapStartRow: recap.length === 0 ? 0 : recapMeta.startIndex + 1,
      recapEndRow: recapMeta.endIndex,
      visibleCount: visibleRows.length,
      hasMore: rowMeta.hasNext,
      page: rowMeta.currentPage,
      pageSize: rowMeta.pageSize,
      totalPages: rowMeta.totalPages,
      hasPrev: rowMeta.hasPrev,
      hasNext: rowMeta.hasNext,
      startRow: fullReport.total === 0 ? 0 : rowMeta.startIndex + 1,
      endRow: rowMeta.endIndex
    };
    return result;
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function getAbsenReportFullData_(nik, deptFilter, periodType, periodValue, typeFilter) {
  const targetNik = asText(nik).trim();
  const filterDpt = asText(deptFilter).trim();
  const filterType = asText(typeFilter).trim().toLowerCase();  // '' | 'internal' | 'outsource'
  const range    = getPeriodRange(periodType, periodValue);
  const sheet   = getSheet(SHEET_RECAP_ABSEN);
  const lastRow = sheet.getLastRow();
  const width   = SHEET_HEADERS[SHEET_RECAP_ABSEN].length;
  if (lastRow <= 1) {
    return { ok: true, period: range.label, total: 0, complete: 0, active: 0, rows: [] };
  }

  const karyawanMap = filterType ? getKaryawanMapByNIK() : null;
  const rangeValues = sheet.getRange(2, 1, lastRow - 1, width);
  const rawData     = rangeValues.getValues();
  const data        = rangeValues.getDisplayValues();
  const startKey = Utilities.formatDate(range.start, 'Asia/Jakarta', 'yyyyMMdd');
  const endKey   = Utilities.formatDate(range.end,   'Asia/Jakarta', 'yyyyMMdd');
  const rows = [];
  let complete = 0;
  let active = 0;

  for (let i = 0; i < data.length; i++) {
    const row    = data[i];
    const rawRow = rawData[i];
    const dateKey = toDateKey(rawRow[0] || row[0]);
    if (!dateKey || dateKey < startKey || dateKey > endKey) continue;
    const rowNik  = asText(row[1]).trim();
    const rowDept = asText(row[3]).trim();
    const rowJabatan = asText(row[4]).trim();
    if (targetNik && rowNik !== targetNik) continue;
    if (filterDpt && rowDept !== filterDpt) continue;
    if (filterType) {
      const master = karyawanMap[rowNik] || {};
      const isExternal = isExternalKaryawan({ type: master.type, dept: rowDept, jabatan: rowJabatan });
      if (filterType === 'internal' && isExternal) continue;
      if (filterType === 'outsource' && !isExternal) continue;
    }
    const status = asText(row[7]);
    if (status === 'SELESAI') complete++;
    if (status === 'DI DALAM') active++;
    rows.push({
      tanggal: formatDisplayedDateValue(rawRow[0], row[0]),
      nik: rowNik,
      nama: asText(row[2]),
      dept: rowDept,
      jabatan: asText(row[4]),
      jamMasuk: formatDisplayedTimeValue(rawRow[5], row[5]),
      jamKeluar: formatDisplayedTimeValue(rawRow[6], row[6]),
      status: status,
      noKartuMK: asText(row[8]),
      noLoker: asText(row[9]),
      sortKey: dateKey + '|' + buildTimeSortKey(rawRow[5], row[5])
    });
  }

  rows.sort(function(a, b) {
    return a.sortKey === b.sortKey ? a.jamMasuk.localeCompare(b.jamMasuk) : a.sortKey.localeCompare(b.sortKey);
  });
  rows.forEach(function(row) { delete row.sortKey; });

  return { ok: true, period: range.label, total: rows.length, complete: complete, active: active, rows: rows };
}

function getAreaActivityReportFullData_(nik, deptFilter, periodType, periodValue) {
  const targetNik = asText(nik).trim();
  const filterDpt = asText(deptFilter).trim();
  const range = getPeriodRange(periodType, periodValue);
  const sheet = getSheet(SHEET_AREA_KERJA);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn <= 0) {
    return { ok: true, period: range.label, total: 0, inCount: 0, outCount: 0, rows: [], recap: [] };
  }

  const rangeValues = sheet.getRange(2, 1, lastRow - 1, lastColumn);
  const rawData = rangeValues.getValues();
  const data = rangeValues.getDisplayValues();
  const karyawanMap = getKaryawanMapByNIK();
  const rows = [];
  let inCount = 0;
  let outCount = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rawRow = rawData[i];
    const rawTanggal = rawRow[2];
    const rawJam = rawRow[3];
    const rowNik = asText(row[4]).trim();
    if (!isDateInRange(rawTanggal, range)) continue;
    if (targetNik && rowNik !== targetNik) continue;
    const employee = karyawanMap[rowNik] || {};
    const rowDept = asText(employee.dept).trim();
    if (filterDpt && rowDept !== filterDpt) continue;
    const inout = asText(row[1]);
    if (inout === 'IN') inCount++;
    if (inout === 'OUT') outCount++;
    rows.push({
      noKartuMK: normalizeCard(row[0]),
      inout: inout,
      tanggal: formatDisplayedDateValue(rawTanggal, row[2]),
      jam: formatDisplayedTimeValue(rawJam, row[3]),
      nik: rowNik,
      nama: asText(row[5]) || asText(employee.nama),
      dept: asText(employee.dept),
      jabatan: asText(employee.jabatan),
      tujuan: asText(row[6]),
      catatan: asText(row[7]),
      sortKey: formatDateForSort(rawTanggal) + '|' + buildTimeSortKey(rawJam, row[3])
    });
  }

  rows.sort(function(a, b) {
    return a.sortKey.localeCompare(b.sortKey);
  });
  // SortKey retained for sorting in getAreaActivityReport

  const recapMap = {};
  rows.forEach(function(row) {
    const id = row.nik || 'UNKNOWN';
    if (!recapMap[id]) {
      recapMap[id] = { nik: id, nama: row.nama, dept: row.dept, in: 0, out: 0, total: 0 };
    }
    recapMap[id].total++;
    if (row.inout === 'IN') recapMap[id].in++;
    if (row.inout === 'OUT') recapMap[id].out++;
  });

  const recap = Object.keys(recapMap).map(function(key) {
    return recapMap[key];
  }).sort(function(a, b) {
    return b.total - a.total;
  });

  return { ok: true, period: range.label, total: rows.length, inCount: inCount, outCount: outCount, rows: rows, recap: recap };
}

function buildAbsenExportFilename_(nik, periodValue) {
  const safeNik = asText(nik).trim() || 'SEMUA';
  const safePeriod = asText(periodValue).trim() || 'PERIODE';
  return 'absen_' + safeNik + '_' + safePeriod + '.csv';
}

function csvCellServer_(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}
