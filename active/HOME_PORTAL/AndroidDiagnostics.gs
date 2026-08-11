// ============================================================
//  ANDROID DIAGNOSTICS — TELEMETRY & GATEWAY OBSERVABILITY
//  PT Daya Anugrah Mulya
//  Domain: Android prewarm, connection diagnostics, request tracing
// ============================================================

function trimAndroidDiagnosticText_(value, maxLength) {
  const text = asText(value);
  const cap = Math.max(1, parseInt(maxLength, 10) || 0);
  return cap && text.length > cap ? text.slice(0, cap) : text;
}

function normalizeAndroidDiagnosticInt_(value) {
  const num = parseInt(value, 10);
  return isNaN(num) ? '' : String(num);
}

function sanitizeAndroidDiagnosticEvent_(event) {
  const source = event && typeof event === 'object' ? event : {};
  let payloadJson = '';

  try {
    if (source.payloadJson) {
      payloadJson = asText(source.payloadJson);
    } else if (source.payloadSummary && typeof source.payloadSummary === 'object') {
      payloadJson = JSON.stringify(source.payloadSummary);
    } else if (source.payload && typeof source.payload === 'object') {
      payloadJson = JSON.stringify(source.payload);
    }
  } catch(ePayload) {
    payloadJson = JSON.stringify({ error: ePayload.message });
  }

  return {
    eventId: trimAndroidDiagnosticText_(source.eventId, 120),
    eventAt: trimAndroidDiagnosticText_(source.eventAt, 40),
    source: trimAndroidDiagnosticText_(source.source || 'android', 40),
    action: trimAndroidDiagnosticText_(source.action, 80),
    phase: trimAndroidDiagnosticText_(source.phase, 40),
    outcome: trimAndroidDiagnosticText_(source.outcome, 40),
    failureKind: trimAndroidDiagnosticText_(source.failureKind, 40),
    requestId: trimAndroidDiagnosticText_(source.requestId, 120),
    httpStatus: trimAndroidDiagnosticText_(source.httpStatus, 20),
    latencyMs: normalizeAndroidDiagnosticInt_(source.latencyMs),
    message: trimAndroidDiagnosticText_(source.message, 500),
    nik: trimAndroidDiagnosticText_(source.nik, 40),
    role: trimAndroidDiagnosticText_(source.role, 40),
    deviceSessionId: trimAndroidDiagnosticText_(source.deviceSessionId, 120),
    payloadJson: trimAndroidDiagnosticText_(payloadJson, 2000)
  };
}

function pingAndroidGateway(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const now = nowWIB();
  return {
    ok: true,
    msg: 'Gateway Android siap.',
    serverTime: formatDateTime(now),
    serverDate: formatDate(now),
    clientRequestId: trimAndroidDiagnosticText_(source.clientRequestId, 120)
  };
}

function logAndroidDiagnostics(payload) {
  try {
    const source = payload && typeof payload === 'object' ? payload : {};
    const rawEvents = Array.isArray(source.events) ? source.events : [];
    if (!rawEvents.length) {
      return { ok: true, accepted: 0, dropped: 0, msg: 'Tidak ada event diagnostik untuk disimpan.' };
    }

    const events = rawEvents
      .slice(0, 25)
      .map(sanitizeAndroidDiagnosticEvent_)
      .filter(function(event) {
        return event.eventId || event.action || event.message || event.requestId;
      });

    if (!events.length) {
      return { ok: true, accepted: 0, dropped: rawEvents.length, msg: 'Event diagnostik kosong setelah sanitasi.' };
    }

    const receivedAt = formatDateTime(nowWIB());
    const sheet = getSheet(SHEET_ANDROID_DIAGNOSTICS);
    const startRow = sheet.getLastRow() + 1;
    const rows = events.map(function(event) {
      return [
        event.eventId,
        event.eventAt || receivedAt,
        receivedAt,
        event.source,
        event.action,
        event.phase,
        event.outcome,
        event.failureKind,
        event.requestId,
        event.httpStatus,
        event.latencyMs,
        event.message,
        event.nik,
        event.role,
        event.deviceSessionId,
        event.payloadJson
      ];
    });

    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setNumberFormat('@');

    return {
      ok: true,
      accepted: rows.length,
      dropped: Math.max(0, rawEvents.length - rows.length),
      msg: rows.length + ' event diagnostik Android berhasil disimpan.'
    };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}
