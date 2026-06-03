<?php
// config.php
date_default_timezone_set('Asia/Jakarta');

$host = "localhost";
$db   = "Speed";
$user = "postgres";
$pass = "SASMU123";

try {
    // Kita buat satu koneksi PDO yang bisa dipake rame-rame
    $pdo = new PDO("pgsql:host=$host;dbname=$db", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Variabel $dbconn kita arahin ke $pdo biar kode lama gak error
    $dbconn = $pdo; 
} catch (PDOException $e) {
    die("Koneksi Database Gagal: " . $e->getMessage());
}
?>