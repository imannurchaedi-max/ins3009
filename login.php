<?php
session_start();
include 'config.php';

if (isset($_SESSION['status']) && $_SESSION['status'] == 'login') {
    header("Location: index.php");
    exit();
}

if (isset($_POST['login'])) {
    $username = $_POST['username'] ?? '';
    $rawPass = $_POST['password'] ?? '';
    
    if (empty($username) || empty($rawPass)) {
        $error = "Akses ditolak! Username atau Password tidak boleh kosong.";
    } else {
        $password = md5($rawPass); 

        $query = "SELECT * FROM users WHERE username = :user AND password = :pass";
        $stmt = $pdo->prepare($query);
        $stmt->execute(['user' => $username, 'pass' => $password]);
        $user = $stmt->fetch();

        if ($user) {
            session_regenerate_id(true);
            $_SESSION['status'] = 'login';
            $_SESSION['user'] = $user['username'];
            $_SESSION['nama'] = $user['nama_lengkap'];
            header("Location: index.php");
            exit;
        } else {
            $error = "Akses ditolak! Username atau Password salah.";
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Dashboard | PT DAM</title>
    <link rel="icon" type="image/png" href="img/logo1.png?v=1.1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Inter:wght@300;400;600;800&display=swap');

        :root {
            --primary-blue: #3498db;
            --accent-glow: rgba(52, 152, 219, 0.4);
            --dark-bg: #0f172a;
        }

        body {
            background-color: var(--dark-bg);
            background-image: radial-gradient(circle at 20% 30%, rgba(52, 152, 219, 0.15) 0%, transparent 40%),
                              radial-gradient(circle at 80% 70%, rgba(52, 152, 219, 0.1) 0%, transparent 40%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', sans-serif;
            margin: 0;
            color: white;
        }

        .main-container {
            display: flex;
            width: 900px;
            max-width: 95%;
            background: rgba(30, 41, 59, 0.5);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        /* Sisi Kiri: Welcome Message */
        .welcome-side {
            flex: 1;
            /* --- FIX PEWARNAAN GAMBAR DI SINI --- */
            /* Kita pake gradient gelap ke transparan biar teks kontras */
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.4) 100%),
                        
                        /* Pastiin nama file gambar lu bener di sini */
                        url('img/mesin_dam.png'); 
            /* -------------------------------------- */
            
            background-size: cover;
            background-position: center;
            padding: 40px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            position: relative; /* Buat ngunci pseudo-element */
        }

        /* --- TRIK BUAT FONT LEBIH KELIHATAN (Shadow) --- */
        .welcome-side h1 {
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            font-size: 1.8rem;
            margin-bottom: 20px;
            line-height: 1.4;
            color: white; /* Font tetep putih */
            /* Tambahin shadow biar "lepas" dari background terang */
            text-shadow: 0 4px 10px rgba(0, 0, 0, 0.9); 
        }

        .welcome-side p {
            font-size: 0.9rem;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.95); /* Putih tebel */
            /* Shadow tipis */
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
        }

        /* Sisi Kanan: Form Login */
        .login-side {
            width: 400px;
            padding: 40px;
            background: rgba(15, 23, 42, 0.8);
            position: relative;
        }

        @media (max-width: 768px) {
            .welcome-side { display: none; }
            .main-container { width: 400px; }
        }

        .brand-logo {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.2rem;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }

        .brand-logo span { color: var(--primary-blue); }

        .subtitle {
            font-size: 0.65rem;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 30px;
        }

        .form-label {
            font-size: 0.75rem;
            font-weight: 600;
            color: #94a3b8;
            margin-bottom: 8px;
        }

        .form-control {
            background: rgba(30, 41, 59, 0.7) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 12px !important;
            color: #ffffff !important;
            padding: 12px 15px;
            transition: all 0.3s;
        }

        .form-control:focus {
            border-color: var(--primary-blue) !important;
            box-shadow: 0 0 0 4px var(--accent-glow);
        }

        .btn-login {
            background: var(--primary-blue);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.85rem;
            font-weight: 700;
            color: white;
            width: 100%;
            margin-top: 20px;
            transition: all 0.3s;
        }

        .btn-login:hover {
            background: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(52, 152, 219, 0.3);
        }

        .error-msg {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid #ef4444;
            color: #f87171;
            padding: 12px;
            border-radius: 10px;
            font-size: 0.75rem;
            margin-bottom: 20px;
        }

        .footer-copyright {
            margin-top: 40px;
            font-size: 0.65rem;
            color: #64748b;
            text-align: center;
        }

        /* Animasi garis scan */
        .scan-line {
            width: 100%; height: 1px;
            background: linear-gradient(to right, transparent, var(--primary-blue), transparent);
            position: absolute; left: 0; top: 0;
            animation: scan 3s linear infinite;
        }

        @keyframes scan {
            0% { top: 0; }
            100% { top: 100%; }
        }
    </style>
</head>
<body>

    <div class="main-container">
        <div class="welcome-side">
            
            <h1>Selamat Datang di<br>Dashboard Machine</h1>
            <p>PT Daya Anugrah Mulya - Engineering Monitoring System v1.0.4. Pantau performa produksi secara real-time dan akurat.</p>
            <div class="mt-4">
                <div class="badge bg-dark p-2" style="font-family: 'Orbitron'; font-size: 0.6rem;">SYSTEM STATUS: ONLINE</div>
            </div>
        </div>

        <div class="login-side">
            <div class="scan-line"></div>
            
            <div class="brand-logo">PT DAM<span> ENGINEERING</span></div>
            <div class="subtitle">Secure Authorization</div>

            <?php if(isset($error)): ?>
                <div class="error-msg">
                    ⚠️ <?= $error ?>
                </div>
            <?php endif; ?>

            <form method="POST">
                <div class="mb-3">
                    <label class="form-label text-uppercase">Username</label>
                    <input type="text" name="username" class="form-control" placeholder="Input User ID" required autofocus>
                </div>
                <div class="mb-4">
                    <label class="form-label text-uppercase">Access Password</label>
                    <input type="password" name="password" class="form-control" placeholder="••••••••" required>
                </div>
                <button type="submit" name="login" class="btn-login">LOGIN</button>
            </form>

            <div class="footer-copyright text-uppercase">
                &copy; 2026 PT Daya Anugrah Mulya<br>
                All rights reserved
            </div>
        </div>
    </div>

</body>
</html>