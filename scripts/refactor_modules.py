import os
import re

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"

# --- HOME PORTAL ---
home_portal_dir = os.path.join(base_dir, "HOME_PORTAL")

# Edit Code.js
with open(os.path.join(home_portal_dir, "Code.js"), "r", encoding="utf-8") as f:
    code_js = f.read()

# Add MODULE_URLS config at the top after constants
config_str = """
const MODULE_URLS = {
  GATE_PABRIK: 'URL_GATE_PABRIK_ISI_DISINI',
  AREA_KERJA: 'URL_AREA_KERJA_ISI_DISINI',
  REPORT: 'URL_REPORT_ISI_DISINI'
};

function getModuleUrls() {
  return MODULE_URLS;
}
"""
code_js = code_js.replace("const SHEET_RECAP_ABSEN       = 'ABSEN IN OUT MK';", "const SHEET_RECAP_ABSEN       = 'ABSEN IN OUT MK';\n" + config_str)

# Remove unused functions from HOME_PORTAL/Code.js using regex
def remove_func(text, func_name):
    pattern = re.compile(r"function\s+" + func_name + r"\s*\([\s\S]*?\n}\n", re.MULTILINE)
    return pattern.sub("", text)

funcs_to_remove = [
    "getRecapStatus", "makeRecapKey", "updateRecapAbsen", "safeUpdateRecapAbsen", 
    "rebuildRecapAbsenInOutMK", "syncRecapAbsenInOutMK", "getAbsenReport", "getAreaActivityReport",
    "getBindingStatus", "bindKartu", "releaseKartu", "scanAreaKerja"
]
for fn in funcs_to_remove:
    code_js = remove_func(code_js, fn)

with open(os.path.join(home_portal_dir, "Code.js"), "w", encoding="utf-8") as f:
    f.write(code_js)

# Edit Index.html
with open(os.path.join(home_portal_dir, "Index.html"), "r", encoding="utf-8") as f:
    index_html = f.read()

# Remove pages from Index.html
def remove_html_block(text, start_str, end_str):
    idx1 = text.find(start_str)
    if idx1 == -1: return text
    idx2 = text.find(end_str, idx1)
    if idx2 == -1: return text
    return text[:idx1] + text[idx2 + len(end_str):]

index_html = remove_html_block(index_html, '<div id="page-masuk"', "</div>\n</div>")
index_html = remove_html_block(index_html, '<div id="page-export-laporan"', "</div>\n</div>")
index_html = remove_html_block(index_html, '<div id="page-revisi-catatan"', "</div>\n</div>")
index_html = remove_html_block(index_html, '<div id="page-keluar"', "</div>\n</div>")
index_html = remove_html_block(index_html, '<div id="page-security"', "</div>\n</div>")
index_html = remove_html_block(index_html, '<div id="page-cek-absen"', "</div>\n</div>")
index_html = remove_html_block(index_html, '<div id="page-cek-area"', "</div>\n</div>")

with open(os.path.join(home_portal_dir, "Index.html"), "w", encoding="utf-8") as f:
    f.write(index_html)

print("HOME_PORTAL basic refactor done.")
