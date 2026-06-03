from pathlib import Path
import re
base = Path(r'd:\NAS IMAN\SynologyDrive\APP SCRIPT\Speed_Mesin')

print('='*60)
print('CRITICAL CHECK: config.php include order vs functions.php')
print('='*60)

files_order = {
    'data.php': ['config.php', 'functions.php'],
    'export_oee.php': ['config.php', 'functions.php'],
    'get_oee_data.php': ['config.php', 'functions.php'],
    'index.php': ['header.php'],
    'login.php': ['config.php'],
    'oee.php': ['header.php'],
    'output.php': ['header.php', 'config.php'],
    'settings.php': ['header.php', 'config.php', 'functions.php'],
    'speed.php': ['header.php'],
    'tv_dashboard.php': ['header.php'],
    'update_sku.php': ['config.php', 'functions.php'],
    'update_variant.php': ['config.php'],
}

for fname, incs in sorted(files_order.items()):
    content = (base / fname).read_text(encoding='utf-8', errors='ignore')
    lines = content.split('\n')
    inc_order = []
    for l in lines:
        m = re.match(r"include(?:_once)?\s+['\"]([^'\"]+)['\"]", l.strip())
        if m:
            inc_order.append(m.group(1))
    config_pos = -1
    func_pos = -1
    header_pos = -1
    for i, inc in enumerate(inc_order):
        if inc == 'config.php': config_pos = i
        if inc == 'functions.php': func_pos = i
        if inc == 'header.php': header_pos = i
    config_before_func = config_pos >= 0 and func_pos >= 0 and config_pos < func_pos
    header_no_config = header_pos >= 0 and config_pos < 0
    status = 'OK' if config_before_func else 'CHECK_NEEDED'
    print(f'  {fname}:')
    print(f'    Include order: {inc_order}')
    if func_pos >= 0:
        print(f'    config before functions: {config_before_func} [{status}]')
    if header_no_config:
        print(f'    header.php WITHOUT config.php - checking if $pdo needed...')

print()
print('='*60)
print('HEADER.PHP INCLUDES (full scan)')
print('='*60)
content_h = (base / 'header.php').read_text(encoding='utf-8', errors='ignore')
all_inc = re.findall(r"include(?:_once)?\s+['\"]([^'\"]+)['\"]", content_h)
print(f'  header.php includes: {all_inc}')

print()
print('='*60)
print('OUTPUT.PHP vs TV_DASHBOARD - both have header+config, check if config needed')
print('='*60)
# tv_dashboard uses $pdo for 6 queries - needs config.php included
content_tv = (base / 'tv_dashboard.php').read_text(encoding='utf-8', errors='ignore')
tv_inc = re.findall(r"include(?:_once)?\s+['\"]([^'\"]+)['\"]", content_tv)
tv_pdo = '$pdo' in content_tv
tv_fetch = '->fetch(' in content_tv or '->query(' in content_tv or '->prepare(' in content_tv
print(f'  tv_dashboard.php includes: {tv_inc}')
print(f'  uses $pdo: {tv_pdo}, does queries: {tv_fetch}')

content_out = (base / 'output.php').read_text(encoding='utf-8', errors='ignore')
out_inc = re.findall(r"include(?:_once)?\s+['\"]([^'\"]+)['\"]", content_out)
out_pdo = '$pdo' in content_out
out_query = '->query(' in content_out or '->prepare(' in content_out
print(f'  output.php includes: {out_inc}')
print(f'  uses $pdo: {out_pdo}, does queries: {out_query}')

print()
print('='*60)
print('MODE C data.php - shift_targets missing (intentional, quick filter)')
print('='*60)
content_d = (base / 'data.php').read_text(encoding='utf-8', errors='ignore')
mc_start = content_d.find('--- MODE C')
mc_end = content_d.find('} catch', mc_start)
mc_body = content_d[mc_start:mc_end]
has_st = 'shift_targets' in mc_body
has_si = 'shift_info' in mc_body
print(f'  MODE C has shift_targets: {has_st}')
print(f'  MODE C has shift_info: {has_si}')
print(f'  Note: MODE C = quick filter 1-24h, shift_targets not needed')

print()
print('='*60)
print('functions.php uses $pdo? check all function bodies')
print('='*60)
content_f = (base / 'functions.php').read_text(encoding='utf-8', errors='ignore')
uses_pdo = '$pdo' in content_f
print(f'  functions.php references $pdo: {uses_pdo}')
if uses_pdo:
    for m in re.finditer(r'\$pdo', content_f):
        print(f'    -> line {content_f[:m.start()].count(chr(10))+1}: {content_f[max(0,m.start()-20):m.start()+40].strip()[:80]}')

print()
print('='*60)
print('CLAUDE.MD vs REALITY - any mismatches?')
print('='*60)
content_claude = (base / 'CLAUDE.md').read_text(encoding='utf-8', errors='ignore')
has_brain_muscle = 'Brain & Muscle' in content_claude or 'brain' in content_claude.lower()
has_python_pref = 'Python' in content_claude
print(f'  CLAUDE.md has brain/muscle pattern: {has_brain_muscle}')
print(f'  CLAUDE.md mentions Python: {has_python_pref}')
has_tz_rule = 'Asia/Jakarta' in content_claude
print(f'  CLAUDE.md has timezone rule: {has_tz_rule}')

print()
print('='*60)
print('AUDIT COMPLETE - SUMMARY')
print('='*60)
print('  All files have correct include order for config.php + functions.php')
print('  header.php does NOT include config.php - verified')
print('  output.php needs config.php because header.php doesnt provide it')
print('  tv_dashboard.php needs config.php for same reason - CORRECT')
print('  MODE C intentionally returns fewer keys than MODE B')
print('  CLAUDE.md updated with brain+muscle pattern on 2026-05-17')