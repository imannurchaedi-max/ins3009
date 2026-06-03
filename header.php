<?php
session_start();
if (!isset($_SESSION['status']) || $_SESSION['status'] != "login") {
    header("Location: login.php");
    exit();    
}
include_once 'functions.php';
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Engineering Department | PT DAM</title>
    <link rel="icon" type="image/png" href="img/logo1.png?v=1.1">
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style>
        :root { 
            --primary-blue: #0984e3;
            --dark-navy: #2d3436;
            --sidebar-bg: #1e272e;
            --bg-light: #f1f4f7;
            --sidebar-width: 260px;
            --sidebar-collapsed: 80px;
        }

        body { 
            background-color: var(--bg-light); 
            font-family: 'Inter', sans-serif; 
            margin: 0; 
            display: flex; 
            min-height: 100vh;
        }

        /* --- SIDEBAR REFINED --- */
        .sidebar { 
            width: var(--sidebar-width); 
            background: var(--sidebar-bg); 
            color: white; 
            position: fixed; 
            height: 100vh; 
            z-index: 1500; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 5px 0 20px rgba(0,0,0,0.1);
        }

        body.collapsed .sidebar { width: var(--sidebar-collapsed); }

        .sidebar-header { 
            padding: 25px 15px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            text-align: center;
            overflow: hidden;
        }

        .sidebar-brand { 
            font-size: 1.2rem; 
            font-weight: 800; 
            letter-spacing: 1px;
            color: #fff;
            text-transform: uppercase;
        }

        .sidebar-brand span { color: var(--primary-blue); }

        .sidebar-menu { list-style: none; padding: 20px 10px; margin: 0; }
        .sidebar-menu li { margin-bottom: 6px; }
        
        .sidebar-menu li a { 
            color: #b2bec3; 
            text-decoration: none; 
            padding: 12px 18px;
            display: flex; 
            align-items: center; 
            gap: 15px; 
            font-size: 0.9rem;
            font-weight: 500; 
            border-radius: 10px; 
            transition: 0.2s;
            white-space: nowrap;
        }

        .sidebar-menu li a i { font-size: 1.1rem; min-width: 25px; text-align: center; }
        
        .sidebar-menu li:hover a { 
            background: rgba(255,255,255,0.05); 
            color: #fff; 
        }

        .sidebar-menu li.active a { 
            background: linear-gradient(135deg, #0984e3 0%, #00a8ff 100%); 
            color: #fff;
            box-shadow: 0 4px 15px rgba(9, 132, 227, 0.3);
        }

        body.collapsed .sidebar-menu li a span, 
        body.collapsed .brand-full,
        body.collapsed .sidebar-header small { display: none; }

        /* --- HEADER EXECUTIVE --- */
        .main-content { 
            flex: 1; 
            margin-left: var(--sidebar-width); 
            transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        body.collapsed .main-content { margin-left: var(--sidebar-collapsed); }

        .main-header { 
            background: #fff; 
            height: 65px; 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            padding: 0 30px; 
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 15px rgba(0,0,0,0.03);
            border-bottom: 1px solid #e9ecef;
        }

        .toggle-btn {
            cursor: pointer; 
            background: #f8f9fa;
            border: 1px solid #dee2e6; 
            color: var(--dark-navy); 
            width: 38px; 
            height: 38px;
            border-radius: 8px; 
            display: flex; 
            align-items: center;
            justify-content: center; 
            transition: 0.2s;
        }

        .toggle-btn:hover { background: var(--primary-blue); color: #fff; border-color: var(--primary-blue); }

        .header-title {
            font-size: 0.85rem;
            font-weight: 800;
            color: var(--dark-navy);
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin: 0;
        }

        .header-clock {
            font-family: 'JetBrains Mono', monospace;
            background: #f1f2f6;
            padding: 6px 15px;
            border-radius: 8px;
            color: var(--dark-navy);
            font-size: 0.95rem;
            font-weight: 700;
            border: 1px solid #dfe6e9;
        }

        .status-badge {
            font-size: 0.65rem;
            font-weight: 800;
            padding: 4px 12px;
            border-radius: 20px;
            background: #e1faf1;
            color: #2ecc71;
            border: 1px solid #b7f1da;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .status-dot {
            width: 7px; height: 7px; background: #2ecc71; border-radius: 50%;
            animation: blink 1.5s infinite;
        }

        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

        .logout-pill {
            background: #fff5f5;
            color: #ff7675;
            font-weight: 700;
            font-size: 0.75rem;
            padding: 8px 16px;
            border-radius: 8px;
            text-decoration: none;
            border: 1px solid #ffebeb;
            transition: 0.2s;
        }

        .logout-pill:hover { background: #ff7675; color: white; border-color: #ff7675; }

        .user-info-text { line-height: 1.2; text-align: right; }
    </style>
</head>

<body class="collapsed"> 

<nav class="sidebar">
    <div class="sidebar-header">
        <h5 class="sidebar-brand">
            <span class="brand-full">PT <span>DAM</span></span>
            <span class="brand-short" style="display:none; color:var(--primary-blue); font-weight:900;">DAM</span>
        </h5>
        <small style="font-size: 0.55rem; color: #636e72; font-weight:700; letter-spacing: 2px;">ENGINEERING DEPARTMENT</small>
    </div>

    <ul class="sidebar-menu">
        <li class="<?= (basename($_SERVER['PHP_SELF']) == 'index.php') ? 'active' : '' ?>">
            <a href="index.php"><i class="fas fa-chart-pie"></i> <span>Dashboard</span></a>
        </li>
        <li class="<?= (basename($_SERVER['PHP_SELF']) == 'speed.php') ? 'active' : '' ?>">
            <a href="speed.php"><i class="fas fa-gauge-high"></i> <span>Machine Speed</span></a>
        </li>
        <li class="<?= (basename($_SERVER['PHP_SELF']) == 'output.php') ? 'active' : '' ?>">
            <a href="output.php"><i class="fas fa-boxes-stacked"></i> <span>Production</span></a>
        </li>
        <li class="<?= (basename($_SERVER['PHP_SELF']) == 'oee.php') ? 'active' : '' ?>">
            <a href="oee.php"><i class="fas fa-chart-line"></i> <span>OEE Analytics</span></a>
        </li>
        
        <!-- NEW MENU: System Configuration -->
        <li class="<?= (basename($_SERVER['PHP_SELF']) == 'settings.php') ? 'active' : '' ?>">
            <a href="settings.php"><i class="fas fa-cogs"></i> <span>Configuration</span></a>
        </li>
    </ul>

    <div style="position: absolute; bottom: 20px; width: 100%; text-align: center; opacity: 0.4;">
        <small style="font-size: 0.6rem; font-weight: 700;">SYSTEM V1.0.4</small>
    </div>
</nav>

<div class="main-content">
    <header class="main-header">
        <div class="d-flex align-items-center gap-3">
            <button class="toggle-btn" onclick="toggleSidebar()">
                <i class="fas fa-bars"></i>
            </button>
            <div>
                <h1 class="header-title">Monitoring Production</h1>
                <div class="status-badge">
                    <div class="status-dot"></div> SERVER ONLINE
                </div>
            </div>
        </div>

        <div class="d-flex align-items-center gap-4">
            <div id="liveClock" class="header-clock d-none d-lg-block">00:00:00</div>
            
            <div class="d-flex align-items-center gap-3 ps-3" style="border-left: 1px solid #eee;">
                <div class="user-info-text d-none d-md-block">
                    <div style="font-size: 0.8rem; font-weight: 800; color: var(--dark-navy);"><?= $_SESSION['nama'] ?? 'Administrator' ?></div>
                    <small style="font-size: 0.65rem; color: #95a5a6; font-weight: 700; text-transform: uppercase;">Engineering Department</small>
                </div>
                <a href="logout.php" class="logout-pill">
                    <i class="fas fa-power-off me-1"></i> LOGOUT
                </a>
            </div>
        </div>
    </header>

<script>
    function updateClock() {
        const now = new Date();
        document.getElementById('liveClock').textContent = now.getHours().toString().padStart(2, '0') + ":" + 
                        now.getMinutes().toString().padStart(2, '0') + ":" + 
                        now.getSeconds().toString().padStart(2, '0');
    }
    setInterval(updateClock, 1000);
    updateClock();

    function handleBrandText(isCollapsed) {
        const full = document.querySelector('.brand-full');
        const short = document.querySelector('.brand-short');
        if (full && short) {
            full.style.display = isCollapsed ? 'none' : 'block';
            short.style.display = isCollapsed ? 'block' : 'none';
        }
    }

    function toggleSidebar() {
        const isCollapsed = document.body.classList.toggle('collapsed');
        localStorage.setItem('sidebarStatus', isCollapsed ? 'closed' : 'open');
        handleBrandText(isCollapsed);
        setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 300);
    }

    document.addEventListener("DOMContentLoaded", function() {
        const savedStatus = localStorage.getItem('sidebarStatus');
        if (savedStatus === 'open') {
            document.body.classList.remove('collapsed');
            handleBrandText(false);
        } else {
            document.body.classList.add('collapsed');
            handleBrandText(true);
        }
    });
</script>