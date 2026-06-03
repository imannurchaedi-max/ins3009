<?php include 'header.php'; ?>

<script src="https://cdn.rawgit.com/Mikhus/canvas-gauges/master/gauge.min.js"></script>

<style>
    .bg-danger { background-color: #ff4d4d !important; }
    .bg-warning { background-color: #ffcc00 !important; }
    .bg-success { background-color: #2ecc71 !important; }
    .progress-industrial { height: 14px; background: #edf2f7 !important; border-radius: 10px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1); }
    .progress-bar { height: 100%; border-radius: 10px; transition: width 0.8s ease; }
    .card-utilization { background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important; color: white !important; }
    .card-production { background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%) !important; border-left: 5px solid #3498db !important; }
    .card-network { background: linear-gradient(135deg, #ffffff 0%, #f0fff4 100%) !important; border-left: 5px solid #2ecc71 !important; }
    .card-industrial { border: 1px solid rgba(0,0,0,0.05); transition: all 0.3s ease; }
    .machine-badge { padding: 5px 12px; border-radius: 6px; font-size: 0.7rem; letter-spacing: 1px; }
    .sku-label { font-size: 0.65rem; letter-spacing: 0.5px; font-weight: 800; padding: 3px 8px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; color: #495057; display: inline-block; }
    
    /* STYLE SKU KHUSUS DI BAWAH GAUGE */
    .gauge-sku-box { margin-top: -10px; margin-bottom: 10px; }
    .gauge-sku-badge { font-size: 0.7rem; font-weight: 900; color: #636e72; background: #f1f2f6; padding: 2px 10px; border-radius: 100px; border: 1px solid #dfe6e9; text-transform: uppercase; }

    @keyframes gauge-alert-flash { 0% { background-color: #fff; } 50% { background-color: rgba(231, 76, 60, 0.1); border-color: #e74c3c; } 100% { background-color: #fff; } }
    .gauge-card { background: #fff; border-radius: 15px; padding: 15px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 2px solid #edf2f7; transition: all 0.3s ease; }
    .gauge-card-alert { animation: gauge-alert-flash 1s infinite !important; }
    .gauge-container { width: 150px; height: 150px; margin: 0 auto; }
</style>

<div class="container-fluid px-4 py-3">
    <div id="offline-banner" class="alert alert-danger text-center shadow-sm fw-bold" style="display:none; position:fixed; top:0; left:0; width:100%; z-index:9999; border-radius:0; margin:0;">
        <i class="fas fa-exclamation-triangle me-2"></i> KONEKSI TERPUTUS - Mencoba menyambung kembali...
    </div>
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h5 class="fw-bold m-0 text-dark">Factory Real-Time Monitoring</h5>
            <small class="text-muted">Plant: PT DAM - Area: Engineering Monitoring</small>
        </div>
        <div id="last-update-time" class="badge bg-white text-dark border p-2 shadow-sm">Live Refresh: --:--:--</div>
    </div>

    <div class="row g-4 mb-4">
        <div class="col-md-4">
            <div class="card h-100 card-industrial border-0 rounded-4 p-4 shadow-sm card-utilization">
                <small class="text-uppercase fw-bold text-info">Machine Utilization</small>
                <h2 class="fw-bold mb-1" id="total-running">0 / 6</h2>
                <div class="progress-industrial mt-3"><div id="utilization-bar" class="progress-bar bg-info" style="width: 0%"></div></div>
                <small class="mt-3 d-block text-white-50" id="utilization-percent">0% capacity active</small>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100 card-industrial border-0 rounded-4 p-4 shadow-sm card-production">
                <small class="text-uppercase fw-bold text-muted">Production Output (Shift)</small>
                <div class="row g-0 mt-3">
                    <div class="col-6 border-end"><small class="text-muted d-block">BHP GROUP</small><h3 class="fw-bold mb-0 text-primary" id="output-bhp">0</h3></div>
                    <div class="col-6 ps-4"><small class="text-muted d-block">AHP 1 ONLY</small><h3 class="fw-bold mb-0 text-success" id="output-ahp">0</h3></div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100 card-industrial border-0 rounded-4 p-4 shadow-sm card-network">
                <small class="text-uppercase fw-bold text-muted">Network & Server</small>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <h3 class="fw-bold text-success mb-0">ONLINE</h3>
                    <div class="status-indicator-online"><div class="pulse-green"></div></div>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-3 mb-4 text-center">
        <?php 
        $mNames = ['BHP 1', 'BHP 2', 'BHP 3', 'BHP 4', 'BHP 5', 'AHP 1'];
        foreach($mNames as $name): 
            $safeName = str_replace(' ', '-', $name);
        ?>
        <div class="col-md">
            <div id="card-gauge-<?= $safeName ?>" class="gauge-card card-industrial">
                <small class="fw-bold text-muted text-uppercase" style="font-size: 0.65rem; letter-spacing: 1px;"><?= $name ?></small>
                <div class="gauge-container"><canvas id="gauge-<?= $safeName ?>"></canvas></div>
                <div class="gauge-sku-box">
                    <span id="gauge-sku-text-<?= $safeName ?>" class="gauge-sku-badge">SKU: --</span>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <div class="row">
        <div class="col-12">
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div class="card-header bg-white py-3 border-bottom"><h6 class="m-0 fw-bold">Live Machine Status Summary</h6></div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table align-middle mb-0 text-center">
                            <thead class="table-light">
                                <tr>
                                    <th class="ps-4 text-start">Machine ID & SKU</th>
                                    <th>Status Mode</th>
                                    <th>Output Accuracy</th>
                                    <th style="width: 300px;">Performance (Dynamic OEE)</th>
                                </tr>
                            </thead>
                            <tbody id="summary-table"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
const machineGauges = {};

function updateDashboard() {
    fetch('data.php?t=' + Date.now())
    .then(res => res.json())
    .then(data => {
        if (!data || data.error) return;

        const machineNames = ['BHP 1', 'BHP 2', 'BHP 3', 'BHP 4', 'BHP 5', 'AHP 1'];
        let bhpTotal = 0; let ahpTotal = 0; let runningCount = 0;
        const tableBody = document.getElementById('summary-table');

        machineNames.forEach(name => {
            const mLatest = data.latest_speed ? data.latest_speed.find(i => i.device_id === name) : null;
            const speed = mLatest ? Math.round(mLatest.speed) : 0;
            const mOut = data.realtime_output ? data.realtime_output.find(i => i.device_id === name) : null;
            const output = mOut ? parseInt(mOut.output) : 0;
            
            const mNameClean = name.replace(/\s+/g, ''); 
            const setting = data.settings ? data.settings.find(s => s.device_id === name || s.dev_clean === mNameClean) : null;

            const isAHP = name.includes('AHP');
            const isHighSpeed = (name === 'BHP 4' || name === 'BHP 5');
            
            let rawVariant = setting ? setting.current_variant : null;
            let cleanVariant = rawVariant ? rawVariant.replace(/\s+/g, '') : 'N/A';

            let currentTarget = setting && setting.target_output ? parseInt(setting.target_output) : -1;

            let oee = 0;
            let barColorClass = 'bg-danger';
            let oeeText = '0%';
            let isValidTarget = currentTarget > 0;

            if (isValidTarget) {
                oee = Math.min(Math.round((output / currentTarget) * 100), 100);
                barColorClass = oee > 80 ? 'bg-success' : (oee > 50 ? 'bg-warning' : 'bg-danger');
                oeeText = oee + '%';
            } else {
                oeeText = 'SKU INVALID';
                barColorClass = 'bg-secondary';
            }

            const isStopped = speed <= 5;

            if (isAHP) ahpTotal += output; else bhpTotal += output;
            if(!isStopped) runningCount++;

            const displayV = rawVariant ? rawVariant.replace(/([A-Z])(\d+)/g, '$1 $2') : 'N/A'; 
            const safeId = name.replace(/\s+/g, '-');
            const canvasId = `gauge-${safeId}`;

            // UPDATE SKU DI BAWAH GAUGE
            const gaugeSkuEl = document.getElementById(`gauge-sku-text-${safeId}`);
            if(gaugeSkuEl) gaugeSkuEl.innerText = "SKU: " + displayV;

            if (!machineGauges[name]) {
                let maxVal = 500;
                let ticks = ["0", "100", "200", "300", "400", "500"];
                let hlights = [{ from: 0, to: 100, color: '#ff4d4d' }, { from: 100, to: 350, color: '#ffcc00' }, { from: 350, to: 500, color: '#2ecc71' }];

                if (isAHP) {
                    maxVal = 300; ticks = ["0", "50", "100", "150", "200", "250", "300"];
                    hlights = [{ from: 0, to: 50, color: '#ff4d4d' }, { from: 50, to: 200, color: '#ffcc00' }, { from: 200, to: 300, color: '#2ecc71' }];
                } else if (isHighSpeed) {
                    maxVal = 800; ticks = ["0", "200", "400", "600", "800"];
                    hlights = [{ from: 0, to: 200, color: '#ff4d4d' }, { from: 200, to: 500, color: '#ffcc00' }, { from: 500, to: 800, color: '#2ecc71' }];
                }

                machineGauges[name] = new RadialGauge({
                    renderTo: canvasId,
                    width: 150, height: 150, minValue: 0, maxValue: maxVal, majorTicks: ticks, highlights: hlights,
                    colorPlate: "transparent", borders: false, needleType: "arrow", needleWidth: 4, animationDuration: 1000,
                    valueBox: true, colorValueBoxRect: "rgba(0,0,0,0)", colorValueBoxRectEnd: "rgba(0,0,0,0)",
                    colorValueBoxBackground: "rgba(0,0,0,0)", colorValueBoxShadow: false, borderValueBoxWeight: 0,
                    fontValueSize: 70, fontValueWeight: "900", colorValueText: "#2d3436", fontUnitsSize: 22, units: "PPM", valueInt: 1, valueDec: 0
                }).draw();
            }

            machineGauges[name].value = speed;
            let redLimit = isHighSpeed ? 200 : (isAHP ? 50 : 100);
            let greenLimit = isHighSpeed ? 500 : (isAHP ? 200 : 350);
            let speedColor = speed < redLimit ? "#ff4d4d" : (speed >= greenLimit ? "#2ecc71" : "#ffcc00");
            machineGauges[name].update({ colorValueText: speedColor, colorValueBoxBackground: "rgba(0,0,0,0)" });

            const gaugeCard = document.getElementById(`card-gauge-${safeId}`);
            if (isStopped) gaugeCard.classList.add('gauge-card-alert');
            else gaugeCard.classList.remove('gauge-card-alert');

            let row = document.getElementById(`row-${safeId}`);
            if (!row) {
                tableBody.insertAdjacentHTML('beforeend', `<tr id="row-${safeId}"><td class="ps-4 text-start"><div class="d-flex align-items-center"><div class="p-2 bg-light rounded-3 me-3 text-primary fw-bold" style="font-size: 0.7rem;">MCH</div><div><h6 class="mb-0 fw-bold" style="font-size: 0.9rem;">${name}</h6><div class="mt-1"><span class="sku-label" id="sku-label-${safeId}">SKU: --</span></div></div></div></td><td id="status-cell-${safeId}"></td><td id="output-cell-${safeId}"></td><td id="oee-cell-${safeId}"></td></tr>`);
            }
            document.getElementById(`sku-label-${safeId}`).innerText = "SKU: " + rawVariant;
            document.getElementById(`status-cell-${safeId}`).innerHTML = `<span class="machine-badge fw-bold ${!isStopped ? 'bg-success text-white' : 'bg-danger text-white'}">${!isStopped ? '● PRODUCTION' : '○ ALERT: STOPPED'}</span>`;
            let tgtText = isValidTarget ? (currentTarget/1000) + 'K' : 'N/A';
            document.getElementById(`output-cell-${safeId}`).innerHTML = `<span class="fw-bold">${output.toLocaleString('id-ID')}</span> <small class="text-muted">/ ${tgtText}</small>`;
            
            document.getElementById(`oee-cell-${safeId}`).innerHTML = `<div class="d-flex align-items-center px-3"><div class="flex-grow-1"><div class="progress-industrial"><div class="progress-bar ${barColorClass}" style="width: ${isValidTarget ? oee : 100}%;"></div></div></div><span class="ms-3 fw-bold" style="font-size: ${isValidTarget ? '0.85rem' : '0.6rem'}; color: ${isValidTarget ? '' : '#e74c3c'}; min-width: 35px;">${oeeText}</span></div>`;
        });

        document.getElementById('output-bhp').innerText = bhpTotal.toLocaleString('id-ID');
        document.getElementById('output-ahp').innerText = ahpTotal.toLocaleString('id-ID');
        document.getElementById('total-running').innerText = `${runningCount} / 6`;
        document.getElementById('utilization-bar').style.width = (runningCount / 6 * 100) + '%';
        document.getElementById('utilization-percent').innerText = Math.round(runningCount / 6 * 100) + '% capacity active';
        document.getElementById('last-update-time').innerText = 'Live Refresh: ' + new Date().toLocaleTimeString();
        document.getElementById('offline-banner').style.display = 'none';
    })
    .catch(err => {
        console.error("Fetch Error:", err);
        document.getElementById('offline-banner').style.display = 'block';
    });
}

setInterval(updateDashboard, 5000); 
updateDashboard();
</script>

<?php include 'footer.php'; ?>