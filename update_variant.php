<?php
header('Content-Type: application/json');
include 'config.php';
include 'functions.php';

if (!isset($_POST['device_id']) || !isset($_POST['variant'])) {
    apiError('Parameter device_id dan variant wajib diisi');
}

$deviceId = htmlspecialchars(trim($_POST['device_id']), ENT_QUOTES, 'UTF-8');
$variant  = strtoupper(str_replace(' ', '', htmlspecialchars($_POST['variant'], ENT_QUOTES, 'UTF-8')));

if (!in_array($deviceId, $MACHINE_LIST, true)) {
    apiError("Mesin '$deviceId' tidak dikenal");
}

if (getTargetOutput($deviceId, $variant) === -1) {
    apiError("SKU '$variant' tidak terdaftar atau tidak valid untuk mesin $deviceId");
}

$startDatetime = !empty($_POST['start_datetime']) ? htmlspecialchars($_POST['start_datetime'], ENT_QUOTES, 'UTF-8') : null;
$endDatetime   = !empty($_POST['end_datetime'])   ? htmlspecialchars($_POST['end_datetime'], ENT_QUOTES, 'UTF-8')   : null;
$revertVariant = !empty($_POST['revert_variant']) ? strtoupper(str_replace(' ', '', htmlspecialchars($_POST['revert_variant'], ENT_QUOTES, 'UTF-8'))) : null;

if ($endDatetime && !$revertVariant) {
    apiError('Revert SKU wajib diisi jika End Time dipakai');
}

if ($revertVariant && !$endDatetime) {
    apiError('End Time wajib diisi jika Revert SKU dipakai');
}

if ($startDatetime && $endDatetime) {
    try {
        $startAt = new DateTime($startDatetime);
        $endAt = new DateTime($endDatetime);
    } catch (Exception $e) {
        apiError('Format tanggal/waktu tidak valid');
    }

    if ($endAt <= $startAt) {
        apiError('End Time harus lebih besar dari Start Time');
    }
}

try {
    $pdo->beginTransaction();

    // 1. Insert Target SKU di waktu Start, atau "paksa menang" untuk manual override realtime.
    if ($startDatetime) {
        $query = "INSERT INTO sku_history (device_id, sku_new, changed_at)
                  VALUES (:device, :variant, :dt)
                  RETURNING changed_at";
        $params = ['variant' => $variant, 'device' => $deviceId, 'dt' => $startDatetime];
    } else {
        $query = "INSERT INTO sku_history (device_id, sku_new, changed_at)
                  SELECT
                      :device,
                      :variant,
                      GREATEST(
                          NOW(),
                          COALESCE(
                              (
                                  SELECT MAX(changed_at) + INTERVAL '1 second'
                                  FROM sku_history
                                  WHERE device_id = :device
                                    AND changed_at <= NOW()
                              ),
                              NOW()
                          )
                      )
                  RETURNING changed_at";
        $params = ['variant' => $variant, 'device' => $deviceId];
    }
    $writtenAt = $pdo->prepare($query);
    $writtenAt->execute($params);
    $inserted = $writtenAt->fetch(PDO::FETCH_ASSOC);

    // 2. Insert Revert SKU jika Mode Block Period
    if ($endDatetime && $revertVariant) {
        if (getTargetOutput($deviceId, $revertVariant) === -1) {
            $pdo->rollBack();
            apiError("SKU Revert '$revertVariant' tidak valid untuk mesin $deviceId");
        }
        $pdo->prepare("INSERT INTO sku_history (device_id, sku_new, changed_at) VALUES (:device, :variant, :dt)")
            ->execute(['variant' => $revertVariant, 'device' => $deviceId, 'dt' => $endDatetime]);
    }

    $pdo->commit();
    apiSuccess([
        'effective_changed_at' => $inserted['changed_at'] ?? null,
        'device_id' => $deviceId,
        'variant' => $variant
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    apiError($e->getMessage(), 500);
}
?>
