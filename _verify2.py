from pathlib import Path
import re
base = Path(r'd:\NAS IMAN\SynologyDrive\APP SCRIPT\Speed_Mesin')

# Check export_oee shift boundaries
content = (base / 'export_oee.php').read_text(encoding='utf-8', errors='ignore')
print('export_oee.php shift boundaries:')
for m in re.finditer(r'(WHEN.*?THEN|ELSE)', content):
    print(' ', m.group(0).strip()[:100])

print()
# Check header.php includes
content_h = (base / 'header.php').read_text(encoding='utf-8', errors='ignore')
print('header.php includes:')
for m in re.finditer(r"include\s+['\"]([^'\"]+)['\"]", content_h):
    print(' ', m.group(1))

print()
# MODE C return keys
content_d = (base / 'data.php').read_text(encoding='utf-8', errors='ignore')
mc = content_d.find('--- MODE C')
keys = re.findall(r'"([a-z_]+)"\s*=>', content_d[mc:mc+3000])
print('MODE C keys:')
for k in sorted(set(keys)): print(f'  {k}')

print()
# MODE C hours cast
idx = content_d.find('$hours = (float)')
print('hours cast:', content_d[idx:idx+50].strip() if idx >= 0 else 'NOT FOUND')

print()
# output.php has header+config - check header includes config?
print('output.php top 4 lines:')
lines = (base / 'output.php').read_text(encoding='utf-8', errors='ignore').split('\n')
for l in lines[:4]: print(' ', l)

print()
# check functions.php timezone set
content_f = (base / 'functions.php').read_text(encoding='utf-8', errors='ignore')
has_tz = 'date_default_timezone_set' in content_f
print(f'functions.php has timezone_set: {has_tz}')