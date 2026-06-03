#!/usr/bin/env python3
import os
import re

def check_sku_deployment():
    findings = []
    
    # 1. Cek update_variant.php untuk Validasi Input (Deployment)
    if os.path.exists("update_variant.php"):
        with open("update_variant.php", "r", encoding="utf-8") as f:
            content = f.read()
            if "TARGETS_BHP" not in content and "getTargetOutput" not in content:
                findings.append(
                    "[HIGH] update_variant.php: Tidak ada validasi array config sebelum INSERT. "
                    "User/sistem bisa memasukkan 'CODE-0' atau 'null' langsung ke sku_history."
                )

    # 2. Cek functions.php untuk handling spasi & default case
    if os.path.exists("functions.php"):
        with open("functions.php", "r", encoding="utf-8") as f:
            content = f.read()
            if "str_replace(' ', '', $sku)" in content:
                findings.append(
                    "[MEDIUM] functions.php: Spasi dihapus saat membaca (M 32 -> M32), "
                    "tapi di database tetap kotor. Seharusnya pembersihan (sanitize) dilakukan saat insert/deploy."
                )
            if "return -1" in content or "return isset" in content:
                findings.append(
                    "[HIGH] functions.php (getTargetOutput): Mengembalikan -1 jika SKU ('CODE-0' / 'null') tidak cocok. "
                    "Ini membuat target OEE tidak muncul / error di dashboard."
                )

    # 3. Cek settings.php terkait dropdown dan source of truth
    if os.path.exists("settings.php"):
        with open("settings.php", "r", encoding="utf-8") as f:
            content = f.read()
            if "SELECT DISTINCT sku_new FROM sku_history" in content:
                findings.append(
                    "[LOW] settings.php: Opsi dropdown SKU diambil dari histori tabel, BUKAN dari hardcoded config. "
                    "Jika database kotor oleh 'CODE-0', dropdown bisa ikut kotor."
                )

    return findings

if __name__ == "__main__":
    print("=== HASIL AUDIT SKU DEPLOYMENT ===")
    results = check_sku_deployment()
    for res in results:
        print("-", res)
