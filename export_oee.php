<?php
// export_oee.php
include 'config.php';
include 'functions.php';

$months_name = [1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'];
$month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('n');
$year  = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');

if (!$month || !$year) {
    die("Parameter month dan year wajib diisi.");
}

try {
    $query = "SELECT  
                ls.device_id,  
                ls.output,  
                COALESCE(
                    NULLIF(ls.sku, ''),
                    (SELECT h.sku_new
                     FROM sku_history h
                     WHERE h.device_id = ls.device_id
                       AND h.changed_at <= ls.created_at
                     ORDER BY h.changed_at DESC, h.ctid DESC
                     LIMIT 1),
                    'BELUM SET'
                ) as sku,
                CASE  
                    WHEN to_char(ls.created_at, 'HH24:MI:SS') BETWEEN '06:00:00' AND '13:59:59' THEN 'SHIFT 1'
                    WHEN to_char(ls.created_at, 'HH24:MI:SS') BETWEEN '14:00:00' AND '21:59:59' THEN 'SHIFT 2'
                    ELSE 'SHIFT 3'
                END as shift_id,
                to_char(ls.created_at, 'DD-MM-YYYY HH24:MI') as full_date
              FROM last_shift ls
              WHERE EXTRACT(MONTH FROM ls.created_at) = :month  
                AND EXTRACT(YEAR FROM ls.created_at) = :year
              ORDER BY ls.id ASC";

    $stmt = $pdo->prepare($query);
    $stmt->execute(['month' => $month, 'year' => $year]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "<table border='1'>";
    echo "<tr><th colspan='8' style='font-size: 1.4rem; padding: 10px;'>OEE PRODUCTION REPORT - " . strtoupper($months_name[$month]) . " $year</th></tr>";
    echo "<tr style='background-color: #2c3e50; color: white;'>
            <th>No</th>
            <th>Date Time</th>
            <th>Machine</th>
            <th>Shift</th>
            <th>SKU</th>
            <th>Actual Output</th>
            <th>Target</th>
            <th>OEE (%)</th>
          </tr>";

    if (count($rows) > 0) {
        $no = 1;
        foreach ($rows as $row) {
            $targetVal = getTargetOutput($row['device_id'], $row['sku']);
            $oee = getOEEPercentage($row['output'], $row['device_id'], $row['sku']);
            $targetLabel = $targetVal > 0 ? number_format($targetVal, 0, ',', '.') : '--';
            $oeeLabel = $oee >= 0 ? $oee . '%' : 'SKU INVALID';
            $skuLabel = htmlspecialchars($row['sku'], ENT_QUOTES, 'UTF-8');
            $dateLabel = htmlspecialchars($row['full_date'], ENT_QUOTES, 'UTF-8');
            $machineLabel = htmlspecialchars($row['device_id'], ENT_QUOTES, 'UTF-8');
            $shiftLabel = htmlspecialchars($row['shift_id'], ENT_QUOTES, 'UTF-8');

            echo "<tr>
                    <td align='center'>$no</td>
                    <td>{$dateLabel}</td>
                    <td>{$machineLabel}</td>
                    <td align='center'>{$shiftLabel}</td>
                    <td align='center'>{$skuLabel}</td>
                    <td align='right'>" . number_format($row['output'], 0, ',', '.') . "</td>
                    <td align='right'>{$targetLabel}</td>
                    <td align='center' style='font-weight: bold;'>{$oeeLabel}</td>
                  </tr>";
            $no++;
        }
    } else {
        echo "<tr><td colspan='8' align='center'>Tidak ada data pada periode ini.</td></tr>";
    }
    echo "</table>";

} catch (PDOException $e) {
    die("Database Error: " . $e->getMessage());
}
?>
