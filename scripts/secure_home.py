import os
import re
import subprocess

base_dir = r"c:\Users\imann\SynologyDrive\APP SCRIPT\EMPLOYE TRACKER"
home_code_path = os.path.join(base_dir, "HOME_PORTAL", "Code.js")

with open(home_code_path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove the setupConfig block
safe_doget = """function doGet(e) {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('DAM Access Control')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}"""

content = re.sub(r"function doGet\(e\) \{[\s\S]*?setXFrameOptionsMode\(HtmlService\.XFrameOptionsMode\.ALLOWALL\);\n\}", safe_doget, content)

with open(home_code_path, "w", encoding="utf-8") as f:
    f.write(content)

# Push the fix
subprocess.run(["clasp", "push", "--force"], cwd=os.path.join(base_dir, "HOME_PORTAL"), shell=True)
print("Backdoor removed and code pushed.")
