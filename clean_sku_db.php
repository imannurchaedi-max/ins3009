<?php
include 'config.php';

echo "<h2 style='font-family: sans-serif; color: #1e293b;'>🧹 SKU Database Cleanup</h2>";

try {
    // 1. Hapus entri kotor seperti 'CODE-0', 'null', atau string kosong
    $deleteQuery = "DELETE FROM sku_history WHERE sku_new IN ('CODE-0', 'null', '') OR sku_new IS NULL";
    $deleted = $pdo->exec($deleteQuery);
    echo "<p>✅ Dihapus <b>$deleted</b> baris data kotor (CODE-0, null, kosong).</p>";

    // 2. Bersihkan spasi dari SKU (contoh: "M 32" diubah menjadi "M32")
    $updateQuery = "UPDATE sku_history SET sku_new = REPLACE(sku_new, ' ', '') WHERE sku_new LIKE '% %'";
    $updated = $pdo->exec($updateQuery);
    echo "<p>✅ Diperbaiki <b>$updated</b> baris data SKU yang mengandung spasi.</p>";

    echo "<h3 style='color: #10b981;'>🎉 Pembersihan Selesai!</h3>";
    echo "<p>Silakan kembali ke <a href='settings.php'>Settings Dashboard</a>. Opsi dropdown dan UI sekarang dijamin bersih.</p>";

} catch (PDOException $e) {
    echo "<p style='color: red;'>Error: " . $e->getMessage() . "</p>";
}
?>
