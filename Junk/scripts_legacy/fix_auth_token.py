"""Patch HOME_PORTAL app.html: simpan token + kirim via switchTab"""
import os

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(base, 'active', 'HOME_PORTAL', 'app.html')

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Patch 1: line 291 (0-indexed: 290) - after STATE.currentUser, insert token save
lines.insert(291, '      if (res.token) { STATE.sessionToken = res.token; localStorage.setItem("dam_token", res.token); }\n')

# Patch 2: line 321 (0-indexed: 320) - buildModuleTokenParams: use token first
old_line_321 = '  if (STATE.currentUser && STATE.currentUser.nik) params.set(\'nik\', STATE.currentUser.nik);\n'
new_line_321 = '  if (STATE.sessionToken) { params.set("token", STATE.sessionToken); } else if (STATE.currentUser && STATE.currentUser.nik) { params.set("nik", STATE.currentUser.nik); }\n'
# after insertion, line 321 shifted to 322
actual_321 = lines[321].rstrip()
# let's just replace the right pattern
for i, line in enumerate(lines):
    if 'params.set(\'nik\', STATE.currentUser.nik);' in line and 'STATE.currentUser' in line:
        lines[i] = '  if (STATE.sessionToken) { params.set("token", STATE.sessionToken); } else if (STATE.currentUser && STATE.currentUser.nik) { params.set("nik", STATE.currentUser.nik); }\n'
        break

# Patch 3: line 342 (0-indexed: 341) - switchTab token
for i, line in enumerate(lines):
    if "const token = '?nik=' + (STATE.currentUser" in line:
        lines[i] = '  const token = (STATE.sessionToken) ? "?token=" + STATE.sessionToken : "?nik=" + (STATE.currentUser ? STATE.currentUser.nik : "");\n'
        break

# Patch 4: handleLogout - also clear token
for i, line in enumerate(lines):
    if "localStorage.removeItem('dam_session');" in line and 'handleLogout' in ''.join(lines[max(0,i-5):i+5]):
        # after this line, also remove dam_token
        indent = line[:len(line) - len(line.lstrip())]
        # find next line to verify it's STATE.currentUser = null
        break

# Just append token removal after dam_session removal in handleLogout
for i, line in enumerate(lines):
    if "localStorage.removeItem('dam_session');" in line:
        lines[i] = '  localStorage.removeItem("dam_session");\n  localStorage.removeItem("dam_token");\n  STATE.sessionToken = null;\n'
        break

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Patched successfully")
print(f"Total lines: {len(lines)}")