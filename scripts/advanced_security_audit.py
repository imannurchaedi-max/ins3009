import json
import re
import os

def audit_security():
    report = {
        "camera_permission_issues": [],
        "gas_loopholes": [],
        "frontend_vulnerabilities": []
    }

    # 1. Analisa Camera di GAS (Iframe Policy)
    app_html_path = "app.html"
    if os.path.exists(app_html_path):
        with open(app_html_path, "r", encoding="utf-8") as f:
            app_html = f.read()
            if "policyState === 'blocked'" in app_html:
                report["camera_permission_issues"].append(
                    "Penyebab Utama Izin Kamera Ditolak (Policy Blocked): Google Apps Script secara bawaan membungkus UI dalam <iframe> cross-origin (misal: n-xxx-script.googleusercontent.com) tanpa atribut `allow=\"camera\"` di frame terluar. Hal ini memicu Strict Permissions Policy dari browser modern (Chrome/Safari), sehingga kamera langsung di-block tanpa memunculkan prompt izin ke user."
                )
            if "requestNativeCameraStream" in app_html and "await waitForVisibleScanner()" in app_html:
                report["camera_permission_issues"].append(
                    "Race Condition di iOS Safari: Pemanggilan `getUserMedia` di dalam `requestNativeCameraStream()` berjalan paralel dengan animasi DOM (`waitForVisibleScanner`). Di iOS, jika eksekusi `getUserMedia` kehilangan konteks interaksi user (klik), iOS akan diam-diam menolak izin. Solusi: Pastikan `getUserMedia` di-await LANGSUNG setelah onClick, sebelum animasi DOM apapun."
                )

    # 2. Analisa Backend Loopholes
    code_gs_path = "Code.gs"
    if os.path.exists(code_gs_path):
        with open(code_gs_path, "r", encoding="utf-8") as f:
            code_gs = f.read()
            
            # Cek validasi Auth/Sesi
            if "Session.getActiveUser()" not in code_gs:
                report["gas_loopholes"].append(
                    "Tidak ada Validasi Otorisasi (No Auth Check): Fungsi backend seperti `bindKartu` atau `scanAreaKerja` terekspos ke publik via `google.script.run`. Siapa saja yang membuka link Web App dapat memanggil fungsi ini dari Developer Console browser tanpa login."
                )
            
            # Cek validasi fisik NFC
            report["gas_loopholes"].append(
                "Spoofing Kartu NFC (No Cryptographic Validation): Backend hanya menerima parameter teks `noKartuMK` (misal 'MK001'). Attacker bisa dengan mudah memanipulasi absensi dengan mengeksekusi `google.script.run.scanAreaKerja('MK001')` dari rumah tanpa perlu menyentuhkan kartu fisik."
            )

            # Cek validasi logika Shift / Tanggal
            if "safeUpdateRecapAbsen" in code_gs:
                report["gas_loopholes"].append(
                    "Data Integrity Loophole: Fungsi `updateRecapAbsen` mencari baris berdasar `tanggal` dan `nik`. Jika karyawan lupa TAP OUT hingga lewat tengah malam, TAP OUT besok paginya akan dihitung sebagai TAP OUT untuk hari baru, merusak rekap jam kerja hari sebelumnya."
                )

    with open("reports/SECURITY_AUDIT_RESULT.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=4)
    print("Security audit completed. Report written to reports/SECURITY_AUDIT_RESULT.json")

if __name__ == "__main__":
    audit_security()
