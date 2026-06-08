"""
analyze_architecture.py
Speed_Mesin -- Architecture Analyzer
Powered by LangGraph + Mermaid

Workflow:
  scan_files -> extract_symbols -> build_graph -> check_relevance -> generate_mermaid -> render_png -> write_report

Run:
  python analyze_architecture.py
  python analyze_architecture.py --render-only   # skip analysis, just re-render PNGs
  python analyze_architecture.py --check-only    # print relevance report, no file writes
"""

import os
import re
import sys
import subprocess
import argparse
from pathlib import Path
from typing import TypedDict, List, Dict, Annotated
from langgraph.graph import StateGraph, END

# Force UTF-8 output on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ──────────────────────────────────────────────
# State definition
# ──────────────────────────────────────────────

class ArchState(TypedDict):
    project_root: str
    php_files: List[str]
    functions: Dict[str, dict]          # name -> {file, line, callers[], is_js}
    include_map: Dict[str, List[str]]   # file -> [included files]
    orphan_functions: List[str]
    relevance_issues: List[str]         # plain list, no LangGraph accumulator
    mermaid_sources: Dict[str, str]     # diagram_name -> mermaid source
    render_results: Dict[str, bool]     # diagram_name -> success
    report: str

# ──────────────────────────────────────────────
# Node 1 -- scan_files
# ──────────────────────────────────────────────

def scan_files(state: ArchState) -> ArchState:
    root = Path(state["project_root"])
    php_files = sorted([
        str(f.relative_to(root))
        for f in root.glob("*.php")
        if not f.name.startswith("_") and f.name not in ("footer.php",)
    ])
    print(f"[scan_files] Found {len(php_files)} PHP files")
    return {**state, "php_files": php_files}

# ──────────────────────────────────────────────
# Node 2 -- extract_symbols
# Parses function definitions and call sites from PHP source
# ──────────────────────────────────────────────

FUNC_DEF_RE  = re.compile(r'^\s*function\s+(\w+)\s*\(', re.MULTILINE)
FUNC_CALL_RE = re.compile(r'\b(\w+)\s*\(')
INCLUDE_RE   = re.compile(r"(?:include|require)(?:_once)?\s+['\"]([^'\"]+)['\"]")
SCRIPT_TAG_RE = re.compile(r'<script[\s\S]*?</script>', re.IGNORECASE)

def _strip_js_blocks(src: str) -> str:
    """Remove <script>...</script> blocks so JS functions aren't flagged as PHP."""
    return SCRIPT_TAG_RE.sub("", src)

def _is_in_script_block(src: str, pos: int) -> bool:
    """Return True if position is inside a <script> block."""
    before = src[:pos]
    open_tags  = len(re.findall(r'<script\b', before, re.IGNORECASE))
    close_tags = len(re.findall(r'</script>', before, re.IGNORECASE))
    return open_tags > close_tags

def extract_symbols(state: ArchState) -> ArchState:
    root = Path(state["project_root"])
    functions: Dict[str, dict] = {}
    include_map: Dict[str, List[str]] = {}

    for rel_path in state["php_files"]:
        abs_path = root / rel_path
        try:
            src = abs_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        include_map[rel_path] = INCLUDE_RE.findall(src)

        for m in FUNC_DEF_RE.finditer(src):
            fn_name = m.group(1)
            line_num = src[:m.start()].count("\n") + 1
            is_js = _is_in_script_block(src, m.start())
            if fn_name not in functions:
                functions[fn_name] = {
                    "file": rel_path,
                    "line": line_num,
                    "callers": [],
                    "is_js": is_js,
                }

    # Second pass -- find call sites
    defined_names = set(functions.keys())
    for rel_path in state["php_files"]:
        abs_path = root / rel_path
        try:
            src = abs_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for m in FUNC_CALL_RE.finditer(src):
            called = m.group(1)
            if called in defined_names:
                fn_info = functions[called]
                if rel_path not in fn_info["callers"]:
                    fn_info["callers"].append(rel_path)

    print(f"[extract_symbols] Extracted {len(functions)} function definitions")
    return {**state, "functions": functions, "include_map": include_map}

# ──────────────────────────────────────────────
# Node 3 -- check_relevance
# ──────────────────────────────────────────────

# PHP built-ins and framework functions that appear in code but aren't project-defined
BUILTIN_SKIP = {
    "isset", "empty", "array_filter", "array_map", "array_merge", "array_values",
    "array_fill", "implode", "explode", "trim", "strtoupper", "str_replace",
    "strpos", "strtotime", "strlen", "count", "round", "min", "max", "floor",
    "ceil", "date", "json_encode", "json_decode", "header", "exit", "die",
    "session_start", "session_regenerate_id", "htmlspecialchars",
}

def check_relevance(state: ArchState) -> ArchState:
    issues: List[str] = []
    orphans: List[str] = []

    for fn_name, info in state["functions"].items():
        if fn_name in BUILTIN_SKIP:
            continue
        # Skip JavaScript functions (defined inside <script> blocks)
        if info.get("is_js", False):
            continue
        # Callers that are NOT the defining file = real external callers
        real_callers = [c for c in info["callers"] if c != info["file"]]
        if not real_callers:
            orphans.append(fn_name)
            issues.append(
                f"ORPHAN: `{fn_name}` defined in {info['file']}:{info['line']} "
                f"-- no external callers found in PHP files"
            )

    # Check shift boundary consistency
    root = Path(state["project_root"])
    fn_src = (root / "functions.php").read_text(encoding="utf-8", errors="ignore")
    oee_src = (root / "get_oee_data.php").read_text(encoding="utf-8", errors="ignore")
    if "'13:59:59'" in fn_src and "'13:59:59'" in oee_src:
        pass  # consistent
    else:
        issues.append(
            "MINOR: Shift 1 boundary may differ between functions.php and SQL CASE statements. "
            "Verify both use '13:59:59' as the upper boundary for SHIFT 1."
        )

    # Check for $dbconn legacy usage
    dbconn_users = []
    for rel_path in state["php_files"]:
        src = (root / rel_path).read_text(encoding="utf-8", errors="ignore")
        if "$dbconn" in src and rel_path != "config.php":
            dbconn_users.append(rel_path)
    if dbconn_users:
        issues.append(
            f"LEGACY: $dbconn alias referenced in: {', '.join(dbconn_users)}. "
            "config.php sets $dbconn = $pdo for compat -- safe but can be cleaned up."
        )

    print(f"[check_relevance] {len(orphans)} orphans, {len(issues)} total issues")
    return {**state, "orphan_functions": orphans, "relevance_issues": issues}

# ──────────────────────────────────────────────
# Node 4 -- generate_mermaid
# Reads existing .mmd files from docs/ (source of truth)
# ──────────────────────────────────────────────

MMD_FILES = ["architecture", "data-flow", "function-map", "io-dependency"]

def generate_mermaid(state: ArchState) -> ArchState:
    root = Path(state["project_root"])
    docs_dir = root / "docs"
    sources: Dict[str, str] = {}

    for name in MMD_FILES:
        mmd_path = docs_dir / f"{name}.mmd"
        if mmd_path.exists():
            sources[name] = mmd_path.read_text(encoding="utf-8")
            print(f"[generate_mermaid] Loaded {name}.mmd ({len(sources[name])} chars)")
        else:
            print(f"[generate_mermaid] MISSING: {name}.mmd")

    return {**state, "mermaid_sources": sources}

# ──────────────────────────────────────────────
# Node 5 -- render_png
# Uses @mermaid-js/mermaid-cli (mmdc) to render diagrams
# shell=True required on Windows so npx resolves through PATH
# ──────────────────────────────────────────────

def render_png(state: ArchState) -> ArchState:
    root = Path(state["project_root"])
    docs_dir = root / "docs"
    results: Dict[str, bool] = {}

    for name in state["mermaid_sources"]:
        in_path  = docs_dir / f"{name}.mmd"
        out_path = docs_dir / f"{name}.png"
        cmd = (
            f'npx mmdc -i "{in_path}" -o "{out_path}"'
            f' --backgroundColor white --width 2400'
        )
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                timeout=60, cwd=str(root), shell=True
            )
            ok = result.returncode == 0
            results[name] = ok
            status = "OK" if ok else "FAIL"
            print(f"[render_png] {status} -> docs/{name}.png")
            if not ok and result.stderr:
                print(f"  stderr: {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            results[name] = False
            print(f"[render_png] TIMEOUT: {name}")

    return {**state, "render_results": results}

# ──────────────────────────────────────────────
# Node 6 -- write_report
# ──────────────────────────────────────────────

def write_report(state: ArchState) -> ArchState:
    sep = "=" * 60
    lines = [
        sep,
        "Speed_Mesin -- Architecture Relevance Report",
        f"Project: {state['project_root']}",
        f"PHP files scanned: {len(state['php_files'])}",
        f"Functions found: {len(state['functions'])}",
        sep,
        "",
        "-- Relevance Issues " + "-" * 40,
    ]

    if state["relevance_issues"]:
        for i, issue in enumerate(state["relevance_issues"], 1):
            lines.append(f"  {i}. {issue}")
    else:
        lines.append("  [OK] No issues found.")

    lines += ["", "-- Orphan Functions " + "-" * 40]
    if state["orphan_functions"]:
        for fn in state["orphan_functions"]:
            info = state["functions"].get(fn, {})
            lines.append(f"  [WARN] {fn} ({info.get('file', '?')}:{info.get('line', '?')})")
    else:
        lines.append("  [OK] All functions have external callers.")

    lines += ["", "-- Diagram Render Results " + "-" * 35]
    for name, ok in state.get("render_results", {}).items():
        status = "[OK]" if ok else "[FAIL]"
        lines.append(f"  {status} docs/{name}.png")

    lines += ["", sep]
    report = "\n".join(lines)
    print(report)

    report_path = Path(state["project_root"]) / "docs" / "relevance_report.txt"
    report_path.write_text(report, encoding="utf-8")
    print(f"\nReport saved -> docs/relevance_report.txt")

    return {**state, "report": report}

# ──────────────────────────────────────────────
# Build LangGraph workflow
# ──────────────────────────────────────────────

def build_graph():
    builder = StateGraph(ArchState)

    builder.add_node("scan_files",       scan_files)
    builder.add_node("extract_symbols",  extract_symbols)
    builder.add_node("check_relevance",  check_relevance)
    builder.add_node("generate_mermaid", generate_mermaid)
    builder.add_node("render_png",       render_png)
    builder.add_node("write_report",     write_report)

    builder.set_entry_point("scan_files")
    builder.add_edge("scan_files",       "extract_symbols")
    builder.add_edge("extract_symbols",  "check_relevance")
    builder.add_edge("check_relevance",  "generate_mermaid")
    builder.add_edge("generate_mermaid", "render_png")
    builder.add_edge("render_png",       "write_report")
    builder.add_edge("write_report",     END)

    return builder.compile()

# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Speed_Mesin Architecture Analyzer")
    parser.add_argument("--render-only", action="store_true",
                        help="Only render .mmd to PNG, skip analysis")
    parser.add_argument("--check-only", action="store_true",
                        help="Only run relevance check, no rendering")
    parser.add_argument("--root", default=None,
                        help="Project root (default: script directory)")
    args = parser.parse_args()

    project_root = args.root or str(Path(__file__).parent.resolve())

    initial_state: ArchState = {
        "project_root":     project_root,
        "php_files":        [],
        "functions":        {},
        "include_map":      {},
        "orphan_functions": [],
        "relevance_issues": [],
        "mermaid_sources":  {},
        "render_results":   {},
        "report":           "",
    }

    if args.render_only:
        state = generate_mermaid({**initial_state})
        state = render_png(state)
        state = write_report({**state, "relevance_issues": [], "orphan_functions": [],
                              "php_files": [], "functions": {}})
    elif args.check_only:
        state = scan_files(initial_state)
        state = extract_symbols(state)
        state = check_relevance(state)
        state = write_report({**state, "mermaid_sources": {}, "render_results": {}})
    else:
        print("Running full architecture analysis pipeline...\n")
        graph = build_graph()
        state = graph.invoke(initial_state)

    return state

if __name__ == "__main__":
    main()
