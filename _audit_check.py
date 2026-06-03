import re
from pathlib import Path

base = Path(r'd:\NAS IMAN\SynologyDrive\APP SCRIPT\Speed_Mesin')
php_files = {f.name: f.read_text(encoding='utf-8', errors='ignore') for f in sorted(base.glob('*.php'))}

# 1. INCLUDE CHAIN MAP
print('='*60)
print('1. INCLUDE CHAIN')
print('='*60)
include_re = re.compile(r"^(?:<\?php\s+)?include\s+['\"]([^'\"]+)['\"]", re.MULTILINE)
for fname, content in php_files.items():
    incs = include_re.findall(content)
    if incs:
        print(f'  {fname}: {incs}')

# 2. SHIFT BOUNDARY CONSISTENCY
print()
print('='*60)
print('2. SHIFT BOUNDARY CONSISTENCY')
print('='*60)
for fname, content in php_files.items():
    correct = re.findall(r"'06:00'|'14:00'|'22:00'|\"06:00|\"14:00|\"22:00", content)
    wrong = re.findall(r"'07:00'|'15:00'|'15:01'|\"07:00|\"15:00|\"15:01", content)
    if correct or wrong:
        print(f'  {fname}:')
        for m in sorted(set(correct)): print(f'    OK:     {m}')
        for m in sorted(set(wrong)): print(f'    WRONG:  {m}')

# 3. FUNCTION DEFINITIONS & CALLS
print()
print('='*60)
print('3. FUNCTION CALLS - UNDEFINED DETECTION')
print('='*60)
func_def_re = re.compile(r'function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(')
all_def_funcs = {}
for fname, content in php_files.items():
    for f in func_def_re.findall(content):
        all_def_funcs.setdefault(f, []).append(fname)

safe_funcs = {
    'echo','print','isset','empty','strlen','strpos','str_replace','strtoupper',
    'strtolower','trim','strip_tags','intval','floatval','round','floor','ceil',
    'min','max','abs','count','sizeof','in_array','array_key_exists','file',
    'file_exists','header','http_response_code','exit','die','json_encode',
    'json_decode','array_merge','array_filter','array_map','explode','implode',
    'sprintf','vsprintf','range','date','mktime','clone','PDO','Exception',
    'fetch','fetchAll','fetchColumn','execute','prepare','query','strftime',
    'preg_replace','preg_match','file_get_contents','set_time_limit','error_reporting',
    'array_keys','array_values','current','next','prev','reset','usort','ksort',
    'get_class','method_exists','property_exists','call_user_func','array_push',
    'array_pop','array_shift','array_unshift','join','substr','str_pad',
    'number_format','parse_str','header_remove','json_last_error',
    'usleep','microtime','random_int','random_bytes'
}
func_call_re = re.compile(r'(?<![a-zA-Z_])([a-zA-Z_][a-zA-Z0-9_]*)\s*\(')
all_calls = {}
for fname, content in php_files.items():
    lines = content.split('\n')
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('#') or stripped.startswith('*'):
            continue
        calls = func_call_re.findall(stripped)
        for c in calls:
            if c not in safe_funcs:
                all_calls.setdefault(c, []).append((fname, i+1, stripped[:90]))

undefined_funcs = []
for func, calls in sorted(all_calls.items()):
    if func not in all_def_funcs:
        undefined_funcs.append((func, calls))

if undefined_funcs:
    for func, calls in undefined_funcs:
        print(f'  UNDEFINED: {func}()')
        for f, ln, code in calls[:5]:
            print(f'    -> {f}:{ln}  {code}')
else:
    print('  Semua function call terdefinisi. OK.')

# 4. SQL NAMED PARAM BINDING
print()
print('='*60)
print('4. SQL NAMED PARAM BINDING')
print('='*60)
named_param_re = re.compile(r':([a-zA-Z_][a-zA-Z0-9_]*)')
named_call_re = re.compile(r'[\"\']+:([a-zA-Z_][a-zA-Z0-9_]*)\b')
issues_sql = []
for fname, content in php_files.items():
    stmts = list(re.finditer(r'\$stmt\s*=\s*\$pdo->prepare\s*\(\s*([\'"].+?[\'\"])\s*\)', content, re.DOTALL))
    for m in stmts:
        query = m.group(1)
        params_in_query = set(named_param_re.findall(query))
        rest = content[m.end():m.end()+500]
        exec_ms = list(re.finditer(r'->execute\s*\(\s*(?:array\s*\()?\s*\[(.*?)\]\s*\)?\)', rest, re.DOTALL))
        for em in exec_ms:
            params_in_bind = set(named_call_re.findall(em.group(1)))
            missing = params_in_query - params_in_bind
            if missing:
                issues_sql.append((fname, query[:80], missing))
if issues_sql:
    for fname, query, missing in issues_sql:
        print(f'  {fname}: Missing: {missing}')
        print(f'    Query: {query}')
else:
    print('  Semua named params ter-bind. OK.')

# 5. VARIABLES USED WITHOUT DEFINITION (rough)
print()
print('='*60)
print('5. UNDEFINED \\$VARIABLE (rough scan - known patterns)')
print('='*60)
known_issues = []
# export_oee.php: $month, $year checked - fixed
# export_oee.php: $months_name defined in file - OK
# data.php - MODE C: $hours isset check
# get_oee_data: LIMIT/OFFSET bindValue
# get_oee_data: $limit, $page, $offset - defined
# get_oee_data: $totalQuery, $totalRows, $totalPages, $offset - defined
# get_oee_data: $query, $stmt, $data - defined
# oee.php: $months - defined inline
# oee.php: $num, $name - defined inline in foreach
# check export_oee $year variable
content_export = php_files.get('export_oee.php', '')
month_def = '$month' in content_export
year_def = '$year' in content_export
months_def = '$months_name' in content_export
print(f'  export_oee.php: $month defined={month_def}, $year defined={year_def}, $months_name defined={months_def}')

# 6. SESSION & TIMEZONE
print()
print('='*60)
print('6. SESSION & TIMEZONE')
print('='*60)
for fname, content in php_files.items():
    has_session_start = bool(re.search(r'session_start\s*\(', content))
    has_tz = bool(re.search(r'date_default_timezone_set', content))
    has_config = 'config.php' in content
    if has_session_start or has_tz or has_config:
        print(f'  {fname}: session={has_session_start}, tz={has_tz}, config={has_config}')

# 7. API WRAPPER CONSISTENCY
print()
print('='*60)
print('7. API RESPONSE WRAPPERS')
print('='*60)
for fname, content in php_files.items():
    has_apiError = 'apiError(' in content
    has_apiSuccess = 'apiSuccess(' in content
    is_api = fname.endswith('.php') and fname not in ['header.php','footer.php']
    if is_api and has_apiError or has_apiSuccess:
        print(f'  {fname}: apiError={has_apiError}, apiSuccess={has_apiSuccess}')

# 8. DUPLICATE INCLUDES
print()
print('='*60)
print('8. DUPLICATE INCLUDE / REQUIRE DETECTION')
print('='*60)
for fname, content in php_files.items():
    all_inc = include_re.findall(content)
    seen = set()
    dupes = []
    for inc in all_inc:
        key = inc
        if key in seen:
            dupes.append(key)
        seen.add(key)
    if dupes:
        print(f'  {fname}: DUPLICATE include: {dupes}')

# 9. CROSS-FILE VARIABLE LEAK / CONVENTION
print()
print('='*60)
print('9. SHARED VARIABLE \\$pdo CONSISTENCY')
print('='*60)
for fname, content in php_files.items():
    uses_pdo_new = bool(re.search(r'new\s+PDO\s*\(', content))
    uses_pdo_var = '$pdo' in content
    inc_config = 'config.php' in content
    inc_header = 'header.php' in content
    if uses_pdo_new or uses_pdo_var or inc_config or inc_header:
        print(f'  {fname}: new_PDO={uses_pdo_new}, uses_$pdo={uses_pdo_var}, inc_config={inc_config}, inc_header={inc_header}')

# 10. SKU LOOKUP LOGIC CONSISTENCY
print()
print('='*60)
print('10. SKU LOOKUP LOGIC (should use getTargetOutput)')
print('='*60)
for fname, content in php_files.items():
    has_getTarget = 'getTargetOutput(' in content
    has_inline_targets = 'TARGETS_BHP' in content or 'TARGETS_HIGH_SPEED' in content or 'TARGETS_AHP' in content
    has_window_targets = 'window.TARGETS_' in content
    if has_inline_targets and not has_getTarget:
        print(f'  {fname}: HAS inline targets WITHOUT getTargetOutput() - review needed')
    elif has_getTarget:
        print(f'  {fname}: Uses getTargetOutput() - OK')

# 11. JSON API CONTENT-TYPE
print()
print('='*60)
print('11. JSON API header() calls')
print('='*60)
for fname, content in php_files.items():
    json_header = re.findall(r"header\s*\(\s*['\"]Content-Type:\s*application/json['\"]", content)
    if json_header:
        print(f'  {fname}: {len(json_header)}x JSON header')

# 12. PDO ERROR MODE
print()
print('='*60)
print('12. PDO ATTR_ERRMODE consistency')
print('='*60)
pdo_errmode_re = re.compile(r'ATTR_ERRMODE.*?ERRMODE_EXCEPTION|ERRMODE_EXCEPTION.*?ATTR_ERRMODE', re.DOTALL)
for fname, content in php_files.items():
    if 'new PDO' in content or '$pdo' in content:
        has_errmode = bool(pdo_errmode_re.search(content))
        print(f'  {fname}: ERRMODE_EXCEPTION={has_errmode}')

print()
print('='*60)
print('AUDIT COMPLETE')
print('='*60)