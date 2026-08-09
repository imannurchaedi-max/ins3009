// ============================================================
//  LEGACY MODULE REDIRECTOR
//  PT Daya Anugrah Mulya
//  This module is obsolete. It redirects all traffic to HOME_PORTAL.
// ============================================================

function doGet(e) {
  var url = "https://script.google.com/macros/s/AKfycbw4I2Vxh_CKH2k1RHCtvqZwJ1fGwyb0LKeC4MPzEoVibhlSF0lSf5sYeuppZ3BBgp-x/exec";
  
  // Forward legacy parameters to HOME_PORTAL tabs
  if (e && e.parameter) {
     let tab = e.parameter.tab || '';
     if (e.parameter.page === 'gate') tab = 'masuk';
     if (e.parameter.page === 'keluar') tab = 'keluar';
     if (e.parameter.page === 'security') tab = 'security';
     if (e.parameter.page === 'report') tab = 'dashboard';
     if (tab) {
       url += (url.indexOf('?') > -1 ? '&' : '?') + 'tab=' + encodeURIComponent(tab);
     }
  }
  
  var html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="0; url=${url}">
        <title>Redirecting...</title>
        <style>
          body { font-family: sans-serif; padding: 40px; text-align: center; background: #f4f6f8; color: #333; }
          .box { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: inline-block; max-width: 400px; }
          a { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #1f5f97; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>Sistem Telah Diperbarui</h2>
          <p>Anda sedang mengakses modul versi lama. Anda akan dialihkan secara otomatis ke <b>Portal Utama DAM</b>.</p>
          <p>Jika tidak dialihkan secara otomatis, silakan klik tombol di bawah ini:</p>
          <a href="${url}">Masuk ke Portal Utama</a>
        </div>
      </body>
    </html>
  `);
  return html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
