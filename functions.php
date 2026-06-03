<?php
// functions.php
// Sentralisasi Konfigurasi Target Produksi per Shift dan Fungsi Utilitas

// Daftar mesin resmi — satu-satunya sumber kebenaran. Pakai global di semua file.
$MACHINE_LIST = ['BHP 1', 'BHP 2', 'BHP 3', 'BHP 4', 'BHP 5', 'AHP 1'];
$STOP_SPEED_THRESHOLD = 5;

// Key disimpan TANPA SPASI agar lebih robust.
$TARGETS_BHP = [
    "S1" => 240000, "S40" => 240000, "M1" => 240000, "M32" => 240000, 
    "L1" => 223200, "L28" => 223200, "XL1" => 201600, "XL26" => 201600, 
    "XXL24" => 184800
];

$TARGETS_HIGH_SPEED = [
    "S40" => 336000, "XL26" => 336000, "M32" => 384000, "L28" => 384000
];

$TARGETS_AHP = [
    "M10" => 144000, "M1" => 120000, "L8" => 120000, "L1" => 120000, 
    "XL6" => 120000, "XL1" => 120000
];

/**
 * Mendapatkan target output per shift berdasarkan jenis mesin dan varian (SKU).
 */
function getTargetOutput($deviceId, $sku) {
    global $TARGETS_BHP, $TARGETS_HIGH_SPEED, $TARGETS_AHP;
    
    $cleanId = strtoupper(str_replace(' ', '', $deviceId));
    $cleanVariant = strtoupper(str_replace(' ', '', $sku));

    if (strpos($cleanId, 'AHP') !== false) {
        return isset($TARGETS_AHP[$cleanVariant]) ? $TARGETS_AHP[$cleanVariant] : -1;
    } else if ($cleanId === 'BHP4' || $cleanId === 'BHP5') {
        return isset($TARGETS_HIGH_SPEED[$cleanVariant]) ? $TARGETS_HIGH_SPEED[$cleanVariant] : (isset($TARGETS_BHP[$cleanVariant]) ? $TARGETS_BHP[$cleanVariant] : -1);
    } else {
        return isset($TARGETS_BHP[$cleanVariant]) ? $TARGETS_BHP[$cleanVariant] : -1;
    }
}

/**
 * Menghitung persentase OEE (Max 100%).
 * Return -1 bila target/SKU tidak valid untuk mesin terkait.
 */
function getOEEPercentage($output, $deviceId, $sku) {
    $target = getTargetOutput($deviceId, $sku);

    if ($target <= 0) {
        return -1;
    }

    $oee = ($output > 0) ? round(($output / $target) * 100) : 0;
    return min($oee, 100);
}

function getStopSpeedThreshold() {
    global $STOP_SPEED_THRESHOLD;
    return (int)$STOP_SPEED_THRESHOLD;
}

function isMachineStopped($speed) {
    return (int)$speed <= getStopSpeedThreshold();
}

/**
 * Menentukan Shift ID berdasarkan string waktu (format HH24:MI:SS).
 * BATAS SHIFT (sumber kebenaran — SQL CASE di get_oee_data.php & export_oee.php HARUS mirror ini):
 *   SHIFT 1: 06:00:00 – 13:59:59
 *   SHIFT 2: 14:00:00 – 21:59:59
 *   SHIFT 3: 22:00:00 – 05:59:59 (cross-midnight)
 */
function getShiftID($timeStr) {
    if ($timeStr >= '06:00:00' && $timeStr <= '13:59:59') return 'SHIFT 1';
    if ($timeStr >= '14:00:00' && $timeStr <= '21:59:59') return 'SHIFT 2';
    return 'SHIFT 3';
}

/**
 * Ambil output terbaru per mesin dari tabel shift manapun.
 * Dipakai oleh output.php dan tv_dashboard.php — jangan duplikat di sana.
 */
function getShiftData($pdo, $tableName) {
    $data = [];
    try {
        $stmt = $pdo->query("SELECT DISTINCT ON (device_id) device_id, output FROM $tableName ORDER BY device_id, id DESC");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $cleanId = strtoupper(str_replace(' ', '', $row['device_id']));
            $data[$cleanId] = (int)$row['output'];
        }
    } catch (PDOException $e) { return []; }
    return $data;
}
/**
 * Mendapatkan start & end timestamp shift yang sedang berjalan.
 * Return associative array dengan keys: shift_name, shift_start, shift_end, shift_now_minutes
 */
function getCurrentShiftScope() {
    $now = new DateTime();
    $nowTime = $now->format('H:i:s');

    if ($nowTime >= '06:00:00' && $nowTime <= '13:59:59') {
        $shiftName = 'SHIFT 1';
        $shiftStart = (clone $now)->setTime(6, 0, 0);
        $shiftEnd   = (clone $now)->setTime(14, 0, 0);
    } elseif ($nowTime >= '14:00:00' && $nowTime <= '21:59:59') {
        $shiftName = 'SHIFT 2';
        $shiftStart = (clone $now)->setTime(14, 0, 0);
        $shiftEnd   = (clone $now)->setTime(22, 0, 0);
    } else {
        // Shift 3: 22:00 - 06:00 (lewat tengah malam)
        $shiftName = 'SHIFT 3';
        if ($nowTime < '06:00:00') {
            // 00:00 - 05:59 — shift sudah mulai kemarin jam 22:00
            $shiftStart = (clone $now)->setTime(22, 0, 0)->modify('-1 day');
            $shiftEnd   = (clone $now)->setTime(6, 0, 0);           // hari ini jam 06:00
        } else {
            // 22:00 - 23:59 — shift mulai hari ini jam 22:00
            $shiftStart = (clone $now)->setTime(22, 0, 0);
            $shiftEnd   = (clone $now)->modify('+1 day')->setTime(6, 0, 0); // besok jam 06:00
        }
    }

    // Hitung elapsed dari timestamp agar akurat untuk semua kasus
    $secondsElapsed = max(0, $now->getTimestamp() - $shiftStart->getTimestamp());
    $minutesElapsed = (int)floor($secondsElapsed / 60);
    $shiftDuration = 8 * 60; // 480 menit

    return [
        'name'        => $shiftName,
        'start'       => $shiftStart,
        'end'         => $shiftEnd,
        'elapsed_min' => $minutesElapsed,
        'total_min'   => $shiftDuration,
    ];
}

/**
 * Response JSON error standar.
 */
function apiError($message, $httpCode = 400) {
    http_response_code($httpCode);
    echo json_encode(["success" => false, "error" => $message]);
    exit;
}

/**
 * Response JSON success standar.
 */
function apiSuccess($data = []) {
    echo json_encode(array_merge(["success" => true], $data));
    exit;
}
?>
