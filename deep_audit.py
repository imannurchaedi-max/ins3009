#!/usr/bin/env python3
"""Deep Code Analyzer - Cross-Reference with CLAUDE.md"""
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

from pathlib import Path
from collections import defaultdict

import os
PROJECT_DIR = Path(os.path.dirname(os.path.abspath(__file__)))

# Parse CLAUDE.md for documented specs
def parse_claude_md():
    claude_path = PROJECT_DIR / "CLAUDE.md"
    content = claude_path.read_text(encoding='utf-8')

    findings = {
        'shift_boundaries': [],
        'target_specs': [],
        'database_tables': [],
        'key_functions': [],
        'conventions': [],
    }

    # Extract shift boundaries
    shift_pattern = r'\|\s*(SHIFT \d+)\s*\|\s*(\d{2}:\d{2})\s*\|\s*(\d{2}:\d{2})\s*\|.*'
    for match in re.finditer(shift_pattern, content):
        findings['shift_boundaries'].append({
            'shift': match.group(1),
            'start': match.group(2),
            'end': match.group(3),
        })

    # Extract target specs
    target_section = re.search(r'Target per shift.*?```(.*?)```', content, re.DOTALL)
    if target_section:
        findings['target_specs_raw'] = target_section.group(1)

    # Extract database tables
    table_pattern = r'`(\w+)`\s*—.*?kolom\s*`([^`]+)`'
    for match in re.finditer(table_pattern, content):
        findings['database_tables'].append({
            'table': match.group(1),
            'columns': match.group(2),
        })

    # Extract conventions
    conv_pattern = r'\*\*(\w[^:]*):\*\*\s*(.+)'
    for match in re.finditer(conv_pattern, content):
        findings['conventions'].append({
            'topic': match.group(1),
            'rule': match.group(2),
        })

    return findings

# Analyze PHP files for shift boundaries
def find_shift_boundaries():
    shift_boundaries = {}
    files_to_check = [
        ('functions.php', ['getShiftID', 'getCurrentShiftScope']),
        ('get_oee_data.php', []),
        ('export_oee.php', []),
        ('data.php', []),
    ]

    for php_file, _ in files_to_check:
        filepath = PROJECT_DIR / php_file
        if not filepath.exists():
            continue

        content = filepath.read_text(encoding='utf-8', errors='ignore')

        # Find shift boundary patterns
        patterns = [
            r"BETWEEN\s+'(\d{2}:\d{2}:\d{2})'\s+AND\s+'(\d{2}:\d{2}:\d{2})'",
            r">=\s+'(\d{2}:\d{2}:\d{2})'\s*&&\s*\$timeStr\s*<=\s*'(\d{2}:\d{2}:\d{2})'",
            r"\$nowTime\s*>=\s*'(\d{2}:\d{2}:\d{2})'\s*&&\s*\$nowTime\s*<=\s*'(\d{2}:\d{2}:\d{2})'",
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, content):
                start, end = match.groups()
                key = f"{start}-{end}"
                if key not in shift_boundaries:
                    shift_boundaries[key] = []
                shift_boundaries[key].append(php_file)

    return shift_boundaries

# Find MD5 usage
def find_md5_usage():
    findings = []
    php_files = list(PROJECT_DIR.glob("*.php"))

    for f in php_files:
        if f.name == 'analyze_code.py':
            continue
        content = f.read_text(encoding='utf-8', errors='ignore')
        matches = list(re.finditer(r'md5\s*\(', content, re.IGNORECASE))
        if matches:
            findings.append({
                'file': f.name,
                'occurrences': len(matches),
                'line_context': [(m.start(), content[max(0, m.start()-50):m.start()+50]) for m in matches[:3]]
            })
    return findings

# Find hardcoded machine lists
def find_hardcoded_machines():
    findings = []
    php_files = list(PROJECT_DIR.glob("*.php"))

    pattern = r"\[(['\"](?:BHP|AHP)\s*\d['\"](?:,\s*['\"](?:BHP|AHP)\s*\d['\"]*)*)\]"

    for f in php_files:
        if f.name == 'analyze_code.py':
            continue
        content = f.read_text(encoding='utf-8', errors='ignore')

        for match in re.finditer(pattern, content):
            findings.append({
                'file': f.name,
                'match': match.group(0)[:100],
                'pos': match.start(),
            })
    return findings

# Find session handling
def find_session_handling():
    findings = []
    php_files = list(PROJECT_DIR.glob("*.php"))

    for f in php_files:
        content = f.read_text(encoding='utf-8', errors='ignore')

        if 'session_regenerate_id' in content:
            findings.append({'file': f.name, 'type': 'has_regenerate_id'})

        if re.search(r'\$_SESSION\s*=\s*\$', content):
            findings.append({'file': f.name, 'type': 'direct_assignment'})

        if 'session_start()' in content:
            findings.append({'file': f.name, 'type': 'has_session_start'})

    return findings

# Find SKU handling patterns
def find_sku_patterns():
    findings = []
    php_files = list(PROJECT_DIR.glob("*.php"))

    for f in php_files:
        content = f.read_text(encoding='utf-8', errors='ignore')

        if 'sku_history' in content:
            findings.append({'file': f.name, 'source': 'sku_history'})

        if 'machine_settings' in content:
            findings.append({'file': f.name, 'source': 'machine_settings'})

    return findings

# Check API patterns
def find_api_patterns():
    findings = []
    php_files = list(PROJECT_DIR.glob("*.php"))

    for f in php_files:
        content = f.read_text(encoding='utf-8', errors='ignore')

        if 'apiSuccess' in content:
            findings.append({'file': f.name, 'uses': 'apiSuccess'})

        if 'apiError' in content:
            findings.append({'file': f.name, 'uses': 'apiError'})

        if 'json_encode' in content:
            findings.append({'file': f.name, 'uses': 'json_encode'})

    return findings

def main():
    print("=" * 80)
    print("DEEP AUDIT - Cross-Reference with CLAUDE.md")
    print("=" * 80)

    claude = parse_claude_md()

    print("\n" + "=" * 80)
    print("1. SHIFT BOUNDARY CONSISTENCY CHECK")
    print("=" * 80)
    print("\n📋 CLAUDE.md Documents:")
    for s in claude['shift_boundaries']:
        print(f"   {s['shift']}: {s['start']} - {s['end']}")

    print("\n📋 Code Implementation:")
    boundaries = find_shift_boundaries()
    for b, files in boundaries.items():
        print(f"   {b} → {', '.join(files)}")

    print("\n" + "=" * 80)
    print("2. SECURITY AUDIT")
    print("=" * 80)
    md5_findings = find_md5_usage()
    print("\n🔐 MD5 Usage:")
    for f in md5_findings:
        print(f"   ⚠️  {f['file']}: {f['occurrences']} occurrence(s)")

    print("\n🔐 Session Handling:")
    sessions = find_session_handling()
    for s in sessions:
        print(f"   ✓ {s['file']}: {s['type']}")

    print("\n" + "=" * 80)
    print("3. DATABASE SOURCE CONSISTENCY")
    print("=" * 80)
    sku_sources = find_sku_patterns()
    sources_count = defaultdict(list)
    for s in sku_sources:
        sources_count[s['source']].append(s['file'])

    print("\n📊 SKU Data Sources:")
    print(f"   sku_history: {', '.join(sources_count['sku_history'])}")
    print(f"   machine_settings: {', '.join(sources_count['machine_settings'])}")

    print("\n" + "=" * 80)
    print("4. HARDCODED VALUES")
    print("=" * 80)
    machines = find_hardcoded_machines()
    print("\n🔧 Hardcoded Machine Lists:")
    for m in machines:
        print(f"   {m['file']}: {m['match'][:60]}...")

    print("\n" + "=" * 80)
    print("5. API & RESPONSE PATTERNS")
    print("=" * 80)
    apis = find_api_patterns()
    api_files = set()
    for a in apis:
        api_files.add(a['file'])
    print(f"\n🌐 JSON API Files ({len(api_files)}): {', '.join(sorted(api_files))}")

    print("\n" + "=" * 80)
    print("6. CONVENTIONS COMPLIANCE")
    print("=" * 80)
    print("\n📋 Documented Conventions:")
    for c in claude['conventions']:
        print(f"   {c['topic']}: {c['rule'][:70]}...")

if __name__ == "__main__":
    main()