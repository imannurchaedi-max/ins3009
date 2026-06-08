<?php include 'header.php'; ?>

<style>
    .nav-custom { border-left: 5px solid var(--header-blue); }
    .card { transition: all 0.3s ease; border-radius: 15px !important; border: none !important; }
    .speed-number { letter-spacing: -1px; }
    .status-pill { transition: all 0.5s ease; }
    .sku-badge { font-size: 0.65rem; background: #f1f2f6; color: #57606f; padding: 2px 8px; border-radius: 4px; border: 1px solid #dfe6e9; font-weight: 800; }
    .stop-badge { font-size: 0.6rem; padding: 2px 8px; border-radius: 4px; display: none; background: #fff5f5; color: #e74c3c; border: 1px solid #e74c3c; font-weight: 700; }
    .chart-off-bg { background: #fff5f5 !important; }
    .chart-off-border { box-shadow: inset 0 0 0 2px #e74c3c; border-radius: 8px; }
    .analytics-section { background: #ffffff; border-radius: 15px; border: 1px solid #dfe6e9; }
    .btn-calculate { background: #2980b9; color: white; font-weight: 700; border-radius: 10px; border: none; }
    .btn-calculate:hover { background: #1f6391; transform: translateY(-2px); color: white; }
    .btn-reset { background: #636e72; color: white; font-weight: 700; border-radius: 10px; border: none; display: none; }
    .downtime-panel { border-top: 1px solid #eef2f7; background: #fcfdff; }
    .downtime-details { width: 100%; }
    .downtime-details summary { cursor: pointer; list-style: none; font-size: 0.72rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; justify-content: space-between; padding: 10px 0 6px; }
    .downtime-details summary::-webkit-details-marker { display: none; }
    .downtime-details summary::after { content: '▾'; font-size: 0.9rem; color: #64748b; transition: transform 0.2s ease; }
    .downtime-details[open] summary::after { transform: rotate(180deg); }
    .downtime-table-wrap { padding-bottom: 6px; }
    .downtime-table { font-size: 0.78rem; margin-bottom: 0; }
    .downtime-table thead th { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom-color: #e2e8f0; }
    .downtime-table tbody td { color: #334155; vertical-align: middle; }
    .downtime-empty { color: #94a3b8; font-style: italic; text-align: center; }
    .downtime-duration { font-weight: 800; color: #dc2626; }
    .tv-mode-active .downtime-details summary { font-size: 4rem !important; padding: 20px 0 10px; }
    .tv-mode-active .downtime-table { font-size: 2rem !important; }
    .tv-mode-active .downtime-table thead th { font-size: 1.8rem !important; padding: 15px; }
    .tv-mode-active .downtime-table tbody td { padding: 15px; }
    .tv-mode-active .sku-badge { font-size: 1.5rem; padding: 8px 15px; }
    .tv-mode-active .stop-badge { font-size: 3rem; padding: 15px 25px; }
    .tv-mode-active .m-title { font-size: 10rem !important; color: #0f172a !important; line-height: 1; margin-bottom: 10px; }
    .tv-mode-active #shift-info-badge { font-size: 1.5rem !important; padding: 10px 25px !important; }
    .tv-mode-active span[id^="out_"] { font-size: 3.5rem !important; }
    .tv-mode-active span[id^="tgt_"] { font-size: 2rem !important; }
    .tv-mode-active small.text-muted.fw-bold.d-block { font-size: 1.5rem !important; }
    .tv-mode-active .nav-custom div[style*="font-size: 1.1rem"] { font-size: 2rem !important; }
    .tv-controls { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.9); padding: 10px 20px; border-radius: 30px; display: none; z-index: 9999; backdrop-filter: blur(10px); box-shadow: 0 10px 25px rgba(0,0,0,0.5); gap: 15px; align-items: center; border: 1px solid rgba(255,255,255,0.1); }
    .tv-btn { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; transition: transform 0.2s, color 0.2s; outline: none; }
    .tv-btn:hover { color: #3498db; transform: scale(1.1); }
    .tv-indicator { color: #94a3b8; font-size: 0.85rem; font-weight: bold; letter-spacing: 1px; margin: 0 10px; }
</style>

<div id="offline-banner" class="alert alert-danger text-center shadow-sm fw-bold m-0" style="display:none; position:fixed; top:0; left:0; width:100%; z-index:9999; border-radius:0;">
    <i class="fas fa-exclamation-triangle me-2"></i> KONEKSI TERPUTUS - Mencoba menyambung kembali...
</div>

<div id="tv-controls" class="tv-controls">
    <button class="tv-btn" onclick="prevTVSlide()" title="Previous"><i class="fas fa-step-backward"></i></button>
    <button id="btnTVPause" class="tv-btn" onclick="toggleTVPause()" title="Pause/Play"><i class="fas fa-pause"></i></button>
    <button class="tv-btn" onclick="nextTVSlide()" title="Next"><i class="fas fa-step-forward"></i></button>
    <div id="tv-indicator" class="tv-indicator">MACHINE 1/6</div>
    <button class="tv-btn ms-2" style="color: #e74c3c; font-size: 1.2rem;" onclick="toggleTVMode()" title="Exit TV Mode"><i class="fas fa-times"></i></button>
</div>
<div class="nav-custom p-3 m-3 bg-white rounded shadow-sm d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
    <div class="d-flex align-items-center">
        <span class="fs-4 me-2">🚀</span>
        <div style="font-weight: 700; color: #2d3436; font-size: 1.1rem;">Machine Analysis & Monitoring</div>
    </div>
    <div id="shift-info-badge" class="badge bg-primary rounded-pill px-3 py-2" style="font-size: 0.7rem; display: none;"></div>
    <div id="realtime-filter" class="d-flex flex-wrap align-items-center gap-2">
        <small class="text-muted fw-bold">CHART RANGE:</small>
        <select id="filterHours" class="form-select form-select-sm shadow-sm" style="width: 200px;" onchange="updateData()">
            <option value="">📊 Shift Scope (Default)</option>
            <option value="1">🔴 Real-Time (1 Jam)</option>
            <?php for($i=2; $i<=24; $i++): ?>
                <option value="<?= $i ?>"><?= $i ?> Jam Terakhir</option>
            <?php endfor; ?>
        </select>
        <button class="btn btn-sm btn-dark shadow-sm" onclick="toggleTVMode()"><i class="fas fa-tv"></i> TV Mode</button>
    </div>
</div>

<div class="analytics-section mx-3 mb-4 p-4 shadow-sm">
    <div class="row g-3 align-items-end">
        <div class="col-12 col-md-6 col-lg-3">
            <label class="small fw-bold text-muted mb-2 text-uppercase">Machine</label>
            <div class="d-flex flex-wrap gap-2" id="machine-checkbox-group">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="chkAll" checked onchange="toggleAllMachines(this)">
                    <label class="form-check-label fw-bold small text-dark" for="chkAll">ALL</label>
                </div>
                <?php
                $machineOptions = [
                    ['BHP 1', '#0984e3'],
                    ['BHP 2', '#00b894'],
                    ['BHP 3', '#fdcb6e'],
                    ['BHP 4', '#e17055'],
                    ['BHP 5', '#a2de12'],
                    ['AHP 1', '#6c5ce7'],
                ];
                foreach($machineOptions as $opt):
                ?>
                <div class="form-check">
                    <input class="form-check-input machine-chk" type="checkbox" value="<?= $opt[0] ?>" id="chk<?= str_replace(' ','',$opt[0]) ?>" checked onchange="onMachineToggle()">
                    <label class="form-check-label fw-bold small" for="chk<?= str_replace(' ','',$opt[0]) ?>" style="color:<?= $opt[1] ?>"><?= $opt[0] ?></label>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
            <label class="small fw-bold text-muted mb-1 text-uppercase">Date From</label>
            <input type="date" id="analDateFrom" class="form-control form-control-sm" value="<?= date('Y-m-d') ?>">
            <label class="small fw-bold text-muted mb-1 mt-2 text-uppercase">Time From</label>
            <input type="time" id="analStart" class="form-control form-control-sm" value="06:00">
        </div>
        <div class="col-12 col-md-6 col-lg-3">
            <label class="small fw-bold text-muted mb-1 text-uppercase">Date To</label>
            <input type="date" id="analDateTo" class="form-control form-control-sm" value="<?= date('Y-m-d') ?>">
            <label class="small fw-bold text-muted mb-1 mt-2 text-uppercase">Time To</label>
            <input type="time" id="analEnd" class="form-control form-control-sm" value="14:00">
        </div>
        <div class="col-12 col-md-6 col-lg-3">
            <div class="d-flex flex-column h-100 justify-content-end pb-1 mt-3 mt-lg-0">
                <label class="small fw-bold text-muted mb-1 text-uppercase">Quick Preset</label>
                <select id="analPreset" class="form-select form-select-sm rounded-3 mb-2" onchange="applyPreset()">
                    <option value="">-- Pilih Preset --</option>
                    <option value="last_1_shift">1 Shift Terakhir (8 Jam)</option>
                    <option value="last_2_shift">2 Shift Terakhir (16 Jam)</option>
                    <option value="last_3_shift">3 Shift Terakhir (24 Jam)</option>
                    <option value="shift_1">Shift 1 (06:00-14:00)</option>
                    <option value="shift_2">Shift 2 (14:00-22:00)</option>
                    <option value="shift_3">Shift 3 (22:00-06:00)</option>
                </select>
                <button class="btn btn-sm btn-calculate py-2 text-uppercase shadow-sm mb-2" onclick="startAnalysis()">Analyze</button>
                <button id="btnReset" class="btn btn-sm btn-reset py-2 shadow-sm" onclick="resetAnalysis()"><i class="fas fa-undo"></i> Reset</button>
            </div>
        </div>
    </div>
</div>

<div class="container-fluid px-4">
    <div class="row" id="machine-container"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
const STOP_SPEED_THRESHOLD = <?= (int)getStopSpeedThreshold() ?>;
const machines = [
    { id: 'BHP1', name: 'BHP 1', color: '#0984e3', max: 500 }, 
    { id: 'BHP2', name: 'BHP 2', color: '#00b894', max: 500 }, 
    { id: 'BHP3', name: 'BHP 3', color: '#fdcb6e', max: 500 }, 
    { id: 'BHP4', name: 'BHP 4', color: '#e17055', max: 800 }, 
    { id: 'BHP5', name: 'BHP 5', color: '#a2de12', max: 800 }, 
    { id: 'AHP1', name: 'AHP 1', color: '#6c5ce7', max: 300 }  
];

const charts = {};
let isAnalysisMode = false;
let tvModeActive = false;
let tvPaused = false;
let tvSlideIndex = 0;
let tvTimer = null;
let tvMachines = [];

const container = document.getElementById('machine-container');
machines.forEach(m => {
    container.innerHTML += `
        <div id="col_${m.id}" class="col-xl-6 mb-4 machine-card">
            <div class="card shadow-sm overflow-hidden">
                <div class="p-4 d-flex justify-content-between align-items-start bg-white">
                    <div>
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <div class="fw-bold small text-uppercase text-muted m-title">${m.name}</div>
                            <span id="sku_${m.id}" class="sku-badge">SKU: --</span>
                        </div>
                        <span id="status_${m.id}" class="status-pill badge rounded-pill px-3 py-2" style="font-size: 0.65rem;">Checking...</span>
                        <span id="stop_${m.id}" class="stop-badge"></span>
                    </div>
                    <div class="text-end">
                        <h1 class="m-0 fw-bold speed-number text-dark" id="val_${m.id}" style="font-size: 3.5rem;">0</h1>
                        <small class="fw-bold text-muted text-uppercase">PPM</small>
                    </div>
                </div>
                <div id="chart_bg_${m.id}" style="height:250px; padding: 0 15px; background: #ffffff; transition: background 0.5s ease;">
                    <canvas id="chart_${m.id}"></canvas>
                </div>
                <div class="px-3 downtime-panel">
                    <details id="downtime_details_${m.id}" class="downtime-details">
                        <summary><span id="downtime_summary_${m.id}">Downtime Detail (0 Event)</span></summary>
                        <div class="downtime-table-wrap">
                            <table class="table table-sm downtime-table">
                                <thead>
                                    <tr>
                                        <th style="width: 44px;">#</th>
                                        <th>Awal</th>
                                        <th>Akhir</th>
                                        <th>Durasi</th>
                                    </tr>
                                </thead>
                                <tbody id="downtime_body_${m.id}">
                                    <tr><td colspan="4" class="downtime-empty">Belum ada downtime pada range ini.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </details>
                </div>
                <div class="p-3 bg-light d-flex justify-content-between align-items-center mt-2 rounded-bottom border-top">
                    <span class="fw-bold text-muted small text-uppercase">Output</span>
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-bold text-primary font-monospace" id="out_${m.id}">0</span>
                        <span class="text-muted">/</span>
                        <span class="fw-bold text-secondary font-monospace" id="tgt_${m.id}" style="font-size:0.75rem;">--</span>
                    </div>
                </div>
            </div>
        </div>
    `;
});

function createChart(canvasId, color, maxScale) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: color, borderWidth: 2, fill: false, tension: 0, pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: color }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            interaction: { intersect: false, mode: 'index' },
            scales: { 
                y: { 
                    min: 0, max: maxScale, 
                    grid: { color: 'rgba(0,0,0,0.05)' }, 
                    border: { display: false },
                    ticks: { font: { size: 16, weight: 'bold' } }
                }, 
                x: { 
                    grid: { display: false }, 
                    ticks: { maxTicksLimit: 30, font: { size: 16, weight: 'bold' } } 
                } 
            },
            plugins: { legend: { display: false } }
        }
    });
}

machines.forEach(m => { charts[m.name] = createChart('chart_' + m.id, m.color, m.max); });

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateDowntimePanel(machineId, stopEvents) {
    const summaryEl = document.getElementById('downtime_summary_' + machineId);
    const bodyEl = document.getElementById('downtime_body_' + machineId);
    const detailsEl = document.getElementById('downtime_details_' + machineId);

    if (!summaryEl || !bodyEl || !detailsEl) return;

    const count = stopEvents?.count || 0;
    const totalDuration = stopEvents?.total_duration || 0;

    summaryEl.innerText = count > 0
        ? `Downtime Detail (${count} Event | ${totalDuration} Menit)`
        : 'Downtime Detail (0 Event)';

    if (!count || !Array.isArray(stopEvents.all_stops) || stopEvents.all_stops.length === 0) {
        bodyEl.innerHTML = '<tr><td colspan="4" class="downtime-empty">Belum ada downtime pada range ini.</td></tr>';
        return;
    }

    bodyEl.innerHTML = stopEvents.all_stops.map((stop, idx) => {
        const endLabel = stop.ongoing
            ? `Berlangsung${stop.last_seen ? ' (s.d. ' + escapeHtml(stop.last_seen) + ')' : ''}`
            : escapeHtml(stop.end || '--');

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(stop.start || '--')}</td>
                <td>${endLabel}</td>
                <td><span class="downtime-duration">${escapeHtml(stop.duration || 0)} menit</span></td>
            </tr>
        `;
    }).join('');
}

function applyPreset() {
    const p = document.getElementById('analPreset').value;
    if (!p) return;

    const now = new Date();
    const dFrom = document.getElementById('analDateFrom');
    const dTo   = document.getElementById('analDateTo');
    const tFrom = document.getElementById('analStart');
    const tTo   = document.getElementById('analEnd');

    const ymd = (d) => {
        const y  = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        return `${y}-${mo}-${dy}`;
    };
    const hm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

    // Deteksi shift aktif — mirror PHP getShiftID():
    // Shift 1: 06:00–13:59 (360–839 min)
    // Shift 2: 14:00–21:59 (840–1319 min)
    // Shift 3: 22:00–05:59 (>= 1320 || < 360 min)
    const currentMins = now.getHours() * 60 + now.getMinutes();
    let currentShiftIdx;
    if      (currentMins >= 360 && currentMins <= 839)  currentShiftIdx = 1;
    else if (currentMins >= 840 && currentMins <= 1319) currentShiftIdx = 2;
    else                                                 currentShiftIdx = 3;

    if (p === 'shift_1') {
        dFrom.value = ymd(now); tFrom.value = '06:00';
        dTo.value   = ymd(now); tTo.value   = '14:00';

    } else if (p === 'shift_2') {
        dFrom.value = ymd(now); tFrom.value = '14:00';
        dTo.value   = ymd(now); tTo.value   = '22:00';

    } else if (p === 'shift_3') {
        tFrom.value = '22:00';
        tTo.value   = '06:00';
        if (currentMins < 360) {
            // 00:00–05:59 — shift dimulai kemarin
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            dFrom.value = ymd(yesterday);
            dTo.value   = ymd(now);
        } else {
            // 22:00–23:59 — shift berakhir besok
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dFrom.value = ymd(now);
            dTo.value   = ymd(tomorrow);
        }

    } else if (p.startsWith('last_')) {
        const shifts = parseInt(p.split('_')[1]);

        // baseDate = hari ini, kecuali shift 3 bagian awal (00:00–05:59)
        const baseDate = new Date(now);
        baseDate.setHours(0, 0, 0, 0);
        if (currentShiftIdx === 3 && currentMins < 360) {
            baseDate.setDate(baseDate.getDate() - 1);
        }

        // endDate = awal shift aktif = akhir shift terakhir yang selesai
        const endDate = new Date(baseDate);
        if      (currentShiftIdx === 1) endDate.setHours(6,  0, 0, 0);
        else if (currentShiftIdx === 2) endDate.setHours(14, 0, 0, 0);
        else                            endDate.setHours(22, 0, 0, 0);

        // startDate = mundur N × 8 jam dari endDate
        const startDate = new Date(endDate);
        startDate.setHours(startDate.getHours() - (shifts * 8));

        dTo.value   = ymd(endDate);
        tTo.value   = hm(endDate);
        dFrom.value = ymd(startDate);
        tFrom.value = hm(startDate);
    }

    // Preset → langsung execute. Manual input (mesin/tanggal/waktu) tetap butuh klik Analyze.
    startAnalysis();
}

function toggleAllMachines(el) {
    document.querySelectorAll('.machine-chk').forEach(cb => { cb.checked = el.checked; });
    onMachineToggle();
}

function onMachineToggle() {
    const checks = document.querySelectorAll('.machine-chk:checked');
    const allChecked = checks.length === document.querySelectorAll('.machine-chk').length;
    document.getElementById('chkAll').checked = allChecked;

    const gridClass = checks.length === 1 ? 'col-xl-12 mb-4 machine-card' : 'col-xl-6 mb-4 machine-card';

    // Update card visibility langsung tanpa tunggu interval berikutnya
    if (!isAnalysisMode) {
        machines.forEach(m => {
            const chk = document.getElementById('chk' + m.id);
            const col = document.getElementById('col_' + m.id);
            if (chk && !chk.checked) {
                col.style.display = 'none';
            } else {
                col.style.display = 'block';
                col.className = gridClass;
            }
        });
    }
}

function startAnalysis() {
    const checks = document.querySelectorAll('.machine-chk:checked');
    if(checks.length === 0) { alert("Pilih minimal 1 mesin!"); return; }

    // Nonaktifkan filter realtime selama analysis mode
    const filterEl = document.getElementById('filterHours');
    filterEl.disabled = true;
    filterEl.closest('#realtime-filter').style.opacity = '0.4';
    const machinesSelected = Array.from(checks).map(o => o.value);
    const dateFrom = document.getElementById('analDateFrom').value;
    const dateTo = document.getElementById('analDateTo').value;
    const start = document.getElementById('analStart').value;
    const end = document.getElementById('analEnd').value;

    if(!dateFrom || !dateTo) { alert("Pilih tanggal dulu cuy!"); return; }

    isAnalysisMode = true;
    document.getElementById('btnReset').style.display = 'inline-block';

    const gridClass = machinesSelected.length === 1 ? 'col-xl-12 mb-4 machine-card' : 'col-xl-6 mb-4 machine-card';

    machines.forEach(m => {
        const col = document.getElementById('col_' + m.id);
        const labelOut = col.querySelector('.p-3.bg-light span:first-child');
        
        if (machinesSelected.includes(m.name)) {
            col.style.display = 'block';
            col.className = gridClass;
            document.getElementById('status_' + m.id).innerText = "📊 DEEP ANALYSIS MODE";
            document.getElementById('status_' + m.id).className = "badge bg-dark rounded-pill px-3 py-2 text-white";
            labelOut.innerText = "Pure Audit Output (Selected Range Only)";
        } else { 
            col.style.display = 'none'; 
        }
    });

    const mQuery = machinesSelected.join(',');

    fetch(`data.php?mode=deep_analysis&machine=${encodeURIComponent(mQuery)}&date_from=${dateFrom}&date_to=${dateTo}&start=${start}&end=${end}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('offline-banner').style.display = 'none';
            machinesSelected.forEach(mName => {
                const machineData = data[mName];
                if(machineData) {
                    charts[mName].data.labels = machineData.labels;
                    charts[mName].data.datasets[0].data = machineData.values;
                    charts[mName].update();

                    const mObj = machines.find(m => m.name === mName);
                    const colEl = document.getElementById('col_' + mObj.id);
                    const labelOutA = colEl.querySelector('.p-3.bg-light span:first-child');
                    if (machineData.hours_in_range) {
                        labelOutA.innerText = `Audit Output (${machineData.hours_in_range}h)`;
                    }

                    const outEl = document.getElementById('out_' + mObj.id);
                    outEl.innerText = parseInt(machineData.total_audit).toLocaleString('id-ID') + " PCS";
                    outEl.className = "fw-bold text-danger font-monospace";
                    outEl.style.fontSize = "1.5rem";

                    const tgtElA = document.getElementById('tgt_' + mObj.id);
                    tgtElA.innerText = (machineData.target_range > 0)
                        ? Number(machineData.target_range).toLocaleString('id-ID') + " PCS"
                        : '--';

                    const values = machineData.values;
                    const lastSpeed = values.length > 0 ? Math.round(values[values.length - 1]) : 0;
                    
                    document.getElementById('val_' + mObj.id).innerText = lastSpeed;

                    const status = document.getElementById('status_' + mObj.id);
                    const isStoppedAnalysis = lastSpeed <= STOP_SPEED_THRESHOLD;
                    status.innerText = isStoppedAnalysis ? "○ STOPPED" : "● RUNNING";
                    status.className = "status-pill badge rounded-pill px-3 py-2 " + (isStoppedAnalysis ? "bg-warning text-dark" : "bg-success text-white");

                    const chartBg = document.getElementById('chart_bg_' + mObj.id);
                    if (isStoppedAnalysis) {
                        chartBg.classList.add('chart-off-bg', 'chart-off-border');
                    } else {
                        chartBg.classList.remove('chart-off-bg', 'chart-off-border');
                    }

                    const stopEl = document.getElementById('stop_' + mObj.id);
                    if (machineData.stop_events) {
                        const se = machineData.stop_events;
                        const lastStop = se ? se.last_stop : null;
                        if (lastStop) {
                            const ongoing = lastStop.end === null;
                            const dur = lastStop.duration + " menit" + (ongoing ? " (sedang berlangsung)" : "");
                            stopEl.innerText = "🛑 STOP: " + lastStop.start + " (" + dur + ") | Count: " + se.count + "x";
                            stopEl.style.display = "inline-block";
                        } else {
                            stopEl.style.display = "none";
                        }
                    } else {
                        stopEl.style.display = "none";
                    }

                    updateDowntimePanel(mObj.id, machineData.stop_events);
                }
            });
        })
        .catch(err => {
            console.error("Fetch Error:", err);
            document.getElementById('offline-banner').style.display = 'block';
        });
}

function resetAnalysis() {
    document.querySelectorAll('.machine-chk').forEach(cb => { cb.checked = true; });
    document.getElementById('chkAll').checked = true;
    const filterEl = document.getElementById('filterHours');
    filterEl.disabled = false;
    filterEl.closest('#realtime-filter').style.opacity = '1';
    isAnalysisMode = false;
    location.reload();
}

function updateData() {
    if (isAnalysisMode) return;
    const hrs = document.getElementById('filterHours').value;

    // Build URL: tanpa 'hours' = shift scope, dengan 'hours' = fixed range
    const url = hrs === ''
        ? `data.php?t=${Date.now()}`
        : `data.php?hours=${hrs}&t=${Date.now()}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            document.getElementById('offline-banner').style.display = 'none';
            const isShiftScope = data.mode === 'shift_scope';

            // Tampilkan badge shift info di header
            const badge = document.getElementById('shift-info-badge');
            if (isShiftScope && data.shift_info) {
                badge.style.display = 'inline-flex';
                badge.innerText = `${data.shift_info.shift_name} | ${data.shift_info.elapsed_min}/${data.shift_info.total_min} min`;
            } else {
                badge.style.display = 'none';
            }

            machines.forEach(m => {
                const mId = m.id;
                const mName = m.name;
                const mClean = mName.replace(/\s+/g, '');

                // Sembunyikan card mesin yang tidak dicentang (kecuali jika TV mode sedang memegang kendali)
                const chk = document.getElementById('chk' + mId);
                const col = document.getElementById('col_' + mId);
                
                if (tvModeActive) {
                    if (mName !== tvMachines[tvSlideIndex]) { col.style.display = 'none'; }
                    else { col.style.display = 'block'; }
                } else {
                    if (chk && !chk.checked) { col.style.display = 'none'; return; }
                    col.style.display = 'block';
                }

                const latest = data.latest_speed ? data.latest_speed.find(i => i.device_id === mName) : null;
                const ppmVal = latest ? Math.round(latest.speed) : 0;
                document.getElementById('val_' + mId).innerText = ppmVal;

                // Sinkron dengan engine downtime: highlight hanya saat benar-benar stop.
                const chartBg = document.getElementById('chart_bg_' + mId);
                const isStoppedRealtime = ppmVal <= STOP_SPEED_THRESHOLD;
                if (isStoppedRealtime) {
                    chartBg.classList.add('chart-off-bg', 'chart-off-border');
                } else {
                    chartBg.classList.remove('chart-off-bg', 'chart-off-border');
                }

                const mHistory = data.speed ? data.speed.filter(i => i.device_id === mName) : [];

                if (charts[mName]) {
                    // Langsung pakai data per-menit tanpa mapping ke grid
                    charts[mName].data.labels = mHistory.map(i => i.jam_label);
                    charts[mName].data.datasets[0].data = mHistory.map(i => i.speed);
                    charts[mName].update('none');
                }

                const set = data.settings ? data.settings.find(s => s.dev_clean === mClean) : null;
                document.getElementById('sku_' + mId).innerText = "SKU: " + (set?.current_variant || '--');

                const outEl = document.getElementById('out_' + mId);
                const tgtEl = document.getElementById('tgt_' + mId);
                const labelOut = document.querySelector(`#col_${mId} .p-3.bg-light span:first-child`);

                if (isShiftScope) {
                    // MODE B: output kumulatif shift aktif, target full 8 jam
                    const rt = data.realtime_output ? data.realtime_output.find(o => o.device_id === mName) : null;
                    outEl.innerText = (rt ? parseInt(rt.output) : 0).toLocaleString('id-ID');
                    labelOut.innerText = data.shift_info
                        ? `${data.shift_info.shift_name} (${data.shift_info.elapsed_min}/${data.shift_info.total_min}min)`
                        : "Output";

                    const st = data.shift_targets ? data.shift_targets.find(t => t.device_id === mName) : null;
                    tgtEl.innerText = st ? Number(st.target_total).toLocaleString('id-ID') + " PCS" : '--';
                } else {
                    // MODE C: selalu audit delta, target proporsional (hours/8 × target_shift)
                    const aud = data.audit_output ? data.audit_output.find(o => o.device_id === mName) : null;
                    outEl.innerText = (aud ? parseInt(aud.total_range) : 0).toLocaleString('id-ID');
                    labelOut.innerText = (data.hours_requested || hrs) + " Jam Output";

                    const set = data.settings ? data.settings.find(s => s.dev_clean === mClean) : null;
                    tgtEl.innerText = (set && set.target_range > 0)
                        ? Number(set.target_range).toLocaleString('id-ID') + " PCS"
                        : '--';
                }

                const status = document.getElementById('status_' + mId);
                status.innerText = isStoppedRealtime ? "○ STOPPED" : "● RUNNING";
                status.className = "status-pill badge rounded-pill px-3 py-2 " + (isStoppedRealtime ? "bg-warning text-dark" : "bg-success text-white");

                const stopEl = document.getElementById('stop_' + mId);
                if (data.stop_events) {
                    const se = data.stop_events[mName];
                    const lastStop = se ? se.last_stop : null;
                    if (lastStop) {
                        const ongoing = lastStop.end === null;
                        const dur = lastStop.duration + " menit" + (ongoing ? " (sedang berlangsung)" : "");
                        stopEl.innerText = "🛑 STOP: " + lastStop.start + " (" + dur + ") | Count: " + se.count + "x";
                        stopEl.style.display = "inline-block";
                    } else if (se && se.count > 0) {
                        // ada stop tapi last_stop = null — seharusnya tidak terjadi
                        stopEl.style.display = "none";
                    } else {
                        stopEl.style.display = "none";
                    }
                } else {
                    stopEl.style.display = "none";
                }

                updateDowntimePanel(mId, data.stop_events ? data.stop_events[mName] : null);
            });
        })
        .catch(err => {
            console.error("Fetch Error:", err);
            document.getElementById('offline-banner').style.display = 'block';
        });
}
setInterval(updateData, 30000);
updateData();

// --- TV MODE LOGIC ---
function toggleTVMode() {
    if (tvModeActive) { exitTVMode(); return; }
    
    // Aktifkan TV Mode
    tvMachines = Array.from(document.querySelectorAll('.machine-chk:checked')).map(cb => cb.value);
    if (tvMachines.length === 0) { alert("Pilih minimal 1 mesin untuk masuk ke TV Mode!"); return; }

    tvModeActive = true;
    tvPaused = false;
    tvSlideIndex = 0;
    
    document.body.classList.add('tv-mode-active');
    document.querySelector('.analytics-section').style.display = 'none';
    document.getElementById('realtime-filter').style.display = 'none';
    document.getElementById('tv-controls').style.display = 'flex';
    document.getElementById('btnTVPause').innerHTML = '<i class="fas fa-pause"></i>';
    
    renderTVSlide();
    
    tvTimer = setInterval(() => {
        if (!tvPaused) nextTVSlide();
    }, 10000);
}

function exitTVMode() {
    tvModeActive = false;
    clearInterval(tvTimer);
    document.body.classList.remove('tv-mode-active');
    document.querySelector('.analytics-section').style.display = 'block';
    document.getElementById('realtime-filter').style.display = 'flex';
    document.getElementById('tv-controls').style.display = 'none';
    
    machines.forEach(m => {
        const chartBg = document.getElementById('chart_bg_' + m.id);
        if (chartBg) chartBg.style.height = '250px';
        
        if (charts[m.name]) {
            charts[m.name].options.scales.x.ticks.font.size = 16;
            charts[m.name].options.scales.y.ticks.font.size = 16;
            charts[m.name].data.datasets[0].borderWidth = 2;
            charts[m.name].update('none');
        }
    });
    
    onMachineToggle(); // restore grid
}

function renderTVSlide() {
    if (!tvModeActive) return;
    const currentM = tvMachines[tvSlideIndex];
    document.getElementById('tv-indicator').innerText = `SHOWING: ${currentM} (${tvSlideIndex + 1}/${tvMachines.length})`;
    
    machines.forEach(m => {
        const col = document.getElementById('col_' + m.id);
        const chartBg = document.getElementById('chart_bg_' + m.id);
        if (m.name === currentM) {
            col.style.display = 'block';
            col.className = 'col-xl-12 mb-4 machine-card';
            if (chartBg) chartBg.style.height = '60vh';
            
            if (charts[m.name]) {
                charts[m.name].options.scales.x.ticks.font.size = 30;
                charts[m.name].options.scales.y.ticks.font.size = 30;
                charts[m.name].data.datasets[0].borderWidth = 8;
                charts[m.name].update('none');
            }
        } else {
            col.style.display = 'none';
        }
    });
}

function nextTVSlide() {
    if (tvMachines.length === 0) return;
    tvSlideIndex = (tvSlideIndex + 1) % tvMachines.length;
    renderTVSlide();
}

function prevTVSlide() {
    if (tvMachines.length === 0) return;
    tvSlideIndex = (tvSlideIndex - 1 + tvMachines.length) % tvMachines.length;
    renderTVSlide();
}

function toggleTVPause() {
    tvPaused = !tvPaused;
    const btn = document.getElementById('btnTVPause');
    if (tvPaused) {
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.style.color = '#e74c3c';
    } else {
        btn.innerHTML = '<i class="fas fa-pause"></i>';
        btn.style.color = 'white';
    }
}

document.addEventListener('keydown', (e) => {
    if (!tvModeActive) return;
    if (e.key === 'ArrowRight') { nextTVSlide(); }
    else if (e.key === 'ArrowLeft') { prevTVSlide(); }
    else if (e.key === ' ') { e.preventDefault(); toggleTVPause(); }
    else if (e.key === 'Escape') { exitTVMode(); }
});
</script>
<?php include 'footer.php'; ?>
