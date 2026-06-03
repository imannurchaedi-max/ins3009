<?php
include 'config.php';
$query_settings = "
    SELECT DISTINCT ON (device_id)
        REPLACE(device_id, ' ', '') as dev_clean, 
        device_id,
        sku_new as current_variant 
    FROM sku_history 
    ORDER BY device_id, changed_at DESC";
$settings = $pdo->query($query_settings)->fetchAll(PDO::FETCH_ASSOC);
file_put_contents('debug_settings.json', json_encode($settings, JSON_PRETTY_PRINT));
echo "Debug done";
