<?php
include 'config.php';

$deviceId = isset($_GET['device']) ? trim($_GET['device']) : 'BHP 5';

$stmt = $pdo->prepare("
    SELECT ctid, *
    FROM sku_history
    WHERE device_id = :device_id
    ORDER BY changed_at DESC, ctid DESC
    LIMIT 10
");
$stmt->execute(['device_id' => $deviceId]);
$res = $stmt->fetchAll(PDO::FETCH_ASSOC);

header('Content-Type: text/plain; charset=utf-8');
echo "Recent SKU rows for {$deviceId}\n";
echo str_repeat('=', 60) . "\n";
print_r($res);
?>
