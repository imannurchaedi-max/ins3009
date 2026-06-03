<?php include 'header.php'; ?>

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

<style>
    :root {
        --shift1: #f1c40f; --shift2: #3498db; --shift3: #9b59b6;
    }
    .main-content-padding { padding: 30px; background-color: #f8f9fa; min-height: 100vh; }
    
    /* Card Style */
    .oee-row-card { 
        background: white; border-radius: 15px; margin-bottom: 8px; padding: 15px 20px; 
        transition: all 0.2s; border: 1px solid rgba(0,0,0,0.03); display: flex; align-items: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .oee-row-card:hover { transform: translateX(5px); box-shadow: 0 5px 15px rgba(0,0,0,0.05); border-left: 5px solid #3498db; }

    .data-label { font-size: 0.65rem; color: #95a5a6; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px; }
    .data-value { font-weight: 700; color: #2c3e50; font-size: 1rem; display: block; }
    .shift-badge { padding: 4px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; color: white; min-width: 70px; text-align: center; }
    .output-value { color: #0984e3; font-size: 1.1rem; font-weight: 800; }
    
    /* Progress Bar */
    .progress-container { width: 100%; max-width: 150px; }
    .custom-progress { height: 12px; border-radius: 20px; background: #eee; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 20px; transition: width 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    
    /* Group Header */
    .group-header {
        background: #f1f2f6; padding: 12px 20px; border-radius: 15px; margin-top: 25px; margin-bottom: 10px;
        border-left: 5px solid #2c3e50; display: flex; align-items: center; justify-content: space-between;
    }

    .search-box { background: white; border: 1px solid #dfe6e9; padding: 8px 15px 8px 35px; border-radius: 12px; width: 280px; font-size: 0.85rem; }
    .search-wrapper { position: relative; }
    .search-wrapper i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #bdc3c7; }
</style>

<div class="main-content-padding">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h3 class="fw-bold m-0" style="letter-spacing: -1px; color: #2d3436;">OEE Performance Log</h3>
            <p class="text-muted small m-0"><i class="fas fa-history me-1"></i> Urutan: Tanggal Terbaru > Shift Terbaru > Mesin A-Z</p>
        </div>
        
        <div class="d-flex gap-3 align-items-center">
            <div class="search-wrapper">
                <i class="fas fa-search"></i>
                <input type="text" id="searchInput" class="search-box shadow-sm" placeholder="Cari Mesin atau SKU..." onkeyup="filterData()">
            </div>

            <form action="export_oee.php" method="GET" class="d-flex gap-2 align-items-center bg-white p-2 rounded-4 shadow-sm border-0">
                <select name="month" class="form-select form-select-sm border-0 fw-bold" style="width: 120px;">
                    <?php
                    $months = [1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'];
                    foreach ($months as $num => $name) {
                        $selected = ($num == date('n')) ? 'selected' : '';
                        echo "<option value='$num' $selected>$name</option>";
                    }
                    ?>
                </select>
                <button type="submit" class="btn btn-success btn-sm rounded-3 px-3">
                    <i class="fas fa-file-excel"></i>
                </button>
            </form>
            <button class="btn btn-primary btn-sm rounded-4 px-3 shadow-sm" onclick="loadOEEData(1)">
                <i class="fas fa-sync-alt"></i>
            </button>
        </div>
    </div>

    <div id="oee-container"></div>

    <div class="d-flex justify-content-between align-items-center mt-4 p-3 bg-white rounded-4 shadow-sm">
        <div class="text-muted small fw-bold">
            TOTAL RECORDS: <span id="total-data" class="text-primary">0</span>
        </div>
        <nav><ul class="pagination pagination-sm mb-0" id="pagination-controls"></ul></nav>
    </div>
</div>

<div class="modal fade" id="modalEditSKU" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg" style="border-radius: 20px;">
            <div class="modal-header border-0 pb-0">
                <h5 class="modal-title fw-bold">Koreksi SKU: <span id="modal-machine-name" class="text-primary"></span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form id="formEditSKU">
                <div class="modal-body">
                    <input type="hidden" id="edit-row-id"> 
                    <input type="hidden" id="edit-device-id">
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">SKU PRODUKSI</label>
                        <select class="form-select rounded-3" id="select-sku" required></select>
                    </div>
                </div>
                <div class="modal-footer border-0 pt-0">
                    <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
                    <button type="submit" id="btnSubmitSKU" class="btn btn-primary rounded-pill px-4">Update</button>
                </div>
            </form>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>

<script>
// --- TARGETS CONFIG SEKARANG DIAMBIL DARI window.TARGETS_* (functions.php) ---

let editModalInstance;
let allData = [];
let currentPage = 1;

function loadOEEData(page = 1) {
    currentPage = page;
    const container = document.getElementById('oee-container');
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';

    fetch(`get_oee_data.php?page=${page}`)
    .then(res => res.json())
    .then(res => {
        allData = res.data;
        renderCards(allData);
        document.getElementById('total-data').innerText = res.total_rows;
        renderPagination(res.total_pages, res.current_page);
    });
}

function renderCards(dataList) {
    const container = document.getElementById('oee-container');
    container.innerHTML = '';
    
    let currentGroupKey = "";

    dataList.forEach(m => {
        let groupKey = m.tanggal + m.shift_id;
        if (groupKey !== currentGroupKey) {
            currentGroupKey = groupKey;
            let sColor = m.shift_id.includes('1') ? 'var(--shift1)' : (m.shift_id.includes('2') ? 'var(--shift2)' : 'var(--shift3)');
            
            container.insertAdjacentHTML('beforeend', `
                <div class="group-header shadow-sm machine-item-header">
                    <span class="fw-bold text-dark"><i class="far fa-calendar-alt me-2"></i>Produksi: ${m.tanggal}</span>
                    <span class="badge shift-badge" style="background: ${sColor}; border: 1px solid rgba(0,0,0,0.1)">${m.shift_id}</span>
                </div>
            `);
        }

        const isAHP = m.device_id.includes('AHP');
        // BHP 5 DISAMAKAN DENGAN BHP 4
        const isHighSpeed = (m.device_id === 'BHP 4' || m.device_id === 'BHP 5');
        
        // --- LOGIC TARGET PENENTU OEE ---
        let targetVal = m.target_output ? parseInt(m.target_output) : -1;
        let isValidTarget = targetVal > 0;

        let oee = 0;
        let colorCode = "#95a5a6";
        let oeeText = "INVALID";

        if (isValidTarget) {
            oee = Math.min(Math.round((m.total_output / targetVal) * 100), 100);
            colorCode = oee >= 85 ? "#2ecc71" : (oee >= 70 ? "#f1c40f" : "#e74c3c");
            oeeText = oee + "%";
        }

        container.insertAdjacentHTML('beforeend', `
            <div class="oee-row-card machine-item" data-name="${m.device_id}" data-sku="${m.sku}">
                <div style="flex: 2;">
                    <span class="data-label">Machine Name</span>
                    <span class="data-value">${m.device_id}</span>
                </div>
                <div style="flex: 1;">
                    <span class="data-label">SKU</span>
                    <span class="badge bg-light text-dark border-0 shadow-sm" style="font-size:0.75rem; font-weight:800;">${m.sku}</span>
                </div>
                <div style="flex: 1.5;">
                    <span class="data-label">Total Output</span>
                    <span class="output-value">${parseInt(m.total_output).toLocaleString('id-ID')}</span>
                </div>
                <div style="flex: 2;">
                    <div class="d-flex align-items-center">
                        <div class="progress-container me-3">
                            <div class="custom-progress shadow-sm">
                                <div class="bar-fill" style="width: ${isValidTarget ? oee : 100}%; background-color: ${colorCode};"></div>
                            </div>
                        </div>
                        <span class="fw-bold" style="color: ${colorCode}; font-size: ${isValidTarget ? '1rem' : '0.7rem'}; width: 60px;">${oeeText}</span>
                    </div>
                </div>
                <div style="flex: 0.3; text-align: right;">
                    <button
                        type="button"
                        class="btn btn-sm btn-light rounded-circle shadow-sm"
                        data-row-id="${m.id}"
                        data-device-id="${m.device_id}"
                        data-sku="${m.sku}"
                        onclick="openEditModal(this)">
                        <i class="fas fa-edit text-primary"></i>
                    </button>
                </div>
            </div>
        `);
    });
}

function filterData() {
    const val = document.getElementById('searchInput').value.toLowerCase();
    const items = document.querySelectorAll('.machine-item');
    const headers = document.querySelectorAll('.machine-item-header');
    
    if(val === "") { headers.forEach(h => h.style.display = 'flex'); } 
    else { headers.forEach(h => h.style.display = 'none'); }

    items.forEach(item => {
        const name = item.getAttribute('data-name').toLowerCase();
        const sku = item.getAttribute('data-sku').toLowerCase();
        item.style.display = (name.includes(val) || sku.includes(val)) ? 'flex' : 'none';
    });
}

function renderPagination(totalPages, activePage) {
    const controls = document.getElementById('pagination-controls');
    controls.innerHTML = '';
    const addPage = (p, label, isPrevNext = false) => {
        const disabled = (isPrevNext && (p < 1 || p > totalPages)) || (!isPrevNext && p === activePage);
        controls.insertAdjacentHTML('beforeend', `
            <li class="page-item ${disabled ? 'disabled' : ''} ${!isPrevNext && p === activePage ? 'active' : ''}">
                <a class="page-link shadow-sm mx-1 rounded-2" href="javascript:void(0)" onclick="${!disabled ? 'loadOEEData(' + p + ')' : ''}">${label}</a>
            </li>`);
    };
    addPage(activePage - 1, '<i class="fas fa-chevron-left"></i>', true);
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= activePage - 1 && i <= activePage + 1)) addPage(i, i);
    }
    addPage(activePage + 1, '<i class="fas fa-chevron-right"></i>', true);
}

function openEditModal(button) {
    const rowId = button.dataset.rowId;
    const deviceId = button.dataset.deviceId;
    const currentSku = button.dataset.sku;

    document.getElementById('modal-machine-name').innerText = deviceId;
    document.getElementById('edit-row-id').value = rowId;
    document.getElementById('edit-device-id').value = deviceId;
    const select = document.getElementById('select-sku');
    
    let list = [];
    if (deviceId.includes('AHP')) {
        list = <?php echo json_encode(array_keys($TARGETS_AHP)); ?>;
    } else if (deviceId === 'BHP 4' || deviceId === 'BHP 5') {
        list = <?php echo json_encode(array_values(array_unique(array_merge(array_keys($TARGETS_BHP), array_keys($TARGETS_HIGH_SPEED))))); ?>;
    } else {
        list = <?php echo json_encode(array_keys($TARGETS_BHP)); ?>;
    }

    select.innerHTML = '';
    list.forEach(sku => {
        const opt = document.createElement('option');
        opt.value = sku; opt.text = sku; opt.selected = (sku === currentSku);
        select.appendChild(opt);
    });
    if (!editModalInstance) editModalInstance = new bootstrap.Modal(document.getElementById('modalEditSKU'));
    editModalInstance.show();
}

document.getElementById('formEditSKU').onsubmit = function(e) {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('row_id', document.getElementById('edit-row-id').value);
    formData.append('device_id', document.getElementById('edit-device-id').value);
    formData.append('sku', document.getElementById('select-sku').value);

    fetch('update_sku.php', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            editModalInstance.hide();
            Swal.fire({ title: 'Updated!', icon: 'success', timer: 1500, showConfirmButton: false });
            loadOEEData(currentPage);
        } else {
            Swal.fire({ title: 'Gagal update', text: res.error || 'Unknown error', icon: 'error' });
        }
    });
};

document.addEventListener('DOMContentLoaded', () => loadOEEData(1));
</script>

<?php include 'footer.php'; ?>
