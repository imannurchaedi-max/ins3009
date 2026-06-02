import os
import shutil
import re

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
modules = ["MODUL_GATE_PABRIK", "MODUL_AREA_KERJA", "MODUL_REPORT"]
files_to_copy = ["Code.js", "Index.html", "app.html", "style.html", "appsscript.json"]

MODULE_DO_GET = """function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.sessionNik = (e && e.parameter && e.parameter.nik) ? e.parameter.nik : '';
  return template
    .evaluate()
    .setTitle('DAM Access - Module')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
"""

def write_text(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def specialize_module_files(mod_dir):
    code_path = os.path.join(mod_dir, "Code.js")
    index_path = os.path.join(mod_dir, "Index.html")
    app_path = os.path.join(mod_dir, "app.html")

    with open(code_path, "r", encoding="utf-8") as f:
        code = f.read()
    code = re.sub(r"function doGet\(e\) \{[\s\S]*?\n\}", MODULE_DO_GET, code, count=1)
    write_text(code_path, code)

    with open(index_path, "r", encoding="utf-8") as f:
        index = f.read()
    if "GLOBAL_SESSION_NIK" not in index:
        index = re.sub(
            r"(?m)^(\s*<\?!= include\('style'\); \?>)",
            '  <script> const GLOBAL_SESSION_NIK = "<?= sessionNik ?>"; </script>\n\\1',
            index,
            count=1
        )
    write_text(index_path, index)

    with open(app_path, "r", encoding="utf-8") as f:
        app = f.read()
    app = re.sub(
        r"\n// Session Auto-Login \(From Token\)[\s\S]*?\.verifySession\(sessionNik\);\n\}\);",
        "",
        app,
        count=1
    )
    write_text(app_path, app)

# 1. Copy monolithic files to all modules (if not already there)
for mod in modules:
    mod_dir = os.path.join(base_dir, mod)
    if not os.path.exists(mod_dir):
        os.makedirs(mod_dir)
    for f in files_to_copy:
        src = os.path.join(base_dir, f)
        dst = os.path.join(mod_dir, f)
        if os.path.exists(src):
            shutil.copy2(src, dst)
    specialize_module_files(mod_dir)

# 2. Refactor HOME_PORTAL app.html to use redirects
home_app_path = os.path.join(base_dir, "HOME_PORTAL", "app.html")
with open(home_app_path, "r", encoding="utf-8") as f:
    home_app = f.read()

# Replace switchTab in HOME_PORTAL
new_switch_tab = """async function switchTab(tab) {
  const tabbar = document.getElementById('app-tabbar');
  const overlay = document.getElementById('sidebar-overlay');
  if (tabbar) tabbar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');

  if (tab === 'dashboard') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-dashboard').classList.add('active');
    document.getElementById('tab-btn-dashboard').classList.add('active');
    loadDashboard();
    return;
  }

  // Handle redirects for other modules
  let targetUrl = '';
  const token = '?nik=' + (STATE.currentUser ? STATE.currentUser.nik : '');
  
  google.script.run.withSuccessHandler(urls => {
      if (tab === 'masuk' || tab === 'keluar') targetUrl = urls.GATE_PABRIK + token;
      else if (tab === 'security') targetUrl = urls.AREA_KERJA + token;
      else if (tab.includes('cek') || tab.includes('export')) targetUrl = urls.REPORT + token;
      
      if (targetUrl) {
        window.location.href = targetUrl;
      } else {
        alert('URL Module belum dikonfigurasi!');
      }
  }).getModuleUrls();
}
"""

home_app = re.sub(r"async function switchTab\(tab\) \{[\s\S]*?\n\}", new_switch_tab, home_app, count=1)

with open(home_app_path, "w", encoding="utf-8") as f:
    f.write(home_app)


print("Microservices bootstrapped successfully.")
