import os
import re

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"
modules = ["MODUL_GATE_PABRIK", "MODUL_AREA_KERJA", "MODUL_REPORT"]

new_doget = """function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  // Pass URL parameter 'nik' to frontend if exists
  template.sessionNik = (e.parameter.nik) ? e.parameter.nik : '';
  return template
    .evaluate()
    .setTitle('DAM Access - Module')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}"""

for mod in modules:
    code_js_path = os.path.join(base_dir, mod, "Code.js")
    with open(code_js_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace doGet
    content = re.sub(r"function doGet\(e\) \{[\s\S]*?\n\}", new_doget, content, count=1)
    
    with open(code_js_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    # Inject token reading into app.html
    app_html_path = os.path.join(base_dir, mod, "app.html")
    with open(app_html_path, "r", encoding="utf-8") as f:
        app_content = f.read()
        
    inject_auth = """
// ── Session Auto-Login (From Token) ──────────────────────
document.addEventListener("DOMContentLoaded", function() {
   const sessionNik = "<?= sessionNik ?>";
   if (sessionNik) {
       // Mock auto login via backend
       google.script.run
         .withSuccessHandler(res => {
             if(res.ok) {
                 STATE.currentUser = res.karyawan;
                 applyRolePermissions(res.karyawan.role);
             } else {
                 alert("Sesi tidak valid atau NIK salah.");
             }
         })
         .verifyLogin(sessionNik, "");
   } else {
       alert("Akses ditolak. Anda harus mengakses modul ini melalui Home Portal.");
   }
});
"""
    if "<?= sessionNik ?>" not in app_content:
        app_content = app_content.replace("// ── AUTHENTICATION ─────────────────────────────────────────", "// ── AUTHENTICATION ─────────────────────────────────────────\n" + inject_auth)
    
    with open(app_html_path, "w", encoding="utf-8") as f:
        f.write(app_content)

print("Module Auth Configured.")
