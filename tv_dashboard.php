<?php
error_reporting(0);
include 'header.php';

// config.php sudah di-include oleh header.php — tidak perlu duplikat 

// 1. Ambil Settingan SKU Aktif dari history terbaru
$query_settings = "
    SELECT DISTINCT ON (device_id) device_id, sku_new as current_variant 
    FROM sku_history 
    WHERE changed_at <= NOW()
    ORDER BY device_id, changed_at DESC, ctid DESC";
$stmtSet = $pdo->query($query_settings);
$settings = [];
while($s = $stmtSet->fetch()){
    $cleanId = strtoupper(str_replace(' ', '', $s['device_id']));
    $settings[$cleanId] = strtoupper(str_replace(' ', '', $s['current_variant']));
}

// getShiftData() sudah ada di functions.php (via header.php) — tidak perlu diduplikat di sini.

$current = getShiftData($pdo, 'current_shift');
$last1   = getShiftData($pdo, 'last_shift');
$last2   = getShiftData($pdo, 'last_2shift');
$last3   = getShiftData($pdo, 'last_3shift');
$lastDay = getShiftData($pdo, 'total_lastday');

$machines = ['BHP 1', 'BHP 2', 'BHP 3', 'BHP 4', 'BHP 5', 'AHP 1'];

// Fungsi Render Badge OEE
function showOEEBadge($output, $deviceId, $settings) {
    $cleanId = strtoupper(str_replace(' ', '', $deviceId));
    $variant = $settings[$cleanId] ?? "";

    if ($variant === "") {
        return '<br><span class="oee-mini-badge oee-low">SKU BELUM SET</span>';
    }

    $oee = getOEEPercentage($output, $deviceId, $variant);

    if ($oee < 0) {
        return '<br><span class="oee-mini-badge oee-low">SKU INVALID</span>';
    }

    $class = ($oee >= 82) ? 'oee-good' : ($oee >= 50 ? 'oee-warn' : 'oee-low');
    return '<br><span class="oee-mini-badge '.$class.'">'.$oee.'% OEE</span>';
}

$totalBhpLast = 0; $totalAhpLast = 0;
foreach($lastDay as $k => $v) {
    if(strpos($k, 'BHP') !== false) $totalBhpLast += $v;
    if(strpos($k, 'AHP') !== false) $totalAhpLast += $v;
}
?>

<script src="https://cdn.rawgit.com/Mikhus/canvas-gauges/master/gauge.min.js"></script>

<style>
    /* TV SETUP */
    .main-header, .navbar, .main-sidebar, .sidebar { display: none !important; }
    .content-wrapper, .main-content { margin-left: 0 !important; padding-top: 0 !important; margin-top: 0 !important; }
    body { background-color: #f1f5f9; overflow-y: auto !important; padding-bottom: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }

    /* HEADER STYLE WITH LOGO */
    .tv-command-header { 
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
        color: white; padding: 15px 40px; border-bottom: 5px solid #ffd600; 
        box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 25px;
        position: relative; overflow: hidden; display: flex;
        justify-content: space-between; align-items: center;
    }
    .header-left-box { display: flex; align-items: center; gap: 25px; }
    
    /* Box Logo Perusahaan */
    .company-logo-container {
        background: white; 
        padding: 8px; 
        border-radius: 15px; 
        display: flex; 
        align-items: center; 
        justify-content: center;
        box-shadow: 0 0 20px rgba(255,255,255,0.1);
        border: 2px solid rgba(255,255,255,0.2);
    }
    .company-logo-container img {
        height: 65px; /* Atur tinggi logo lu di sini */
        width: auto;
        object-fit: contain;
    }

    .title-text-group h2 { 
        font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin: 0; 
        font-size: 2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .header-subtitle-industrial { 
        color: #ffd600; font-weight: 700; font-size: 0.95rem; text-transform: uppercase; 
        letter-spacing: 4px; display: flex; align-items: center; gap: 10px; margin-top: 2px;
    }
    .header-info-badge {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        padding: 10px 25px; border-radius: 20px; backdrop-filter: blur(5px);
        display: flex; flex-direction: column; align-items: flex-end;
    }

    /* CARDS */
    .card-tv { border-radius: 20px; border: none; box-shadow: 0 8px 20px rgba(0,0,0,0.05); background: white; }
    .gauge-card { padding: 10px; text-align: center; border: 2px solid transparent; min-height: 230px; }
    .gauge-container { width: 150px; height: 150px; margin: 0 auto; }
    
    .current-out-display { font-family: 'Segoe UI', sans-serif; font-size: 1.6rem; font-weight: 900; color: #0984e3; margin-top: -10px; }
    .sku-tv-badge { font-size: 0.7rem; background: #f8f9fa; color: #2d3436; padding: 3px 10px; border-radius: 6px; border: 1px solid #dcdde1; font-weight: 800; }

    .card-gradient-blue { background: linear-gradient(90deg, #1e40af 0%, #0ea5e9 100%); color: white; border-radius: 20px; }
    .v-line { border-left: 1px solid rgba(255,255,255,0.3); height: 50px; margin: 0 25px; }

    .oee-mini-badge { font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; text-transform: uppercase; }
    .oee-good { background: #dcfce7; color: #15803d; border: 1px solid #15803d; }
    .oee-warn { background: #fef9c3; color: #a16207; border: 1px solid #a16207; }
    .oee-low { background: #fee2e2; color: #b91c1c; border: 1px solid #b91c1c; }

    .status-alert { font-size: 0.8rem; font-weight: 900; padding: 8px; border-radius: 8px; text-transform: uppercase; display: block; width: 100%; }
    .status-running { background: #10b981; color: white; }
    .status-stopped { background: #ef4444; color: white; animation: blinker 1s linear infinite; }
    @keyframes blinker { 50% { opacity: 0.6; } }

    @keyframes fast-blink { 0% { background: #fff; } 50% { background: #fff1f2; border-color: #f87171; } 100% { background: #fff; } }
    .machine-stop { animation: fast-blink 1.2s infinite !important; border: 2px solid #e74c3c !important; }
    .tv-footer-text { padding: 15px 0; color: #64748b; font-size: 0.85rem; text-align: center; }
</style>

<div id="offline-banner" class="alert alert-danger text-center shadow-sm fw-bold m-0" style="display:none; position:fixed; top:0; left:0; width:100%; z-index:9999; border-radius:0;">
    <i class="fas fa-exclamation-triangle me-2"></i> KONEKSI TERPUTUS - Mencoba menyambung kembali...
</div>
<div class="tv-command-header">
    <div class="header-left-box">
        <div class="company-logo-container">
            <img src="img/logo1.png" alt="Company Logo" onerror="this.src='https://via.placeholder.com/150x65?text=YOUR+LOGO'">
        </div>
        
        <div class="title-text-group">
            <h2>MACHINE MONITORING <span style="font-weight: 200; opacity: 0.7;">SYSTEM</span></h2>
            <div class="header-subtitle-industrial">
                PT DAYA ANUGRAH MULYA (WINGS GROUP)
            </div>
        </div>
    </div>
    <div class="header-info-badge">
        <span style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Real-time Status</span>
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #2ecc71; font-weight: 800; font-size: 1.1rem;">● SYSTEM ONLINE</span>
            <div id="clock" style="color: white; font-weight: 800; font-size: 1.1rem; margin-left: 15px; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 15px;">00:00:00</div>
        </div>
    </div>
</div>

<div class="container-fluid px-4">
    <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-6 g-3 mb-3">
        <?php foreach($machines as $m): $safeName = str_replace(' ', '-', $m); ?>
        <div class="col">
            <div id="card-gauge-<?= $safeName ?>" class="card card-tv gauge-card shadow-sm">
                <div class="fw-bold text-muted text-uppercase mb-1" style="font-size: 0.75rem; letter-spacing: 1px;"><?= $m ?></div>
                <div class="gauge-container">
                    <canvas id="gauge-<?= $safeName ?>"></canvas>
                </div>
                <div class="current-out-display" id="val-current-<?= $safeName ?>">0</div>
                <div><span id="sku-text-<?= $safeName ?>" class="sku-tv-badge">SKU: <?= $settings[strtoupper(str_replace(' ', '', $m))] ?? '--' ?></span></div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <div class="row g-3 mb-3">
        <div class="col-md-6">
            <div class="card card-gradient-blue shadow-sm h-100 d-flex align-items-center p-3">
                <div class="d-flex align-items-center text-start w-100">
                    <div class="flex-grow-1 ps-3">
                        <small class="text-uppercase fw-bold opacity-75" style="font-size: 0.7rem;">BHP Group Current</small>
                        <h1 class="fw-bold mb-0" id="total-bhp">0 <small style="font-size: 1.2rem;">PCS</small></h1>
                    </div>
                    <div class="v-line"></div>
                    <div class="flex-grow-1">
                        <small class="text-uppercase fw-bold opacity-75">AHP 1 Current</small>
                        <h1 class="fw-bold mb-0 text-info" id="total-ahp">0 <small style="font-size: 1.2rem;">PCS</small></h1>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card card-tv h-100 p-3 border-start border-warning border-5 shadow-sm text-center">
                <small class="text-uppercase fw-bold text-muted d-block mb-1">BHP Total Last Day</small>
                <h2 class="fw-bold text-dark mb-0"><?= number_format($totalBhpLast, 0, ',', '.') ?></h2>
                <small class="text-muted" style="font-size: 0.7rem;">Yesterday Output</small>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card card-tv h-100 p-3 border-start border-success border-5 shadow-sm text-center">
                <small class="text-uppercase fw-bold text-muted d-block mb-1">AHP Total Last Day</small>
                <h2 class="fw-bold text-dark mb-0"><?= number_format($totalAhpLast, 0, ',', '.') ?></h2>
                <small class="text-muted" style="font-size: 0.7rem;">Yesterday Output</small>
            </div>
        </div>
    </div>

    <div class="card card-tv overflow-hidden shadow-sm mb-3">
        <div class="card-header bg-dark text-white py-2 d-flex justify-content-between">
            <h6 class="m-0 fw-bold" style="font-size: 0.9rem;">PRODUCTION PERFORMANCE HISTORY</h6>
            <div class="fw-bold small text-warning">UTILIZATION: <span id="util-count">0 / 6</span></div>
        </div>
        <table class="table table-hover align-middle mb-0 text-center">
            <thead class="table-light text-uppercase" style="font-size: 0.75rem;">
                <tr>
                    <th class="ps-4 py-2 text-start">Machine & SKU</th>
                    <th style="width: 20%;">Live Status</th>
                    <th>Last Shift</th>
                    <th>Last 2 Shifts</th>
                    <th>Last 3 Shifts</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($machines as $m): $mClean = strtoupper(str_replace(' ', '', $m)); ?>
                <tr>
                    <td class="ps-4 text-start">
                        <div class="fw-bold text-dark"><?= $m ?></div>
                        <small class="text-muted" style="font-size: 0.75rem;">Active SKU: <?= $settings[$mClean] ?? 'N/A' ?></small>
                    </td>
                    <td><span id="status-badge-<?= $mClean ?>" class="status-alert status-stopped">Checking...</span></td>
                    <td><?= number_format($last1[$mClean] ?? 0, 0, ',', '.') ?><?= showOEEBadge($last1[$mClean] ?? 0, $m, $settings) ?></td>
                    <td><?= number_format($last2[$mClean] ?? 0, 0, ',', '.') ?><?= showOEEBadge($last2[$mClean] ?? 0, $m, $settings) ?></td>
                    <td><?= number_format($last3[$mClean] ?? 0, 0, ',', '.') ?><?= showOEEBadge($last3[$mClean] ?? 0, $m, $settings) ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <div class="tv-footer-text">
        © 2026 Department Engineering PT Daya Anugrah Mulya (Wings Group)
    </div>
</div>

<script>
const machineGauges = {};
const machineNames = ['BHP 1', 'BHP 2', 'BHP 3', 'BHP 4', 'BHP 5', 'AHP 1'];

function init() {
    machineNames.forEach(name => {
        const isAHP = name.includes('AHP');
        const safeId = name.replace(/\s+/g, '-');
        let maxV = isAHP ? 300 : (name === 'BHP 4' || name === 'BHP 5' ? 800 : 500);
        let ticks = isAHP ? ["0", "100", "200", "300"] : (name === 'BHP 4' || name === 'BHP 5' ? ["0", "200", "400", "600", "800"] : ["0", "100", "200", "300", "400", "500"]);

        machineGauges[name] = new RadialGauge({
            renderTo: `gauge-${safeId}`,
            width: 150, height: 150, minValue: 0, maxValue: maxV, majorTicks: ticks,
            highlights: [{from: 0, to: maxV*0.2, color: '#ff4d4d'}, {from: maxV*0.2, to: maxV*0.7, color: '#ffcc00'}, {from: maxV*0.7, to: maxV, color: '#2ecc71'}],
            colorPlate: "transparent", borders: false, needleType: "arrow", needleWidth: 3, animationDuration: 1500,
            valueBox: true, colorValueBoxBackground: "rgba(0,0,0,0)", colorValueBoxRect: "rgba(0,0,0,0)",
            colorValueBoxRectEnd: "rgba(0,0,0,0)", colorValueBoxShadow: false, borderValueBoxWeight: 0,
            valueInt: 1, valueDec: 0, fontValueSize: 50, fontValueWeight: "900", units: "PPM", colorValueText: "#2d3436"
        }).draw();
    });
    refresh();
    setInterval(refresh, 5000);
    setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleTimeString('id-ID'); }, 1000);
}

function refresh() {
    fetch('data.php?t=' + Date.now()).then(res => res.json()).then(data => {
        document.getElementById('offline-banner').style.display = 'none';
        let runningCount = 0; let bhpTotal = 0; let ahpTotal = 0;
        
        machineNames.forEach(name => {
            const mClean = name.replace(/\s+/g, '').toUpperCase();
            const safeId = name.replace(/\s+/g, '-');
            const mLatest = data.latest_speed?.find(i => i.device_id === name);
            const speed = mLatest ? Math.round(mLatest.speed) : 0;
            const mOut = data.realtime_output?.find(i => i.device_id === name);
            const output = mOut ? parseInt(mOut.output) : 0;
            const mSetting = data.settings?.find(s => s.device_id === name || s.dev_clean === mClean);

            let maxV = (name === 'BHP 4' || name === 'BHP 5') ? 800 : (name.includes('AHP') ? 300 : 500);
            let colorVal = speed < (maxV * 0.2) ? "#ff4d4d" : (speed < (maxV * 0.7) ? "#ffcc00" : "#2ecc71");

            machineGauges[name].value = speed;
            machineGauges[name].update({ colorValueText: colorVal, colorValueBoxBackground: "rgba(0,0,0,0)", colorValueBoxRect: "rgba(0,0,0,0)" });

            const card = document.getElementById(`card-gauge-${safeId}`);
            const badge = document.getElementById(`status-badge-${mClean}`);

            if(speed > 5) {
                runningCount++;
                card.classList.remove('machine-stop');
                badge.innerText = "● RUNNING";
                badge.className = "status-alert status-running";
            } else {
                card.classList.add('machine-stop');
                badge.innerText = "○ STOPPED";
                badge.className = "status-alert status-stopped";
            }

            if(name.includes('AHP')) ahpTotal += output; else bhpTotal += output;
            document.getElementById(`val-current-${safeId}`).innerText = output.toLocaleString('id-ID');
            const skuEl = document.getElementById(`sku-text-${safeId}`);
            if(skuEl) skuEl.innerText = "SKU: " + (mSetting?.current_variant || '--');
        });

        document.getElementById('total-bhp').innerHTML = bhpTotal.toLocaleString('id-ID') + ' <small style="font-size: 1.2rem;">PCS</small>';
        document.getElementById('total-ahp').innerHTML = ahpTotal.toLocaleString('id-ID') + ' <small style="font-size: 1.2rem;">PCS</small>';
        document.getElementById('util-count').innerText = runningCount;
    })
    .catch(err => {
        console.error("Fetch Error:", err);
        document.getElementById('offline-banner').style.display = 'block';
    });
}
document.addEventListener('DOMContentLoaded', init);
</script>

