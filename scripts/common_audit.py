from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "reports"

SCAN_EXTENSIONS = {
    ".js": "gas",
    ".gs": "gas",
    ".html": "html",
    ".json": "json",
}

SKIP_DIRS = {
    ".git",
    ".idea",
    ".vscode",
    "__pycache__",
    "node_modules",
    "vendor",
    "reports",
    "skills",
    "venv",
}

SKIP_FILES = {
    "fix_app.js",
    "restore_funcs.js",
}

GAS_FUNCTION_RE = re.compile(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", re.MULTILINE)
JS_FUNCTION_RE = re.compile(
    r"\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|"
    r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>",
    re.MULTILINE,
)
CHAIN_METHOD_LINE_RE = re.compile(r"^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(")
GOOGLE_SCRIPT_RUN_HANDLER_METHODS = {"withSuccessHandler", "withFailureHandler", "withUserObject"}
INCLUDE_RE = re.compile(r"<\?!=\s*include\(['\"]([^'\"]+)['\"]\)\s*;?\s*\?>")
SHEET_CONST_RE = re.compile(r"\bconst\s+(SHEET_[A-Z0-9_]+)\s*=\s*['\"]([^'\"]+)['\"]")
GET_SHEET_RE = re.compile(r"\bgetSheet\s*\(\s*([A-Za-z0-9_'\"]+)\s*\)")


@dataclass
class Finding:
    file: str
    line: int
    name: str
    kind: str
    detail: str = ""


@dataclass
class ProjectAudit:
    scanned_files: list[dict] = field(default_factory=list)
    gas_functions: list[Finding] = field(default_factory=list)
    frontend_functions: list[Finding] = field(default_factory=list)
    frontend_server_calls: list[Finding] = field(default_factory=list)
    includes: list[Finding] = field(default_factory=list)
    sheet_constants: list[Finding] = field(default_factory=list)
    sheet_dependencies: list[Finding] = field(default_factory=list)
    internal_gas_calls: list[Finding] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)


def iter_source_files(root: Path = ROOT) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for filename in sorted(filenames):
            if filename in SKIP_FILES:
                continue
            path = Path(dirpath) / filename
            if path.suffix.lower() in SCAN_EXTENSIONS:
                yield path


def read_text(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(errors="replace")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def extract_google_script_run_calls(text: str, file: str) -> list[Finding]:
    calls: list[Finding] = []
    lines = text.splitlines()
    for index, source_line in enumerate(lines):
        if "google.script.run" not in source_line:
            continue
        for scan_index in range(index + 1, min(index + 80, len(lines))):
            method_match = CHAIN_METHOD_LINE_RE.search(lines[scan_index])
            if not method_match:
                continue
            method = method_match.group(1)
            if method in GOOGLE_SCRIPT_RUN_HANDLER_METHODS:
                continue
            calls.append(Finding(file, scan_index + 1, method, "google_script_run"))
            break
    return calls


def scan_project(root: Path = ROOT) -> ProjectAudit:
    audit = ProjectAudit()

    files = list(iter_source_files(root))
    for path in files:
        text = read_text(path)
        file = rel(path)
        kind = SCAN_EXTENSIONS[path.suffix.lower()]
        audit.scanned_files.append({"file": file, "kind": kind, "bytes": path.stat().st_size})

        if path.suffix.lower() in {".gs", ".js"}:
            for match in GAS_FUNCTION_RE.finditer(text):
                audit.gas_functions.append(
                    Finding(file, line_number(text, match.start()), match.group(1), "gas_function")
                )
            for match in SHEET_CONST_RE.finditer(text):
                audit.sheet_constants.append(
                    Finding(file, line_number(text, match.start()), match.group(1), "sheet_constant", match.group(2))
                )
            for match in GET_SHEET_RE.finditer(text):
                audit.sheet_dependencies.append(
                    Finding(file, line_number(text, match.start()), match.group(1), "sheet_dependency")
                )

        if path.suffix.lower() == ".html":
            for match in JS_FUNCTION_RE.finditer(text):
                name = next(group for group in match.groups() if group)
                audit.frontend_functions.append(
                    Finding(file, line_number(text, match.start()), name, "frontend_function")
                )
            audit.frontend_server_calls.extend(extract_google_script_run_calls(text, file))
            for match in INCLUDE_RE.finditer(text):
                audit.includes.append(Finding(file, line_number(text, match.start()), match.group(1), "gas_include"))

    gas_function_names = {finding.name for finding in audit.gas_functions}
    if gas_function_names:
        call_re = re.compile(r"\b([A-Za-z_$][\w$]*)\s*\(")
        for path in files:
            if path.suffix.lower() not in {".gs", ".js"}:
                continue
            text = read_text(path)
            file = rel(path)
            definitions = {finding.name for finding in audit.gas_functions if finding.file == file}
            for match in call_re.finditer(text):
                name = match.group(1)
                if name not in gas_function_names:
                    continue
                line = line_number(text, match.start())
                if name in definitions and any(
                    f.name == name and f.file == file and f.line == line for f in audit.gas_functions
                ):
                    continue
                audit.internal_gas_calls.append(Finding(file, line, name, "internal_gas_call"))

    return audit


def names(findings: Iterable[Finding]) -> set[str]:
    return {finding.name for finding in findings}


def ensure_reports_dir() -> None:
    REPORTS_DIR.mkdir(exist_ok=True)
