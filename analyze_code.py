#!/usr/bin/env python3
"""PHP Code Analyzer - Speed_Mesin Project"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import re
import os
from pathlib import Path
from collections import defaultdict

PROJECT_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
PHP_FILES = [
    "config.php", "functions.php", "data.php", "speed.php",
    "settings.php", "oee.php", "index.php", "login.php",
    "logout.php", "output.php", "header.php", "footer.php",
    "update_sku.php", "update_variant.php", "get_oee_data.php",
    "export_oee.php", "tv_dashboard.php"
]

def analyze_file(filepath):
    """Extract functions, classes, includes, database queries, and security issues."""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    info = {
        'file': filepath.name,
        'functions': [],
        'classes': [],
        'includes': [],
        'db_queries': [],
        'security_issues': [],
        'api_endpoints': [],
        'echo_output': [],
    }

    # Extract functions
    func_pattern = r'(?:public|private|protected|static)?\s*function\s+(\w+)\s*\('
    info['functions'] = re.findall(func_pattern, content)

    # Extract class definitions
    class_pattern = r'class\s+(\w+)'
    info['classes'] = re.findall(class_pattern, content)

    # Extract includes/requires
    include_pattern = r'(?:include|include_once|require|require_once)\s*[\(\'"]+([^\'")]+)[\'")]+'
    info['includes'] = re.findall(include_pattern, content)

    # Extract SQL queries
    sql_pattern = r'(?:pg_query|pg_query_params|mysql_query|SELECT|INSERT|UPDATE|DELETE)\s*\('
    info['db_queries'] = re.findall(sql_pattern, content, re.IGNORECASE)

    # Security issues
    if re.search(r'md5\s*\(', content, re.IGNORECASE):
        info['security_issues'].append('MD5 usage (insecure hashing)')
    if re.search(r'password\s*=', content, re.IGNORECASE) and 'md5' in content.lower():
        info['security_issues'].append('Password stored with MD5')
    if re.search(r'\$_GET\s*\[|\$_POST\s*\[|\$_REQUEST\s*\[', content) and 'htmlspecialchars' not in content:
        info['security_issues'].append('Potential XSS - unescaped user input')
    if re.search(r'session_regenerate_id', content):
        info['security_issues'].append('session_regenerate_id found (check if called after login)')
    if re.search(r'\$_SESSION\s*=\s*\$', content) and 'session_regenerate_id' not in content:
        info['security_issues'].append('Session assignment without regeneration')
    if re.search(r'echo\s+\$_(?:GET|POST|REQUEST)', content):
        info['security_issues'].append('Direct echo of user input')

    # API endpoints (JSON responses)
    if re.search(r'json_encode|apiSuccess|apiError', content):
        info['api_endpoints'].append('JSON API detected')

    return info

def main():
    print("=" * 80)
    print("SPEED_MESIN CODE ANALYZER - PHP AST EXTRACTION")
    print("=" * 80)

    all_info = []
    func_index = defaultdict(list)

    for php_file in PHP_FILES:
        filepath = PROJECT_DIR / php_file
        if filepath.exists():
            info = analyze_file(filepath)
            all_info.append(info)

            for func in info['functions']:
                func_index[func].append(php_file)

    # Print summary by file
    print("\n📁 FILE ANALYSIS SUMMARY\n")
    print("-" * 80)
    for info in all_info:
        print(f"\n🎯 {info['file']}")
        print(f"   Functions ({len(info['functions'])}): {', '.join(info['functions']) if info['functions'] else 'None'}")
        print(f"   Classes: {', '.join(info['classes']) if info['classes'] else 'None'}")
        print(f"   Includes: {', '.join(info['includes']) if info['includes'] else 'None'}")
        print(f"   DB Queries: {len(info['db_queries'])} found")
        if info['security_issues']:
            print(f"   ⚠️  Security: {info['security_issues']}")
        if info['api_endpoints']:
            print(f"   🌐 API: {info['api_endpoints']}")

    # Print cross-reference index
    print("\n" + "=" * 80)
    print("🔗 FUNCTION CROSS-REFERENCE INDEX")
    print("=" * 80)
    for func, files in sorted(func_index.items()):
        print(f"  {func}() → {', '.join(files)}")

    # Generate Mermaid-compatible data for architecture
    print("\n" + "=" * 80)
    print("🏗️ MERMAID DATA FLOW COMPONENTS")
    print("=" * 80)

    # Group files by type
    backend = ['config.php', 'functions.php', 'data.php', 'get_oee_data.php', 'export_oee.php']
    frontend = ['speed.php', 'oee.php', 'index.php', 'login.php', 'output.php', 'tv_dashboard.php', 'header.php', 'footer.php']
    utils = ['settings.php', 'update_sku.php', 'update_variant.php']

    print("\n### Backend Components")
    for f in backend:
        info = next((i for i in all_info if i['file'] == f), None)
        if info and info['functions']:
            print(f"  - {f}: [{', '.join(info['functions'])}]")

    print("\n### Frontend Components")
    for f in frontend:
        info = next((i for i in all_info if i['file'] == f), None)
        if info and info['functions']:
            print(f"  - {f}: [{', '.join(info['functions'])}]")

    print("\n### Utility/Settings Components")
    for f in utils:
        info = next((i for i in all_info if i['file'] == f), None)
        if info and info['functions']:
            print(f"  - {f}: [{', '.join(info['functions'])}]")

if __name__ == "__main__":
    main()