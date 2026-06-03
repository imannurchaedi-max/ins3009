<?php 
include 'header.php'; 
include 'config.php'; 

// 1. Konfigurasi Target (Dihapus, sekarang menggunakan functions.php dari header.php)

// getShiftData() sudah ada di functions.php (via header.php) — tidak perlu diduplikat di sini.

// 2. Ambil SKU aktif dari sku_history (konsisten dengan file lain)
$stmtSet = $pdo->query("
    SELECT DISTINCT ON (device_id) device_id, sku_new as active_sku
    FROM sku_history
    WHERE changed_at <= NOW()
    ORDER BY device_id, changed_at DESC, ctid DESC");
$settings = [];
while ($s = $stmtSet->fetch()) {
    $cleanId = strtoupper(str_replace(' ', '', $s['device_id']));
    $settings[$cleanId] = strtoupper(str_replace(' ', '', $s['active_sku']));
}

$current = getShiftData($pdo, 'current_shift');
$last1   = getShiftData($pdo, 'last_shift');
$last2   = getShiftData($pdo, 'last_2shift');
$last3   = getShiftData($pdo, 'last_3shift');
$lastDay = getShiftData($pdo, 'total_lastday');

$machines = ['BHP 1', 'BHP 2', 'BHP 3', 'BHP 4', 'BHP 5', 'AHP 1'];

// 3. Fungsi bantu hitung OEE secara dinamis
function showOEE($output, $deviceId, $settings) {
    $variant = $settings[$deviceId] ?? "";

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

function sumByGroup($data, $groupName) {
    $total = 0;
    foreach ($data as $id => $val) {
        if (strpos($id, $groupName) !== false) { $total += $val; }
    }
    return $total;
}
?>

<style>
    .oee-mini-badge {
        font-size: 0.6rem;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
        margin-top: 4px;
        text-transform: uppercase;
    }
    .oee-good { background: #e3fcef; color: #00b894; border: 1px solid #00b894; }
    .oee-warn { background: #fff9db; color: #f08c00; border: 1px solid #f08c00; }
    .oee-low { background: #fff5f5; color: #e74c3c; border: 1px solid #e74c3c; }
    .table-responsive { overflow-x: auto; }
</style>

<div class="container-fluid p-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h4 class="fw-bold mb-0 text-dark">📦 Performance Monitoring System</h4>
            <small class="text-muted">Production Output & OEE Efficiency per Shift</small>
        </div>
        <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm" onclick="window.location.reload()">
            🔄 Refresh Data
        </button>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-xl-6">
            <div class="card h-100 border-0 shadow-sm rounded-4" style="background: linear-gradient(135deg, #1e3799 0%, #0984e3 100%); color: white;">
                <div class="card-body p-4">
                    <div class="row align-items-center">
                        <div class="col-6 border-end border-white border-opacity-25">
                            <small class="text-uppercase fw-bold opacity-75" style="font-size: 0.7rem;">BHP Group Current</small>
                            <h2 class="fw-bold mb-0"><?= number_format(sumByGroup($current, 'BHP'), 0, ',', '.') ?> <small style="font-size: 0.8rem;">PCS</small></h2>
                        </div>
                        <div class="col-6 ps-4">
                            <small class="text-uppercase fw-bold opacity-75" style="font-size: 0.7rem;">AHP 1 Current</small>
                            <h2 class="fw-bold mb-0 text-info"><?= number_format(sumByGroup($current, 'AHP'), 0, ',', '.') ?> <small style="font-size: 0.8rem;">PCS</small></h2>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-xl-3">
            <div class="card border-0 shadow-sm rounded-4 h-100" style="border-left: 5px solid #f39c12 !important;">
                <div class="card-body p-3 d-flex flex-column justify-content-center text-center">
                    <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">BHP Total Last Day</small>
                    <h3 class="fw-bold mb-0 text-dark"><?= number_format(sumByGroup($lastDay, 'BHP'), 0, ',', '.') ?> <small class="text-muted" style="font-size: 0.8rem;">PCS</small></h3>
                </div>
            </div>
        </div>
        <div class="col-xl-3">
            <div class="card border-0 shadow-sm rounded-4 h-100" style="border-left: 5px solid #27ae60 !important;">
                <div class="card-body p-3 d-flex flex-column justify-content-center text-center">
                    <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">AHP Total Last Day</small>
                    <h3 class="fw-bold mb-0 text-dark"><?= number_format(sumByGroup($lastDay, 'AHP'), 0, ',', '.') ?> <small class="text-muted" style="font-size: 0.8rem;">PCS</small></h3>
                </div>
            </div>
        </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div class="card-header bg-white py-3 border-bottom">
            <h6 class="m-0 fw-bold text-dark">Production Accuracy & Shift Performance</h6>
        </div>
        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 text-center">
                <thead class="table-light">
                    <tr style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px;">
                        <th class="ps-4 py-3 text-start" style="width: 200px;">Machine Unit</th>
                        <th>Current Shift</th>
                        <th>Last Shift</th>
                        <th>Last 2 Shifts</th>
                        <th>Last 3 Shifts</th>
                    </tr>
                </thead>
                <tbody style="font-size: 0.9rem;">
                    <?php foreach ($machines as $m): 
                        $mClean = strtoupper(str_replace(' ', '', $m));
                        // Tampilkan SKU asli (dengan spasi) untuk visual, tapi ambil data dari array settings
                        $skuDisplay = $settings[$mClean] ?? 'N/A';
                    ?>
                    <tr>
                        <td class="ps-4 text-start">
                            <div class="fw-bold text-dark"><?= $m ?></div>
                            <small class="badge bg-light text-dark border" style="font-size: 0.6rem;">SKU: <?= $skuDisplay ?></small>
                        </td>
                        <td class="fw-bold">
                            <?= number_format($current[$mClean] ?? 0, 0, ',', '.') ?>
                            <?= showOEE($current[$mClean] ?? 0, $mClean, $settings) ?>
                        </td>
                        <td>
                            <?= number_format($last1[$mClean] ?? 0, 0, ',', '.') ?>
                            <?= showOEE($last1[$mClean] ?? 0, $mClean, $settings) ?>
                        </td>
                        <td>
                            <?= number_format($last2[$mClean] ?? 0, 0, ',', '.') ?>
                            <?= showOEE($last2[$mClean] ?? 0, $mClean, $settings) ?>
                        </td>
                        <td>
                            <?= number_format($last3[$mClean] ?? 0, 0, ',', '.') ?>
                            <?= showOEE($last3[$mClean] ?? 0, $mClean, $settings) ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<?php include 'footer.php'; ?>
