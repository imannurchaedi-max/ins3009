<?php include_once 'header.php'; ?>
<?php include_once 'config.php'; ?>
<?php include_once 'functions.php'; ?>

<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">

<?php
// FOOLPROOF FIX: Ambil daftar SKU dari konfigurasi master (functions.php)
// Kita gabungkan semua keys agar opsi dropdown dijamin 100% valid dan bersih,
// tidak lagi bergantung pada tabel sku_history yang mungkin kotor.
$allSkuRaw = array_unique(array_merge(
    array_keys($TARGETS_BHP),
    array_keys($TARGETS_HIGH_SPEED),
    array_keys($TARGETS_AHP)
));
sort($allSkuRaw);
?>

<style>
    :root {
        --primary-blue: #3b82f6;
        --dark-navy: #0f172a;
        --soft-bg: #f8fafc;
        --glass-white: rgba(255, 255, 255, 0.9);
    }

    body {
        background-color: var(--soft-bg);
        font-family: 'Plus Jakarta Sans', sans-serif;
    }

    .settings-container {
        max-width: 1100px;
        margin: 0 auto;
        padding-top: 40px;
    }

    .header-section {
        background: linear-gradient(135deg, var(--dark-navy) 0%, #1e293b 100%);
        padding: 40px;
        border-radius: 24px;
        margin-bottom: 40px;
        color: white;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        position: relative;
        overflow: hidden;
    }

    .header-section::after {
        content: "";
        position: absolute;
        top: -50px;
        right: -50px;
        width: 150px;
        height: 150px;
        background: var(--primary-blue);
        filter: blur(80px);
        opacity: 0.4;
    }

    .admin-card {
        background: var(--glass-white);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 24px;
        padding: 28px;
        height: 100%;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .admin-card:hover {
        transform: translateY(-8px);
        border-color: var(--primary-blue);
        box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.1);
    }

    .machine-icon-box {
        width: 48px;
        height: 48px;
        background: #eff6ff;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--primary-blue);
        margin-bottom: 20px;
    }

    .machine-label {
        font-weight: 800;
        color: var(--dark-navy);
        font-size: 1.4rem;
        letter-spacing: -0.025em;
    }

    .sku-current-badge {
        font-size: 0.75rem;
        font-weight: 800;
        padding: 6px 14px;
        background: #f1f5f9;
        color: #334155;
        border-radius: 100px;
        border: 1px solid #e2e8f0;
        display: inline-block;
        margin-top: 5px;
    }

    .form-select-custom {
        border-radius: 12px;
        border: 2px solid #f1f5f9;
        padding: 12px 16px;
        font-weight: 600;
        color: #1e293b;
        background-color: #f8fafc;
        transition: all 0.2s;
        cursor: pointer;
    }

    .form-select-custom:focus {
        border-color: var(--primary-blue);
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        outline: none;
    }

    .btn-save-custom {
        background: var(--dark-navy);
        color: white;
        border: none;
        padding: 14px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 0.9rem;
        width: 100%;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 20px;
    }

    .btn-save-custom:hover:not(:disabled) {
        background: var(--primary-blue);
        box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
    }

    #notif-toast {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        color: white;
        padding: 16px 32px;
        border-radius: 100px;
        font-weight: 600;
        display: none;
        z-index: 9999;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
    }

    @keyframes slideUp {
        from { bottom: -50px; opacity: 0; }
        to { bottom: 30px; opacity: 1; }
    }

    .back-btn {
        margin-top: 50px;
        padding: 15px;
        color: #64748b;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .back-btn:hover { color: var(--primary-blue); }
</style>

<div id="notif-toast">✨ SKU Updated Successfully!</div>

<div class="container settings-container">
    <div class="header-section text-center shadow">
        <h2 class="fw-bold mb-2">System Configuration</h2>
        <p class="opacity-75 mb-0">Manual override SKU aktif langsung ke database history (Full Autopilot Mode).</p>
    </div>

    <div class="row g-4">
        <?php
        // QUERY SAKTI: Ambil daftar mesin unik dan SKU terakhirnya dari sku_history
        $query = "SELECT DISTINCT ON (device_id) 
                         device_id, 
                         sku_new as current_variant 
                  FROM sku_history 
                  WHERE changed_at <= NOW()
                  ORDER BY device_id, changed_at DESC, ctid DESC";
        
        $stmt = $pdo->query($query);
        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        ?>

        <!-- NEW SCHEDULED DEPLOYMENT SECTION -->
        <div class="card admin-card mb-4 w-100 p-4 border-0 shadow-sm" style="background: white;">
            <h4 class="fw-bold mb-4" style="color: var(--dark-navy);"><i class="fas fa-calendar-plus text-primary me-2"></i> Scheduled / Block Deployment</h4>
            <div class="row g-3">
                <div class="col-md-2">
                    <label class="form-label small fw-bold text-muted text-uppercase">Pilih Mesin</label>
                    <select class="form-select shadow-sm" id="sched-machine" onchange="updateSchedSkuList()">
                        <option value="">-- Mesin --</option>
                        <?php foreach($settings as $r) { echo "<option value='{$r['device_id']}'>{$r['device_id']}</option>"; } ?>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label small fw-bold text-muted text-uppercase">Start (Waktu Mulai)</label>
                    <input type="datetime-local" class="form-control shadow-sm" id="sched-start" required>
                </div>
                <div class="col-md-2">
                    <label class="form-label small fw-bold text-muted text-uppercase">SKU Target</label>
                    <select class="form-select shadow-sm" id="sched-sku" disabled><option>-- Pilih Mesin --</option></select>
                </div>
                <div class="col-md-3">
                    <label class="form-label small fw-bold text-muted text-uppercase">End (Batas Akhir Blok)</label>
                    <input type="datetime-local" class="form-control shadow-sm" id="sched-end">
                    <small class="text-muted" style="font-size: 0.65rem;">Opsional: Kosongkan jika tanpa batas</small>
                </div>
                <div class="col-md-2">
                    <label class="form-label small fw-bold text-muted text-uppercase">Revert SKU (Setelah End)</label>
                    <select class="form-select shadow-sm" id="sched-revert" disabled><option>-- Pilih Mesin --</option></select>
                </div>
            </div>
            <div class="text-end mt-4">
                <button class="btn btn-primary px-4 py-2 fw-bold shadow" id="btn-sched" onclick="deployScheduled()">
                    <i class="fas fa-paper-plane me-2"></i> DEPLOY SCHEDULE
                </button>
            </div>
        </div>

        <div class="w-100 mb-2 mt-4">
            <h4 class="fw-bold" style="color: var(--dark-navy);"><i class="fas fa-bolt text-warning me-2"></i> Real-time Active Deployment</h4>
        </div>

        <?php
        foreach ($settings as $row):
            $isAHP = (strpos($row['device_id'], 'AHP') !== false);
            $isHighSpeed = ($row['device_id'] === 'BHP 4' || $row['device_id'] === 'BHP 5');

            // Filter SKU per mesin mengikuti rule yang sama dengan getTargetOutput().
            $applicableTargets = [];
            foreach ($allSkuRaw as $sku) {
                $cleanSku = strtoupper(str_replace(' ', '', $sku));
                $inBhp = isset($TARGETS_BHP[$cleanSku]);
                $inHigh = isset($TARGETS_HIGH_SPEED[$cleanSku]);
                $inAhp = isset($TARGETS_AHP[$cleanSku]);

                if ($isAHP && $inAhp) $applicableTargets[] = $sku;
                if (!$isAHP && $isHighSpeed && ($inHigh || $inBhp)) $applicableTargets[] = $sku;
                if (!$isAHP && !$isHighSpeed && $inBhp) $applicableTargets[] = $sku;
            }

            $mId = preg_replace('/\s+/', '', $row['device_id']);
        ?>
        <div class="col-md-6 col-lg-4">
            <div class="card admin-card">
                <div>
                    <div class="machine-icon-box">
                        <i class="fas fa-microchip fa-lg"></i>
                    </div>
                    <div class="d-flex justify-content-between align-items-start mb-4">
                        <div>
                            <span class="text-muted small fw-bold text-uppercase d-block mb-1" style="letter-spacing: 0.05em;">Unit ID</span>
                            <h4 class="machine-label mb-0"><?= $row['device_id'] ?></h4>
                        </div>
                        <div class="text-end">
                            <span class="text-muted d-block" style="font-size: 0.6rem; font-weight: 700;">ACTIVE SKU</span>
                            <span class="sku-current-badge shadow-sm" id="label_<?= $mId ?>"><?= $row['current_variant'] ?></span>
                        </div>
                    </div>

                    <div class="mb-2">
                        <label class="form-label small fw-bold text-muted text-uppercase">Manual Override</label>
                        <select class="form-select form-select-custom shadow-sm" id="select_<?= $mId ?>">
                            <?php foreach ($applicableTargets as $t): ?>
                                <option value="<?= $t ?>" <?= ($row['current_variant'] == $t) ? 'selected' : '' ?>><?= $t ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <button class="btn btn-save-custom shadow-sm" onclick="saveVariant('<?= $row['device_id'] ?>', this)">
                    <i class="fas fa-save"></i> UPDATE HISTORY
                </button>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <div class="text-center">
        <a href="oee.php" class="back-btn">
            <i class="fas fa-arrow-left"></i> Return to Monitoring Dashboard
        </a>
    </div>
</div>

<script>
function saveVariant(deviceId, btn) {
    const safeId = deviceId.replace(/\s+/g, ''); 
    const variant = document.getElementById('select_' + safeId).value;

    let formData = new FormData();
    formData.append('device_id', deviceId);
    formData.append('variant', variant);

    // Efek Button Loading
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> SAVING...';
    btn.disabled = true;

    fetch('update_variant.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('label_' + safeId).innerText = variant;

            // Munculin Toast
            const toast = document.getElementById('notif-toast');
            toast.style.display = 'block';
            toast.style.animation = 'slideUp 0.3s ease';

            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        } else {
            alert("Error: " + data.error);
        }
    })
    .catch(err => {
        alert("Error updating SKU: " + err);
    })
    .finally(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}

// JAVASCRIPT FOR SCHEDULED / BLOCK DEPLOYMENT
const CONFIG_TARGETS_BHP = <?php echo json_encode(array_keys($TARGETS_BHP)); ?>;
const CONFIG_TARGETS_HIGH = <?php echo json_encode(array_keys($TARGETS_HIGH_SPEED)); ?>;
const CONFIG_TARGETS_AHP = <?php echo json_encode(array_keys($TARGETS_AHP)); ?>;

function updateSchedSkuList() {
    const machine = document.getElementById('sched-machine').value;
    const skuSelect = document.getElementById('sched-sku');
    const revertSelect = document.getElementById('sched-revert');
    
    skuSelect.innerHTML = '<option value="">-- Pilih SKU --</option>';
    revertSelect.innerHTML = '<option value="">-- Pilih SKU --</option>';
    
    if (!machine) {
        skuSelect.disabled = true;
        revertSelect.disabled = true;
        return;
    }
    
    skuSelect.disabled = false;
    revertSelect.disabled = false;
    
    let list = [];
    if (machine.includes('AHP')) {
        list = CONFIG_TARGETS_AHP;
    } else if (machine === 'BHP 4' || machine === 'BHP 5') {
        // High speed machines can use High Speed + Standard BHP targets.
        list = [...new Set([...CONFIG_TARGETS_HIGH, ...CONFIG_TARGETS_BHP])];
    } else {
        list = CONFIG_TARGETS_BHP;
    }
    
    list.sort().forEach(sku => {
        skuSelect.appendChild(new Option(sku, sku));
        revertSelect.appendChild(new Option(sku, sku));
    });
}

function deployScheduled() {
    const machine = document.getElementById('sched-machine').value;
    const start = document.getElementById('sched-start').value;
    const sku = document.getElementById('sched-sku').value;
    const end = document.getElementById('sched-end').value;
    const revert = document.getElementById('sched-revert').value;
    
    if (!machine || !start || !sku) {
        alert("Mesin, Start Time, dan Target SKU wajib diisi!");
        return;
    }
    
    if (end && !revert) {
        alert("Jika batas akhir (End Time) diisi, Revert SKU wajib dipilih!");
        return;
    }

    if (end && new Date(start) >= new Date(end)) {
        alert("End Time harus lebih besar dari Start Time!");
        return;
    }

    const btn = document.getElementById('btn-sched');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> DEPLOYING...';
    btn.disabled = true;

    let formData = new FormData();
    formData.append('device_id', machine);
    formData.append('variant', sku);
    formData.append('start_datetime', start);
    
    if (end && revert) {
        formData.append('end_datetime', end);
        formData.append('revert_variant', revert);
    }

    fetch('update_variant.php', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const toast = document.getElementById('notif-toast');
            toast.innerText = "✨ Scheduled Deployment Saved!";
            toast.style.display = 'block';
            toast.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => { toast.style.display = 'none'; location.reload(); }, 2000);
        } else {
            alert("Error: " + data.error);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    })
    .catch(err => {
        alert("Error: " + err);
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}
</script>

<?php include 'footer.php'; ?>
