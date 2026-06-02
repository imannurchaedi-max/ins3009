import os
import re

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"
home_code_path = os.path.join(base_dir, "HOME_PORTAL", "Code.js")

with open(home_code_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update getModuleUrls
new_get_module_urls = """function getModuleUrls() {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('CONFIG_MODUL');
    if (!sheet) {
      sheet = ss.insertSheet('CONFIG_MODUL');
      sheet.appendRow(['NAMA_MODUL', 'LINK_MODUL']);
      sheet.getRange("A1:B1").setFontWeight("bold");
    }
    
    const data = sheet.getDataRange().getValues();
    const urls = {
      GATE_PABRIK: '',
      AREA_KERJA: '',
      REPORT: ''
    };
    
    for (let i = 1; i < data.length; i++) {
      const name = asText(data[i][0]).toUpperCase();
      const link = asText(data[i][1]);
      if (name === 'GATE_PABRIK') urls.GATE_PABRIK = link;
      if (name === 'AREA_KERJA') urls.AREA_KERJA = link;
      if (name === 'REPORT') urls.REPORT = link;
    }
    
    return urls;
  } catch(e) {
    Logger.log("Error getModuleUrls: " + e.message);
    return { GATE_PABRIK: '', AREA_KERJA: '', REPORT: '' };
  }
}
"""
content = re.sub(r"const MODULE_URLS = \{[\s\S]*?function getModuleUrls\(\) \{[\s\S]*?\n\}\n", new_get_module_urls, content)

# 2. Update doGet for setupConfig endpoint
new_doget = """function doGet(e) {
  if (e.parameter.action === 'setupConfig') {
    try {
      const ss = getSpreadsheet();
      let sheet = ss.getSheetByName('CONFIG_MODUL');
      if (!sheet) {
        sheet = ss.insertSheet('CONFIG_MODUL');
        sheet.appendRow(['NAMA_MODUL', 'LINK_MODUL']);
        sheet.getRange("A1:B1").setFontWeight("bold");
      }
      
      // Clear existing config data
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
      }
      
      const rows = [
        ['GATE_PABRIK', e.parameter.gate || ''],
        ['AREA_KERJA', e.parameter.area || ''],
        ['REPORT', e.parameter.report || '']
      ];
      
      sheet.getRange(2, 1, 3, 2).setValues(rows);
      return HtmlService.createHtmlOutput('OK: Config saved successfully.');
    } catch(err) {
      return HtmlService.createHtmlOutput('ERROR: ' + err.message);
    }
  }

  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('DAM Access Control')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}"""

content = re.sub(r"function doGet\(e\) \{[\s\S]*?setXFrameOptionsMode\(HtmlService\.XFrameOptionsMode\.ALLOWALL\);\n\}", new_doget, content)

with open(home_code_path, "w", encoding="utf-8") as f:
    f.write(content)

print("HOME_PORTAL/Code.js updated for dynamic config.")
