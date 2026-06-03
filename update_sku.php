<?php
// update_sku.php
header('Content-Type: application/json');
include 'config.php';
include 'functions.php'; // Pastiin file ini isinya koneksi $pdo lu

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Ambil data dari Fetch API (URLSearchParams)
    $row_id    = isset($_POST['row_id']) ? (int)$_POST['row_id'] : 0;
    $device_id = isset($_POST['device_id']) ? trim($_POST['device_id']) : null;
    $sku       = isset($_POST['sku']) ? strtoupper(str_replace(' ', '', $_POST['sku'])) : null;

    if (!$row_id || !$device_id || !$sku) {
        apiError('Data tidak lengkap (ID, device, atau SKU kosong)');
    }

    if (getTargetOutput($device_id, $sku) === -1) {
        apiError("SKU '$sku' tidak valid untuk mesin $device_id");
    }

    try {
        $query = "UPDATE last_shift
                  SET sku = :sku
                  WHERE id = :id AND device_id = :device_id
                  RETURNING id, device_id";
        $stmt = $pdo->prepare($query);
        $stmt->execute([
            'sku'       => $sku,
            'id'        => $row_id,
            'device_id' => $device_id
        ]);
        $updated = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($updated) {
            apiSuccess();
        } else {
            apiError('Row OEE tidak cocok dengan mesin yang dipilih. Refresh halaman lalu coba lagi.', 409);
        }
    } catch (PDOException $e) {
        apiError($e->getMessage(), 500);
    }
} else {
    apiError('Metode request salah', 405);
}
?>
