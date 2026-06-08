// ============================================================
//  NFC DAM ACCESS CONTROL — AREA KERJA FUNCTIONS
//  PT Daya Anugrah Mulya
//  Domain: Scan masuk/keluar area kerja, dashboard, recent logs
//  Dependencies: SharedLib.gs, GateFunctions.gs (getBindingStatus)
// ============================================================

// ── Scan Area Kerja ───────────────────────────────────────
function scanAreaKerja(noKartuMK, tujuan, catatan, forceMode) {
  return withDocumentLock(function() {
    try {
      const no = assertCard(noKartuMK);
      const areaTujuan  = asText(tujuan).trim();
      const areaCatatan = asText(catatan).trim();
      if (!areaTujuan) return { ok: false, msg: 'Area pengawasan wajib dipilih sebelum scan.' };

      let kar = getKaryawanByNIK(no);
      if (!kar) {
        const binding = getBindingStatus(no);
        if (!binding.ok) return binding;
        if (binding.status !== 'BOUND') return { ok: false, msg: `Kartu / ID ${no} tidak dikenal atau tidak aktif.`, status: 'UNKNOWN' };
        const master = getKaryawanByNIK(binding.nik) || {};
        kar = {
          nik: binding.nik, nama: binding.nama,
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
        if (normalizeCard(dataA[i][0]) === no) { lastInOut = asText(dataA[i][1]); break; }
      }

      let inout = '';
      if (forceMode === 'IN')       inout = 'IN';
      else if (forceMode === 'OUT') inout = 'OUT';
      else                          inout = (lastInOut === 'OUT') ? 'IN' : 'OUT';

      sheetA.appendRow([no, inout, tanggal, formatTime(now), kar.nik, kar.nama, areaTujuan, areaCatatan]);

      return {
        ok: true, inout, noKartuMK: no, karyawan: kar, waktu,
        area: areaTujuan, catatan: areaCatatan,
        msg: `${kar.nama} -> ${inout === 'IN' ? 'MASUK' : 'KELUAR'} Area Kerja (${areaTujuan})`
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

// ── Dashboard Data ────────────────────────────────────────
function getDashboardData(basis, basisValue, deptFilter, typeFilter) {
  try {
    function toDateKey(value) {
      return formatDateForSort(value);
    }

    function parseTimeParts(value) {
      if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
        return {
          hh: value.getHours(),
          mm: value.getMinutes(),
          ss: value.getSeconds()
        };
      }
      const text = asText(value).trim();
      const match = text.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (!match) return null;
      return {
        hh: parseInt(match[1], 10),
        mm: parseInt(match[2], 10),
        ss: parseInt(match[3] || '0', 10)
      };
    }

    function toDisplayTime(value) {
      if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
        return Utilities.formatDate(value, 'Asia/Jakarta', 'HH:mm:ss');
      }
      const text = asText(value).trim();
      const match = text.match(/(\d{2}:\d{2}:\d{2})/);
      return match ? match[1] : text;
    }

    function buildDateTimeKey(dateValue, timeValue) {
      const dateKey = toDateKey(dateValue);
      const timeParts = parseTimeParts(timeValue);
      const timeKey = timeParts
        ? String(timeParts.hh).padStart(2, '0') + String(timeParts.mm).padStart(2, '0') + String(timeParts.ss).padStart(2, '0')
        : '000000';
      return dateKey + '|' + timeKey;
    }

    function isDateWithinRange(dateKey, startKey, endKey) {
      return Boolean(dateKey) && dateKey >= startKey && dateKey <= endKey;
    }

    function getCurrentShiftLabel() {
      return detectShift(nowWIB());
    }

    function getIsoWeekCode(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
    }

    function isTimeInShift(timeValue, shiftLabel) {
      const parts = parseTimeParts(timeValue);
      if (!parts) return false;
      const hour = parts.hh;
      if (shiftLabel === 'Shift 1') return hour >= 6 && hour < 14;
      if (shiftLabel === 'Shift 2') return hour >= 14 && hour < 22;
      return hour >= 22 || hour < 6;
    }

    function buildBasisConfig(selectedBasis, today) {
      const mode = asText(selectedBasis).trim().toLowerCase() || 'today';
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end = new Date(start);
      let basisLabel = 'Hari ini (WIB)';
      let periodLabel = formatDate(today);
      let metricHint = 'Snapshot operasional dihitung dari recap status DI DALAM dan log area pada basis waktu yang dipilih.';
      let shiftLabel = '';
      const valueText = asText(basisValue).trim();

      if (mode === 'date') {
        const pickedDate = parseIsoDate(valueText) || today;
        start.setTime(new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate()).getTime());
        end.setTime(start.getTime());
        basisLabel = 'Tanggal Tertentu (WIB)';
        periodLabel = formatDate(start);
        metricHint = 'Snapshot operasional memakai recap status DI DALAM pada tanggal yang dipilih.';
      } else if (mode === 'shift') {
        const pickedDate = parseIsoDate(valueText) || today;
        start.setTime(new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate()).getTime());
        end.setTime(start.getTime());
        const selectedShift = asText(valueText).trim().toLowerCase();
        shiftLabel = selectedShift === 'shift2' ? 'Shift 2' : selectedShift === 'shift3' ? 'Shift 3' : 'Shift 1';
        basisLabel = shiftLabel + ' (WIB)';
        periodLabel = formatDate(start) + ' · ' + shiftLabel;
        metricHint = 'Snapshot operasional memakai recap status DI DALAM yang jam masuknya berada dalam ' + shiftLabel + '.';
      } else if (mode === 'week') {
        const match = valueText.match(/^(\d{4})-W(\d{2})$/);
        const targetValue = match ? valueText : getIsoWeekCode(today);
        const parsedMatch = targetValue.match(/^(\d{4})-W(\d{2})$/);
        const year = parseInt(parsedMatch[1], 10);
        const week = parseInt(parsedMatch[2], 10);
        const jan4 = new Date(year, 0, 4);
        const jan4Day = jan4.getDay() || 7;
        start.setTime(new Date(jan4).getTime());
        start.setDate(jan4.getDate() - jan4Day + 1 + ((week - 1) * 7));
        end.setTime(new Date(start).getTime());
        end.setDate(start.getDate() + 6);
        basisLabel = 'Minggu ' + week + ' (WIB)';
        periodLabel = formatDate(start) + ' - ' + formatDate(end);
        metricHint = 'Snapshot operasional memakai status terakhir per karyawan pada minggu yang dipilih.';
      } else if (mode === 'month') {
        const parts = valueText.split('-').map(function(part) { return parseInt(part, 10); });
        const year = parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? parts[0] : today.getFullYear();
        const month = parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? parts[1] - 1 : today.getMonth();
        start.setTime(new Date(year, month, 1).getTime());
        end.setTime(new Date(year, month + 1, 0).getTime());
        basisLabel = 'Bulan Pilihan (WIB)';
        periodLabel = Utilities.formatDate(start, 'Asia/Jakarta', 'MMMM yyyy');
        metricHint = 'Snapshot operasional memakai status terakhir per karyawan pada bulan yang dipilih.';
      }

      return {
        mode,
        startKey: toDateKey(start),
        endKey: toDateKey(end),
        basisLabel,
        periodLabel,
        metricHint,
        shiftLabel
      };
    }

    const now = nowWIB();
    const basisConfig = buildBasisConfig(basis, now);
    const karyawanMap = getKaryawanMapByNIK();
    const recapSheet = getSheet(SHEET_RECAP_ABSEN);
    const recapData  = recapSheet.getDataRange().getValues();
    const boundList = [];
    const insideByNik = {};
    const typeCounts = {};
    const deptCounts = {};
    const latestRecapByNik = {};

    for (let i = 1; i < recapData.length; i++) {
      const rowTanggalKey = toDateKey(recapData[i][0]);
      const rowNik     = asText(recapData[i][1]).trim();
      const rowStatus  = asText(recapData[i][7]).trim().toUpperCase();
      if (!rowNik || !isDateWithinRange(rowTanggalKey, basisConfig.startKey, basisConfig.endKey)) continue;
      if (basisConfig.mode === 'shift' && !isTimeInShift(recapData[i][5], basisConfig.shiftLabel)) continue;

      const sortKey = buildDateTimeKey(recapData[i][0], recapData[i][6] || recapData[i][5]);
      const current = latestRecapByNik[rowNik];
      if (!current || sortKey > current.sortKey) {
        latestRecapByNik[rowNik] = {
          sortKey: sortKey,
          row: recapData[i],
          status: rowStatus
        };
      }
    }

    Object.keys(latestRecapByNik).forEach(function(rowNik) {
      const entry = latestRecapByNik[rowNik];
      if (entry.status !== 'DI DALAM') return;

      const row = entry.row;

      const employee = karyawanMap[rowNik] || {};
      const rawType  = asText(employee.type).trim();
      const typeLabel = rawType || (isExternalKaryawan(employee) ? 'EXTERNAL' : 'INTERNAL');
      const deptLabel = asText(row[3]).trim() || asText(employee.dept).trim() || 'Tanpa Departemen';

      insideByNik[rowNik] = true;
      typeCounts[typeLabel] = (typeCounts[typeLabel] || 0) + 1;
      deptCounts[deptLabel] = (deptCounts[deptLabel] || 0) + 1;
      boundList.push({
        nik: rowNik,
        nama: asText(row[2]),
        dept: deptLabel,
        jabatan: asText(row[4]),
        waktuBind: toDisplayTime(row[5]),
        noKartuMK: normalizeCard(row[8]),
        noLoker: asText(row[9]),
        type: typeLabel
      });
    });

    boundList.sort(function(a, b) {
      return asText(a.waktuBind).localeCompare(asText(b.waktuBind));
    });

    // ── Apply dept / type filter ───────────────────────────
    const deptF = asText(deptFilter).trim().toUpperCase();
    const typeF = asText(typeFilter).trim().toLowerCase();  // '' | 'internal' | 'outsource'
    if (deptF || typeF) {
      for (let fi = boundList.length - 1; fi >= 0; fi--) {
        const fItem = boundList[fi];
        let remove = false;
        if (deptF && (fItem.dept || '').toUpperCase() !== deptF) remove = true;
        if (!remove && typeF === 'internal'  &&  isExternalKaryawan({ type: fItem.type })) remove = true;
        if (!remove && typeF === 'outsource' && !isExternalKaryawan({ type: fItem.type })) remove = true;
        if (remove) {
          boundList.splice(fi, 1);
          delete insideByNik[fItem.nik];
        }
      }
    }

    // ── Shift Coverage dari recapData ──────────────────────
    const shiftCovMap = {
      'Shift 1': { hadir: 0, terlambat: 0, lembur: 0 },
      'Shift 2': { hadir: 0, terlambat: 0, lembur: 0 },
      'Shift 3': { hadir: 0, terlambat: 0, lembur: 0 }
    };
    for (let si = 1; si < recapData.length; si++) {
      const rowDateKey = toDateKey(recapData[si][0]);
      if (!isDateWithinRange(rowDateKey, basisConfig.startKey, basisConfig.endKey)) continue;
      const sStatus = asText(recapData[si][7]).trim().toUpperCase();
      if (!sStatus || sStatus === 'KELUAR TANPA MASUK') continue;
      const sJamMasuk = recapData[si][5];
      if (!sJamMasuk) continue;
      const sMins = timeStrToMinutes(sJamMasuk);
      if (sMins === null) continue;
      const sTempDate = new Date(2000, 0, 1, Math.floor(sMins / 60), sMins % 60, 0);
      const sShift = detectShift(sTempDate);
      if (!shiftCovMap[sShift]) continue;
      shiftCovMap[sShift].hadir++;
      const sLate = getLateMinutes(sJamMasuk, sShift);
      if (sLate !== null && sLate > 0) shiftCovMap[sShift].terlambat++;
      const sJamKeluar = recapData[si][6];
      if (sJamKeluar) {
        const sOver = getOvertimeMinutes(sJamKeluar, sShift);
        if (sOver > 0) shiftCovMap[sShift].lembur++;
      }
    }
    const shiftCoverage = ['Shift 1', 'Shift 2', 'Shift 3'].map(function(sl) {
      return { label: sl, hadir: shiftCovMap[sl].hadir, terlambat: shiftCovMap[sl].terlambat, lembur: shiftCovMap[sl].lembur };
    });

    const boundByNik = {};
    boundList.forEach(function(item) {
      boundByNik[item.nik] = item;
    });

    const sheetA = getSheet(SHEET_AREA_KERJA);
    const dataA  = sheetA.getDataRange().getValues();
    let logHariIni = 0;
    const currentAreaByNik = {};
    const currentAreaMetaByNik = {};
    for (let i = 1; i < dataA.length; i++) {
      if (!isDateWithinRange(toDateKey(dataA[i][2]), basisConfig.startKey, basisConfig.endKey)) continue;
      if (basisConfig.mode === 'shift' && !isTimeInShift(dataA[i][3], basisConfig.shiftLabel)) continue;
      logHariIni++;

      const rowNik = asText(dataA[i][4]).trim();
      if (!insideByNik[rowNik]) continue;

      const inout = asText(dataA[i][1]).trim().toUpperCase();
      const area  = asText(dataA[i][6]).trim() || 'Tanpa Area';
      if (inout === 'IN') {
        currentAreaByNik[rowNik] = area;
        currentAreaMetaByNik[rowNik] = {
          area: area,
          jamMasukArea: toDisplayTime(dataA[i][3]),
          tanggalMasukArea: formatDate(dataA[i][2])
        };
      }
      if (inout === 'OUT') {
        delete currentAreaByNik[rowNik];
        delete currentAreaMetaByNik[rowNik];
      }
    }

    const areaCounts = {};
    const areaItemsMap = {};
    Object.keys(currentAreaByNik).forEach(function(nik) {
      const area = currentAreaByNik[nik];
      areaCounts[area] = (areaCounts[area] || 0) + 1;
      if (!areaItemsMap[area]) areaItemsMap[area] = [];
      const item = boundByNik[nik];
      if (item) areaItemsMap[area].push(item);
    });

    const assignedAreaCount = Object.keys(currentAreaByNik).length;
    const unassignedCount = Math.max(0, boundList.length - assignedAreaCount);
    if (unassignedCount) {
      areaCounts['Belum Scan Area'] = unassignedCount;
      areaItemsMap['Belum Scan Area'] = boundList.filter(function(item) {
        return !currentAreaByNik[item.nik];
      });
    }

    const totalInside = boundList.length;
    const areaPopulation = Object.keys(areaCounts)
      .map(function(area) {
        const total = areaCounts[area];
        const items = (areaItemsMap[area] || [])
          .slice()
          .sort(function(a, b) { return asText(a.nama).localeCompare(asText(b.nama)); })
          .map(function(item) {
            return {
              nik: item.nik,
              nama: item.nama,
              dept: item.dept,
              type: item.type,
              waktuBind: item.waktuBind,
              jabatan: item.jabatan,
              areaLabel: area,
              jamMasukArea: currentAreaMetaByNik[item.nik] ? currentAreaMetaByNik[item.nik].jamMasukArea : '',
              tanggalMasukArea: currentAreaMetaByNik[item.nik] ? currentAreaMetaByNik[item.nik].tanggalMasukArea : ''
            };
          });
        return {
          label: area,
          total: total,
          sharePct: totalInside ? Math.round((total / totalInside) * 100) : 0,
          isUnscanned: area === 'Belum Scan Area',
          items: items
        };
      })
      .sort(function(a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
      });

    const typePopulation = Object.keys(typeCounts)
      .map(function(type) {
        return { label: type, total: typeCounts[type] };
      })
      .sort(function(a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
      });

    const deptPopulationMap = {};
    boundList.forEach(function(item) {
      const deptLabel = item.dept || 'Tanpa Departemen';
      if (!deptPopulationMap[deptLabel]) deptPopulationMap[deptLabel] = [];
      deptPopulationMap[deptLabel].push({
        nik: item.nik,
        nama: item.nama,
        dept: deptLabel,
        type: item.type,
        waktuBind: item.waktuBind,
        jabatan: item.jabatan,
        areaLabel: currentAreaByNik[item.nik] || 'Belum Scan Area',
        jamMasukArea: currentAreaMetaByNik[item.nik] ? currentAreaMetaByNik[item.nik].jamMasukArea : '',
        tanggalMasukArea: currentAreaMetaByNik[item.nik] ? currentAreaMetaByNik[item.nik].tanggalMasukArea : ''
      });
    });

    const deptPopulation = Object.keys(deptCounts)
      .map(function(dept) {
        return {
          label: dept,
          total: deptCounts[dept],
          items: (deptPopulationMap[dept] || []).slice().sort(function(a, b) {
            return asText(a.nama).localeCompare(asText(b.nama));
          })
        };
      })
      .sort(function(a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
      });

    const kanbanGroupsMap = {};
    boundList.forEach(function(item) {
      const areaLabel = currentAreaByNik[item.nik] || 'Belum Scan Area';
      if (!kanbanGroupsMap[areaLabel]) kanbanGroupsMap[areaLabel] = [];
      kanbanGroupsMap[areaLabel].push(item);
    });

    const kanbanGroups = Object.keys(kanbanGroupsMap)
      .map(function(label) {
        return {
          label: label,
          total: kanbanGroupsMap[label].length,
          items: kanbanGroupsMap[label]
            .slice()
            .sort(function(a, b) { return asText(a.nama).localeCompare(asText(b.nama)); })
        };
      })
      .sort(function(a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
      });

    const totalAreaActive = areaPopulation.filter(function(item) { return item.label !== 'Belum Scan Area'; }).length;
    const scanCoveragePct = totalInside ? Math.round((assignedAreaCount / totalInside) * 100) : 0;
    const scanBreakdown = [
      {
        label: 'Sudah Scan Area',
        total: assignedAreaCount,
        sharePct: totalInside ? Math.round((assignedAreaCount / totalInside) * 100) : 0,
        tone: 'scanned'
      },
      {
        label: 'Belum Scan Area',
        total: unassignedCount,
        sharePct: totalInside ? Math.round((unassignedCount / totalInside) * 100) : 0,
        tone: 'unscanned'
      }
    ];
    const summaryHeadline = totalInside
      ? assignedAreaCount
        ? assignedAreaCount + ' dari ' + totalInside + ' orang yang sedang di dalam sudah punya posisi area.'
        : totalInside + ' orang sedang di dalam, tetapi belum ada scan area yang tercatat.'
      : 'Belum ada karyawan berstatus DI DALAM pada basis waktu yang dipilih.';
    const summaryFootnote = unassignedCount
      ? unassignedCount + ' orang masih menunggu scan area atau belum tercatat ke area kerja.'
      : 'Semua orang yang sedang di dalam sudah punya posisi area terakhir.';

    return {
      ok: true,
      basisLabel: basisConfig.basisLabel,
      periodLabel: basisConfig.periodLabel,
      generatedAt: formatDateTime(now),
      metricHint: basisConfig.metricHint,
      totalBound: totalInside,
      totalInside: totalInside,
      totalScannedArea: assignedAreaCount,
      totalUnscannedArea: unassignedCount,
      totalAreaActive: totalAreaActive,
      scanCoveragePct: scanCoveragePct,
      scanBreakdown: scanBreakdown,
      totalJenisKaryawan: typePopulation.length,
      totalDeptAktif: deptPopulation.length,
      summaryHeadline: summaryHeadline,
      summaryFootnote: summaryFootnote,
      boundList,
      logAreaKerjaHariIni: logHariIni,
      areaPopulation,
      typePopulation,
      deptPopulation,
      kanbanGroups,
      shiftCoverage
    };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ── Kehadiran Dashboard ───────────────────────────────────
/**
 * Mengembalikan data kehadiran lengkap untuk tanggal tertentu:
 * - kehadiranList: per-orang dengan status, keterlambatan, lembur
 * - anomaliList: kasus tidak normal
 * - summary: agregat untuk KPI
 *
 * @param {string} tanggal    - format YYYY-MM-DD atau DD/MM/YYYY, default hari ini
 * @param {string} shiftFilter - '' | 'Shift 1' | 'Shift 2' | 'Shift 3'
 * @param {string} deptFilter  - '' = semua dept
 * @param {string} typeFilter  - '' | 'internal' | 'outsource'
 */
function getKehadiranDashboard(tanggal, shiftFilter, deptFilter, typeFilter) {
  try {
    // ── Tentukan tanggal target ────────────────────────────
    const now    = nowWIB();
    let targetDate;
    if (tanggal) {
      targetDate = parseIsoDate(tanggal) || parseSheetDate(tanggal) || new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    const targetKey = formatDateForSort(targetDate);  // yyyyMMdd untuk compare
    const tanggalDisplay = formatDate(targetDate);

    const shiftF = asText(shiftFilter).trim();
    const deptF  = asText(deptFilter).trim().toUpperCase();
    const typeF  = asText(typeFilter).trim().toLowerCase();  // '' | 'internal' | 'outsource'

    // ── Baca KARYAWAN (map by NIK) ────────────────────────
    const karyawanMap = getKaryawanMapByNIK();

    // ── Baca ABSEN IN OUT MK ──────────────────────────────
    const sheetRecap = getSheet(SHEET_RECAP_ABSEN);
    const recapData  = sheetRecap.getDataRange().getValues();
    // Kolom: TANGGAL(0),NIK(1),NAMA(2),DEPARTEMEN(3),JABATAN(4),
    //        JAM MASUK(5),JAM KELUAR(6),STATUS(7),NO KARTU MK(8),NO LOKER(9)

    // Kumpulkan semua row untuk targetDate
    const rowsForDate = [];
    for (let i = 1; i < recapData.length; i++) {
      const rowDate = recapData[i][0];
      if (!rowDate) continue;
      const rowKey = formatDateForSort(rowDate);
      if (rowKey !== targetKey) continue;
      rowsForDate.push(recapData[i]);
    }

    // ── Build kehadiranList ───────────────────────────────
    const kehadiranList = [];
    const anomaliList   = [];

    const ANOMALI_MAX_HOURS = 10;  // DI DALAM lebih dari 10 jam → anomali

    rowsForDate.forEach(function(row) {
      const nik      = asText(row[1]).trim();
      const nama     = asText(row[2]).trim();
      const dept     = asText(row[3]).trim();
      const jabatan  = asText(row[4]).trim();
      const jamMasuk = row[5];
      const jamKeluar= row[6];
      const status   = asText(row[7]).trim();  // 'DI DALAM' | 'SELESAI' | 'KELUAR TANPA MASUK' | ''

      // Enrich dari master
      const master    = karyawanMap[nik] || {};
      const type      = asText(master.type || '');
      const isExternal= isExternalKaryawan({ type, dept, jabatan });

      // Filter dept
      if (deptF && dept.toUpperCase() !== deptF) return;
      // Filter type
      if (typeF === 'internal' && isExternal) return;
      if (typeF === 'outsource' && !isExternal) return;

      // Tentukan shift dari jam masuk (atau jam keluar jika tak ada jam masuk)
      const refTime = jamMasuk || jamKeluar;
      let shiftLabel = '';
      if (refTime) {
        const refDate = (Object.prototype.toString.call(refTime) === '[object Date]' && !isNaN(refTime.getTime()))
          ? refTime
          : (function() {
              const mins = timeStrToMinutes(refTime);
              if (mins === null) return null;
              const d = new Date(targetDate);
              d.setHours(Math.floor(mins/60), mins%60, 0, 0);
              return d;
            })();
        if (refDate) shiftLabel = detectShift(refDate);
      }

      // Filter shift
      if (shiftF && shiftLabel && shiftLabel !== shiftF) return;

      // Format jam
      const jamMasukStr  = jamMasuk  ? (Object.prototype.toString.call(jamMasuk)  === '[object Date]' ? Utilities.formatDate(jamMasuk,  'Asia/Jakarta', 'HH:mm') : asText(jamMasuk).substring(0,5))  : '';
      const jamKeluarStr = jamKeluar ? (Object.prototype.toString.call(jamKeluar) === '[object Date]' ? Utilities.formatDate(jamKeluar, 'Asia/Jakarta', 'HH:mm') : asText(jamKeluar).substring(0,5)) : '';

      // Hitung keterlambatan
      const lateMinutes   = (jamMasukStr && shiftLabel) ? getLateMinutes(jamMasukStr, shiftLabel) : null;
      const lateCategory  = getLateCategory(lateMinutes);

      // Hitung lembur
      const overtimeMinutes = (jamKeluarStr && shiftLabel) ? getOvertimeMinutes(jamKeluarStr, shiftLabel) : 0;

      // Tentukan presenceStatus + deteksi anomali
      let presenceStatus = 'belum_masuk';
      const anomali = [];

      if (status === 'DI DALAM') {
        presenceStatus = 'di_dalam';
        // Cek apakah sudah terlalu lama
        if (jamMasukStr) {
          const masukMins = timeStrToMinutes(jamMasukStr);
          const nowMins   = now.getHours() * 60 + now.getMinutes();
          let diffMins = nowMins - masukMins;
          if (diffMins < 0) diffMins += 24 * 60;  // wrap midnight
          if (diffMins > ANOMALI_MAX_HOURS * 60) {
            anomali.push('DI_DALAM_TERLALU_LAMA');
          }
        }
      } else if (status === 'SELESAI') {
        presenceStatus = 'sudah_pulang';
      } else if (status === 'KELUAR TANPA MASUK') {
        anomali.push('KELUAR_TANPA_MASUK');
      }

      if (anomali.length > 0) {
        presenceStatus = 'anomali';
        anomali.forEach(function(code) {
          anomaliList.push({
            nik, nama, dept, type,
            jam: jamMasukStr || jamKeluarStr,
            kode: code,
            deskripsi: code === 'DI_DALAM_TERLALU_LAMA'
              ? nama + ' masuk ' + jamMasukStr + ' dan masih tercatat di dalam (>' + ANOMALI_MAX_HOURS + ' jam)'
              : nama + ' tercatat keluar tanpa ada rekap masuk'
          });
        });
      }

      kehadiranList.push({
        nik, nama, dept, jabatan, type,
        shift: shiftLabel,
        jamMasuk: jamMasukStr,
        jamKeluar: jamKeluarStr,
        status,
        presenceStatus,
        lateMinutes,
        lateCategory,
        overtimeMinutes,
        anomali
      });
    });

    // ── Summary ───────────────────────────────────────────
    let totalHadir = 0, totalBelumMasuk = 0, totalSudahPulang = 0, totalAnomali = 0;
    let totalOnTime = 0, totalRingan = 0, totalSedang = 0, totalBerat = 0, totalLembur = 0;
    const byShiftMap = {};

    kehadiranList.forEach(function(item) {
      const sl = item.shift || 'Tidak Diketahui';
      if (!byShiftMap[sl]) byShiftMap[sl] = { label: sl, hadir: 0, terlambat: 0, lembur: 0 };

      if (item.presenceStatus === 'belum_masuk') {
        totalBelumMasuk++;
      } else {
        totalHadir++;
        byShiftMap[sl].hadir++;

        if (item.presenceStatus === 'sudah_pulang') totalSudahPulang++;
        if (item.presenceStatus === 'anomali') totalAnomali++;

        switch(item.lateCategory) {
          case 'ontime':  totalOnTime++;  break;
          case 'ringan':  totalRingan++;  byShiftMap[sl].terlambat++; break;
          case 'sedang':  totalSedang++;  byShiftMap[sl].terlambat++; break;
          case 'berat':   totalBerat++;   byShiftMap[sl].terlambat++; break;
        }
        if (item.overtimeMinutes > 0) { totalLembur++; byShiftMap[sl].lembur++; }
      }
    });

    const shiftOrder = ['Shift 1', 'Shift 2', 'Shift 3'];
    const byShift = shiftOrder.map(function(s) {
      return byShiftMap[s] || { label: s, hadir: 0, terlambat: 0, lembur: 0 };
    });
    // Tambahkan shift lain jika ada
    Object.keys(byShiftMap).forEach(function(s) {
      if (shiftOrder.indexOf(s) === -1) byShift.push(byShiftMap[s]);
    });

    return {
      ok: true,
      tanggal: tanggalDisplay,
      summary: {
        totalHadir,
        totalBelumMasuk,
        totalSudahPulang,
        totalOnTime,
        totalTerlambat: { ringan: totalRingan, sedang: totalSedang, berat: totalBerat },
        totalLembur,
        totalAnomali,
        byShift
      },
      kehadiranList,
      anomaliList
    };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ── Recent Area Logs ──────────────────────────────────────
function getRecentAreaLogs(limit) {
  try {
    const n     = Math.max(1, Math.min(parseInt(limit, 10) || 30, 100));
    const sheet = getSheet(SHEET_AREA_KERJA);
    const data  = sheet.getDataRange().getValues();
    const rows  = [];
    for (let i = data.length - 1; i >= 1 && rows.length < n; i--) {
      rows.push({
        noKartuMK: normalizeCard(data[i][0]), inout:  asText(data[i][1]),
        tanggal:   asText(data[i][2]),        jam:    asText(data[i][3]),
        nik:       asText(data[i][4]),        nama:   asText(data[i][5]),
        tujuan:    asText(data[i][6]),        catatan:asText(data[i][7])
      });
    }
    return { ok: true, data: rows };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}
