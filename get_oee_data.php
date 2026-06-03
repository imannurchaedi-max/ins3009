<?php
// get_oee_data.php
header('Content-Type: application/json');
include 'config.php';
include 'functions.php';

try {
    $limit = 12; 
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $offset = ($page - 1) * $limit;

    $totalQuery = $pdo->query("SELECT COUNT(*) FROM last_shift");
    $totalRows = $totalQuery->fetchColumn();
    $totalPages = ceil($totalRows / $limit);

    $query = "SELECT * FROM (
                SELECT 
                    ls.id,
                    ls.device_id, 
                    ls.output as total_output, 
                    ls.created_at,
                    -- LOGIC SKU BERDASARKAN WAKTU ATAU KOREKSI MANUAL:
                    -- Prioritas 1: ls.sku (jika user melakukan 'Koreksi SKU' manual dari dashboard)
                    -- Prioritas 2: Cari di histori waktu yang mendekati created_at
                    COALESCE(
                        NULLIF(ls.sku, ''),
                        (SELECT h.sku_new 
                         FROM sku_history h 
                         WHERE h.device_id = ls.device_id 
                           AND h.changed_at <= ls.created_at 
                         ORDER BY h.changed_at DESC, h.ctid DESC LIMIT 1),
                        'BELUM SET'
                    ) as sku,
                    -- 1. LOGIC SHIFT
                    CASE 
                        WHEN to_char(ls.created_at, 'HH24:MI:SS') BETWEEN '06:00:00' AND '13:59:59' THEN 'SHIFT 1'
                        WHEN to_char(ls.created_at, 'HH24:MI:SS') BETWEEN '14:00:00' AND '21:59:59' THEN 'SHIFT 2'
                        ELSE 'SHIFT 3'
                    END as shift_id,
                    -- 2. LOGIC TANGGAL PRODUKSI
                    CASE 
                        WHEN to_char(ls.created_at, 'HH24:MI:SS') < '06:00:00' 
                        THEN to_char(ls.created_at - INTERVAL '1 day', 'DD/MM/YYYY')
                        ELSE to_char(ls.created_at, 'DD/MM/YYYY')
                    END as tanggal,
                    -- 3. LOGIC SORTING
                    CASE 
                        WHEN to_char(ls.created_at, 'HH24:MI:SS') < '06:00:00' 
                        THEN to_char(ls.created_at - INTERVAL '1 day', 'YYYY-MM-DD')
                        ELSE to_char(ls.created_at, 'YYYY-MM-DD')
                    END as tgl_sort,
                    CASE
                        WHEN to_char(ls.created_at, 'HH24:MI:SS') BETWEEN '06:00:00' AND '13:59:59' THEN 1
                        WHEN to_char(ls.created_at, 'HH24:MI:SS') BETWEEN '14:00:00' AND '21:59:59' THEN 2
                        ELSE 3
                    END as shift_num
                FROM last_shift ls
              ) as sub
              ORDER BY 
                tgl_sort DESC, 
                shift_num DESC, 
                CASE 
                    WHEN device_id = 'AHP 1' THEN 1
                    WHEN device_id = 'BHP 1' THEN 2
                    WHEN device_id = 'BHP 2' THEN 3
                    WHEN device_id = 'BHP 3' THEN 4
                    WHEN device_id = 'BHP 4' THEN 5
                    WHEN device_id = 'BHP 5' THEN 6
                    ELSE 7 
                END ASC
              LIMIT :limit OFFSET :offset";
              
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($data as &$row) {
        $row['target_output'] = getTargetOutput($row['device_id'], $row['sku']);
    }

    echo json_encode([
        'data' => $data,
        'current_page' => $page,
        'total_pages' => $totalPages,
        'total_rows' => $totalRows
    ]);

} catch (PDOException $e) {
    apiError($e->getMessage(), 500);
}
?>
