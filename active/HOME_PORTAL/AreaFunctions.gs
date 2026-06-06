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
