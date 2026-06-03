<?php
// data.php
header('Content-Type: application/json');
include 'config.php';
include 'functions.php'; 

function calculateDowntimeMinutes($startTs, $endTs) {
    $startUnix = strtotime($startTs);
    $endUnix = strtotime($endTs);

    if ($startUnix === false || $endUnix === false || $endUnix < $startUnix) {
        return 0;
    }

    // Inclusive minute counting so 17:10 -> 17:10 still counts as 1 minute.
    return max(1, (int)ceil(($endUnix - $startUnix) / 60) + 1);
}

function calculateStopEvents($historyData, $machineList, $stopThreshold = null) {
    if ($stopThreshold === null) {
        $stopThreshold = getStopSpeedThreshold();
    }

    $stopEvents = [];
    foreach ($machineList as $mName) {
        $mData = array_values(array_filter($historyData, fn($r) => $r['device_id'] === $mName));
        $allStops = [];
        $currentStop = null;
        $totalDuration = 0;

        foreach ($mData as $i => $row) {
            $speed = (int)$row['speed'];
            if ($speed <= $stopThreshold) {
                if ($currentStop === null) {
                    $currentStop = [
                        'start_label' => $row['jam_label'],
                        'start_ts' => $row['ts_full'],
                        'start_idx' => $i
                    ];
                }
            } elseif ($speed > $stopThreshold) {
                if ($currentStop !== null) {
                    $endRow = $mData[$i - 1];
                    $duration = calculateDowntimeMinutes($currentStop['start_ts'], $endRow['ts_full']);
                    $event = [
                        'start'    => $currentStop['start_label'],
                        'end'      => $endRow['jam_label'],
                        'start_ts' => $currentStop['start_ts'],
                        'end_ts'   => $endRow['ts_full'],
                        'duration'  => $duration,
                        'ongoing'  => false,
                    ];
                    $allStops[] = $event;
                    $totalDuration += $duration;
                    $currentStop = null;
                }
            }
        }
        if ($currentStop !== null) {
            $lastRow = $mData[count($mData) - 1];
            $duration = calculateDowntimeMinutes($currentStop['start_ts'], $lastRow['ts_full']);
            if ($duration >= 1) {
                $event = [
                    'start'    => $currentStop['start_label'],
                    'end'      => null,
                    'start_ts' => $currentStop['start_ts'],
                    'end_ts'   => null,
                    'last_seen'=> $lastRow['jam_label'],
                    'duration' => $duration,
                    'ongoing'  => true,
                ];
                $allStops[] = $event;
                $totalDuration += $duration;
            }
        }
        $lastStop = count($allStops) > 0 ? $allStops[count($allStops) - 1] : null;
        $stopEvents[$mName] = [
            'count'     => count($allStops),
            'total_duration' => $totalDuration,
            'last_stop' => $lastStop,
            'all_stops' => $allStops,
        ];
    }
    return $stopEvents;
}

try {
    $timeCol = "created_at"; 

    // --- MODE A: DEEP ANALYSIS (Analyze Button) ---
    if (isset($_GET['mode']) && $_GET['mode'] == 'deep_analysis') {
        $mRaw = $_GET['machine'] ?? '';
        $mArray = $mRaw ? array_filter(array_map('trim', explode(',', $mRaw))) : [];
        $start = ($_GET['date_from'] ?? date('Y-m-d')) . ' ' . ($_GET['start'] ?? '00:00') . ':00';
        $end = ($_GET['date_to'] ?? date('Y-m-d')) . ' ' . ($_GET['end'] ?? '23:59') . ':00';

        if (empty($mArray)) {
            echo json_encode([]); exit;
        }

        $placeholders = implode(',', array_fill(0, count($mArray), '?'));
        
        // Fetch speed data
        $sqlSpeed = "SELECT device_id, speed,
                            to_char($timeCol, 'DD/MM HH24:MI') as jam_label,
                            to_char($timeCol, 'YYYY-MM-DD HH24:MI:SS') as ts_full
                     FROM speed_line 
                     WHERE device_id IN ($placeholders) AND $timeCol BETWEEN ? AND ? 
                     ORDER BY $timeCol ASC";
        
        $stmt = $pdo->prepare($sqlSpeed);
        $paramsSpeed = array_merge($mArray, [$start, $end]);
        $stmt->execute($paramsSpeed);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch audit data per machine
        $qManual = "SELECT device_id, SUM(diff) as total_audit FROM (
                        SELECT device_id,
                            CASE 
                                 WHEN output >= LAG(output) OVER (PARTITION BY device_id ORDER BY $timeCol) 
                                 THEN output - LAG(output) OVER (PARTITION BY device_id ORDER BY $timeCol)
                                 ELSE 0 
                            END as diff,
                            ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY $timeCol) as rn
                        FROM current_shift 
                        WHERE device_id IN ($placeholders) AND $timeCol BETWEEN ? AND ?
                    ) sub WHERE rn > 1 GROUP BY device_id"; 
        
        $stM = $pdo->prepare($qManual);
        $paramsAudit = array_merge($mArray, [$start, $end]);
        $stM->execute($paramsAudit);
        $resM = $stM->fetchAll(PDO::FETCH_ASSOC);
        
        // Hitung durasi range dalam jam untuk kalkulasi target proporsional
        $hoursInRange = max(1, round((strtotime($end) - strtotime($start)) / 3600, 2));

        // Ambil SKU aktif per mesin untuk target
        $skuStmt = $pdo->prepare("SELECT DISTINCT ON (device_id) device_id, sku_new
                                   FROM sku_history WHERE device_id IN ($placeholders) AND changed_at <= ?
                                   ORDER BY device_id, changed_at DESC, ctid DESC");
        $skuStmt->execute(array_merge($mArray, [$end]));
        $skuMap = [];
        foreach ($skuStmt->fetchAll(PDO::FETCH_ASSOC) as $sk) {
            $skuMap[$sk['device_id']] = $sk['sku_new'];
        }

        // Format response
        $response = [];
        foreach($mArray as $machineName) {
            $sku           = $skuMap[$machineName] ?? '';
            $targetPerShift = getTargetOutput($machineName, $sku);
            $response[$machineName] = [
                'labels'         => [],
                'values'         => [],
                'total_audit'    => 0,
                'target_range'   => $targetPerShift > 0 ? (int)round($targetPerShift * ($hoursInRange / 8)) : -1,
                'hours_in_range' => $hoursInRange,
            ];
        }

        foreach($resM as $aud) {
            if(isset($response[$aud['device_id']])) {
                $response[$aud['device_id']]['total_audit'] = (int)$aud['total_audit'];
            }
        }

        foreach($rows as $r) {
            if(isset($response[$r['device_id']])) {
                $response[$r['device_id']]['labels'][] = $r['jam_label'];
                $response[$r['device_id']]['values'][] = $r['speed'];
            }
        }

        $stopEvents = calculateStopEvents($rows, $mArray);
        foreach($mArray as $mName) {
            $response[$mName]['stop_events'] = $stopEvents[$mName];
        }

        echo json_encode($response);
        exit;
    }

    // --- MODE B: SHIFT SCOPE (default - chart mengikuti awal shift) ---
    // Jika parameter hours tidak diberikan / kosong, otomatis pakai scope shift aktif
    if (!isset($_GET['hours']) || $_GET['hours'] === '') {
        $shiftScope = getCurrentShiftScope();
        $startDt = $shiftScope['start'];
        $endDt   = $shiftScope['end'];
        $nowDt   = new DateTime();

        // Actual end = min(shift_end, now) — kalau shift belum selesai, end = sekarang
        if ($nowDt < $endDt) {
            $actualEnd = $nowDt;
        } else {
            $actualEnd = $endDt;
        }

        $startStr = $startDt->format('Y-m-d H:i:s');
        $endStr   = $actualEnd->format('Y-m-d H:i:s');
        $shiftEndStr = $endDt->format('Y-m-d H:i:s');

        // Shift info untuk frontend
        $shiftInfo = [
            'shift_name'   => $shiftScope['name'],
            'shift_start' => $startStr,
            'shift_end'   => $shiftEndStr,       // boundary shift (bukan "now")
            'elapsed_min' => $shiftScope['elapsed_min'],
            'total_min'   => $shiftScope['total_min'],
        ];

        // Generate label setiap 30 menit dari start sampai end shift
        $labelStart = (clone $startDt)->modify('+30 minutes');
        $labels = [];
        $current = clone $labelStart;
        while ($current <= $actualEnd) {
            $labels[] = $current->format('H:i');
            $current->modify('+30 minutes');
        }

        // 1. History Speed — ambil semua data di range shift
        $qH = $pdo->prepare("SELECT device_id, speed,
                                    to_char($timeCol, 'HH24:MI') as jam_label,
                                    to_char($timeCol, 'YYYY-MM-DD HH24:MI:SS') as ts_full
                             FROM speed_line
                             WHERE $timeCol BETWEEN :start AND :end
                             ORDER BY device_id, $timeCol ASC");
        $qH->execute(['start' => $startStr, 'end' => $endStr]);
        $history = $qH->fetchAll(PDO::FETCH_ASSOC);

        // 1b. Stop event analysis per mesin
        global $MACHINE_LIST;
        $machineList = $MACHINE_LIST;
        $stopEvents = calculateStopEvents($history, $machineList);

        // 2. Latest Speed
        $latest = $pdo->query("SELECT DISTINCT ON (device_id) device_id, speed
                                FROM speed_line ORDER BY device_id, id DESC")->fetchAll(PDO::FETCH_ASSOC);

        // 3. Realtime Output — dari current_shift
        $realtime = $pdo->query("SELECT DISTINCT ON (device_id) device_id, output
                                 FROM current_shift ORDER BY device_id, id DESC")->fetchAll(PDO::FETCH_ASSOC);

        // 4. Audit output dari current_shift di range ini
        $qA = $pdo->prepare("SELECT device_id, SUM(diff) as total_range FROM (
                                SELECT device_id,
                                    CASE
                                        WHEN output >= LAG(output) OVER (PARTITION BY device_id ORDER BY $timeCol)
                                        THEN output - LAG(output) OVER (PARTITION BY device_id ORDER BY $timeCol)
                                        ELSE 0
                                    END as diff,
                                    ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY $timeCol) as rn
                                FROM current_shift
                                WHERE $timeCol BETWEEN :start AND :end
                             ) sub WHERE rn > 1 GROUP BY device_id");
        $qA->execute(['start' => $startStr, 'end' => $endStr]);
        $audit = $qA->fetchAll(PDO::FETCH_ASSOC);

        // 5. SKU Settings
        $query_settings = "
            SELECT DISTINCT ON (device_id)
                REPLACE(device_id, ' ', '') as dev_clean,
                device_id,
                sku_new as current_variant
            FROM sku_history
            WHERE changed_at <= NOW()
            ORDER BY device_id, changed_at DESC, ctid DESC";
        $settings = $pdo->query($query_settings)->fetchAll(PDO::FETCH_ASSOC);
        foreach ($settings as &$s) {
            $s['target_output'] = getTargetOutput($s['device_id'], $s['current_variant']);
        }

        // 6. Shift Target per mesin — dari SKU aktif + elapsed progress
        $shiftTargets = [];
        foreach ($settings as $s) {
            $target = getTargetOutput($s['device_id'], $s['current_variant']);
            $elapsedRatio = $shiftScope['total_min'] > 0
                ? min(1, $shiftScope['elapsed_min'] / $shiftScope['total_min'])
                : 0;
            $shiftTargets[] = [
                'device_id'    => $s['device_id'],
                'target_total' => $target,
                'target_projected' => round($target * $elapsedRatio),
                'elapsed_ratio'=> round($elapsedRatio * 100),
            ];
        }

        echo json_encode([
            "speed"         => $history,
            "latest_speed"  => $latest,
            "realtime_output" => $realtime,
            "audit_output"  => $audit,
            "settings"      => $settings,
            "shift_info"    => $shiftInfo,
            "chart_labels"  => $labels,
            "shift_targets" => $shiftTargets,
            "stop_events"   => $stopEvents,
            "mode"          => "shift_scope",
        ]);
        exit;
    }

    // --- MODE C: QUICK FILTER (dropdown 1-24 jam) ---
    $hours = (float)($_GET['hours'] ?? 8);
    $fetchHours = ($hours <= 1.0) ? 2.0 : $hours; 
    $interval = $fetchHours . ' hours';
    $auditInterval = $hours . ' hours';

    // 1. History Speed (Chart)
    $qH = $pdo->prepare("SELECT device_id, speed,
                                to_char($timeCol, 'HH24:MI') as jam_label,
                                to_char($timeCol, 'YYYY-MM-DD HH24:MI:SS') as ts_full 
                         FROM speed_line WHERE $timeCol >= (NOW() - CAST(:int AS INTERVAL)) 
                         ORDER BY $timeCol ASC");
    $qH->execute(['int' => $interval]);
    $history = $qH->fetchAll(PDO::FETCH_ASSOC);

    // 2. Latest Speed
    $latest = $pdo->query("SELECT DISTINCT ON (device_id) device_id, speed 
                           FROM speed_line ORDER BY device_id, id DESC")->fetchAll(PDO::FETCH_ASSOC);

    // 3. Audit Output Delta
    $qA = $pdo->prepare("SELECT device_id, SUM(diff) as total_range FROM (
                            SELECT device_id, 
                                CASE 
                                    WHEN output >= LAG(output) OVER (PARTITION BY device_id ORDER BY $timeCol) 
                                    THEN output - LAG(output) OVER (PARTITION BY device_id ORDER BY $timeCol)
                                    ELSE 0 
                                END as diff,
                                ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY $timeCol) as rn
                            FROM current_shift 
                            WHERE $timeCol >= (NOW() - CAST(:int AS INTERVAL))
                         ) sub 
                         WHERE rn > 1 
                         GROUP BY device_id");
    $qA->execute(['int' => $auditInterval]);
    $audit = $qA->fetchAll(PDO::FETCH_ASSOC);

    // 4. Realtime Output
    $realtime = $pdo->query("SELECT DISTINCT ON (device_id) device_id, output 
                             FROM current_shift ORDER BY device_id, id DESC")->fetchAll(PDO::FETCH_ASSOC);

    // 5. SKU Settings (FULL HISTORY VERSION - NO MACHINE_SETTINGS)
    // Kita ambil data UNIK paling baru dari setiap device_id di sku_history
    $query_settings = "
        SELECT DISTINCT ON (device_id)
            REPLACE(device_id, ' ', '') as dev_clean, 
            device_id,
            sku_new as current_variant 
        FROM sku_history 
        WHERE changed_at <= NOW()
        ORDER BY device_id, changed_at DESC, ctid DESC";
    
    $settings = $pdo->query($query_settings)->fetchAll(PDO::FETCH_ASSOC);
    foreach ($settings as &$s) {
        $s['target_output'] = getTargetOutput($s['device_id'], $s['current_variant']);
        $s['target_range']  = $s['target_output'] > 0 ? (int)round($s['target_output'] * ($hours / 8)) : -1;
    }

    global $MACHINE_LIST;
    $machineList = $MACHINE_LIST;
    $stopEvents = calculateStopEvents($history, $machineList);

    echo json_encode([
        "speed"           => $history,
        "latest_speed"    => $latest,
        "realtime_output" => $realtime,
        "audit_output"    => $audit,
        "settings"        => $settings,
        "stop_events"     => $stopEvents,
        "hours_requested" => $hours,
    ]);

} catch (Exception $e) {
    apiError($e->getMessage(), 500);
}
