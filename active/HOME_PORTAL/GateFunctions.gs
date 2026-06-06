// ============================================================
//  NFC DAM ACCESS CONTROL — GATE PABRIK FUNCTIONS
//  PT Daya Anugrah Mulya
//  Domain: Binding kartu MK, absen masuk/keluar pabrik
//  Dependencies: SharedLib.gs
// ============================================================

// ── Recap Absen Engine ────────────────────────────────────
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
    asText(tanggal), asText(nik), asText(nama), asText(dept), asText(jabatan),
    finalJamMasuk, finalJamKeluar,
    getRecapStatus(finalJamMasuk, finalJamKeluar),
    asText(noKartuMK || ''), asText(noLoker || '')
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

// ── Binding Status ────────────────────────────────────────
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
          nik:         asText(data[i][1]),
          nama:        asText(data[i][2]),
          dept:        asText(data[i][3]),
          jabatan:     asText(data[i][4]),
          waktuBind:   asText(data[i][5]),
          status:      asText(data[i][6]) || 'FREE',
          waktuRelease:asText(data[i][7]),
          row:         i + 1
        };
      }
    }

    const kar = getKaryawanByNIK(no);
    if (kar && !isExternalKaryawan(kar)) {
      const todayStatus = getFactoryRecapStatus(kar.nik, formatDate(nowWIB()));
      if (todayStatus === 'DI DALAM') {
        return {
          ok: true, noKartuMK: no, nik: kar.nik, nama: kar.nama,
          dept: kar.dept, jabatan: kar.jabatan,
          waktuBind: 'ID Card internal', status: 'BOUND',
          waktuRelease: '', row: 0, isInternalId: true
        };
      }
    }
    return { ok: true, status: 'FREE', noKartuMK: no };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ── Bind Kartu (Masuk Pabrik) ─────────────────────────────
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

      if (factoryStatus === 'DI DALAM') return { ok: false, msg: `${kar.nama} sudah tercatat masuk dan belum keluar.` };
      if (factoryStatus === 'SELESAI')  return { ok: false, msg: `${kar.nama} sudah menyelesaikan absen hari ini.` };
      if (isExternal && no === kar.nik) return { ok: false, msg: 'Karyawan external wajib scan kartu MK, bukan NIK.' };
      if (!isExternal && no !== kar.nik) return { ok: false, msg: 'Karyawan internal wajib memakai NIK / ID internal sendiri.' };

      if (!isExternal) {
        const now2 = nowWIB();
        const jam2 = formatTime(now2);
        getSheet(SHEET_MASUK_PABRIK).appendRow([no, kar.nik, kar.nama, tanggal, jam2, detectShift(now2), loker || '']);
        safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, jam2, '', no, loker || '');
        return { ok: true, msg: `Karyawan ${kar.nama} berhasil masuk (via ID Card)`, karyawan: kar, noKartuMK: no, waktu: formatDateTime(now2), shift: detectShift(now2) };
      }

      const existing = getBindingStatus(no);
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

      const sheetB = getSheet(SHEET_BINDING);
      const dataB  = sheetB.getDataRange().getValues();
      for (let i = 1; i < dataB.length; i++) {
        if (asText(dataB[i][1]).trim() === asText(nik).trim() && asText(dataB[i][6]) === 'BOUND') {
          const oldKartu = asText(dataB[i][0]);
          return {
            ok: false, msg: `NIK ${nik} sudah terikat di kartu ${oldKartu}.`,
            htmlMsg: `❌ NIK <strong>${escHtml(nik)}</strong> masih terikat di kartu <strong>${escHtml(oldKartu)}</strong>.<br>
                      <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.7);border-radius:4px;color:#333;font-size:13px;border-left:3px solid #dc3545;">
                        Harap ke Security untuk lepas binding kartu lama.
                      </div>`,
            requiresSecurityRelease: true, boundCardNo: oldKartu
          };
        }
      }

      const waktu = formatDateTime(now);
      sheetB.appendRow([no, kar.nik, kar.nama, kar.dept, kar.jabatan, waktu, 'BOUND']);
      getSheet(SHEET_MASUK_PABRIK).appendRow([no, kar.nik, kar.nama, tanggal, jam, detectShift(now), loker || '']);
      safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, jam, '', no, loker || '');
      return { ok: true, msg: `Kartu ${no} berhasil diikat ke ${kar.nama}`, karyawan: kar, noKartuMK: no, waktu, shift: detectShift(now) };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}

// ── Release Kartu (Keluar Pabrik) ─────────────────────────
function releaseKartu(noKartuMK, loker) {
  return withDocumentLock(function() {
    try {
      const no = assertCard(noKartuMK);
      if (asText(loker).trim().toUpperCase() === 'FORCE_RELEASE') {
        return { ok: false, msg: 'Release paksa mandiri dinonaktifkan. Datang ke Security.' };
      }

      const kar = getKaryawanByNIK(no);
      if (kar) {
        if (isExternalKaryawan(kar)) return { ok: false, msg: 'Karyawan external harus keluar memakai kartu MK yang terikat.' };
        const now = nowWIB();
        const tanggal = formatDate(now);
        const factoryStatus = getFactoryRecapStatus(kar.nik, tanggal);
        if (factoryStatus !== 'DI DALAM') return { ok: false, msg: `${kar.nama} belum tercatat berada di dalam pabrik hari ini.` };
        const jam = formatTime(now);
        getSheet(SHEET_KELUAR_PABRIK).appendRow([no, kar.nik, kar.nama, tanggal, jam, detectShift(now), loker || '']);
        safeUpdateRecapAbsen(tanggal, kar.nik, kar.nama, kar.dept, kar.jabatan, '', jam, no, loker || '');
        return { ok: true, msg: `Karyawan ${kar.nama} berhasil keluar (via ID Card)`, karyawan: kar, noKartuMK: no, waktu: formatDateTime(now) };
      }

      const binding = getBindingStatus(no);
      if (!binding.ok) return binding;
      if (binding.status !== 'BOUND') return { ok: false, msg: `Kartu / ID ${no} tidak dalam status terikat.` };

      const now = nowWIB();
      const waktu = formatDateTime(now);
      const tanggal = formatDate(now);
      const factoryStatus = getFactoryRecapStatus(binding.nik, tanggal);
      if (factoryStatus === 'SELESAI') return { ok: false, msg: `${binding.nama} sudah tercatat keluar hari ini.` };

      const sheetB = getSheet(SHEET_BINDING);
      sheetB.getRange(binding.row, 7).setValue('FREE');
      const releaseCol = getHeaderIndex(sheetB, 'WAKTU_RELEASE');
      if (releaseCol > 0) sheetB.getRange(binding.row, releaseCol).setValue(waktu);

      const jam = formatTime(now);
      getSheet(SHEET_KELUAR_PABRIK).appendRow([no, binding.nik, binding.nama, tanggal, jam, detectShift(now), loker || '']);
      safeUpdateRecapAbsen(tanggal, binding.nik, binding.nama, binding.dept, binding.jabatan, '', jam, no, loker || '');
      return {
        ok: true, msg: `Kartu ${no} berhasil dilepas dari ${binding.nama}`,
        karyawan: { nik: binding.nik, nama: binding.nama, dept: binding.dept, jabatan: binding.jabatan },
        noKartuMK: no, waktu
      };
    } catch(e) {
      return { ok: false, msg: e.message };
    }
  });
}
