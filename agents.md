# AGENTS.md

## Role
You are my senior Google Apps Script full-stack agent for EMPLOYE TRACKER.

## Project Context

This repository is a Google Apps Script web app backed by Google Sheets, with a Flutter Android client that talks to GAS through `doPost()`.

## Active Source of Truth

- GAS runtime utama: `active/HOME_PORTAL/`
- Android frontend utama: `android_app/lib/`
- Dokumentasi aktif: `docs/`

Compatibility modules:

- `active/MODUL_GATE_PABRIK/`
- `active/MODUL_AREA_KERJA/`
- `active/MODUL_REPORT/`

Modul-modul itu bukan referensi utama arsitektur; cek hanya bila perubahan memang menyentuh compatibility deployment.

## Rules

- Never delete files without confirmation, kecuali user sudah eksplisit meminta cleanup.
- Always inspect dependencies before editing.
- Prefer small, safe commits.
- Always end a completed task with a git commit so the repository remains up to date with the latest validated work.
- Default read focus is `active/`, `docs/`, and `android_app/lib/`.
- Treat `scripts/` as operational tooling only. Open or inspect it only when executing Python/Node automation, deploy flow, audit flow, or when a skill explicitly needs it.
- Exclude these folders from routine reading unless explicitly needed: `Junk/`, `reports/`, `graphify-out/`, `node_modules/`, `venv/`, `skills/`, `_local/`.
- Files or folders moved to `Junk/` are archived context, not active source of truth.
- `graphify-out/` is a generated local artifact, not a permanent knowledge source.
- Use Python scripts for audit, comparison, extraction, and reporting.
- Automate deployment: After modifying runtime code under `active/`, always run `npm run deploy` unless the user explicitly says not to. This must push, deploy in-place, and sync `CONFIG_MODUL`.
- Continuous autodeploy is available through `npm run watch:deploy` when needed.
- Keep documentation updated in `/docs`.
- When Android bridge behavior changes, update `docs/ANDROID_GAS_BRIDGE_MAP.md`.
- For every runtime audit, always map:
  - GAS function
  - frontend caller
  - Google Sheet dependency
  - missing/crash risk

## Commands

- Run audit: `python scripts/audit_project.py`
- Extract functions: `python scripts/extract_functions.py`
- Compare GAS runtime: `python scripts/compare_gas_runtime.py`
- GitNexus status: `node .gitnexus/run.cjs status`
- GitNexus analyze: `node .gitnexus/run.cjs analyze`

## Output Standard

Every audit must produce:

- summary
- critical issues
- missing functions
- broken dependencies
- recommended fix order

## Android Bridge Notes

- Android transport source of truth: `android_app/lib/services/api_service.dart`
- Android diagnostics source of truth: `android_app/lib/services/android_diagnostics_service.dart`
- GAS Android router source of truth: `active/HOME_PORTAL/Code.js::doPost()`
- Action-to-handler mapping source of truth: `docs/ANDROID_GAS_BRIDGE_MAP.md`
- Gate mobile requests must remain idempotent via `submitGateRequest()` and `getGateRequestStatus()`
- Connection observability must remain available via `pingAndroidGateway()` and `logAndroidDiagnostics()`

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as `ins3009`. Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If index status is stale, run `node .gitnexus/run.cjs analyze` from the project root.

## Always Do

- **MUST run impact analysis before editing any function, class, or method.**
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with code edits.
- **MUST run `detect_changes()` before committing** to verify the changed scope matches intent.
- Prefer `context()` / `impact()` / `query()` over blind grep when tracing unfamiliar behavior.
- Use `explain()` for security review when the PDG/taint layer is relevant.

## Never Do

- NEVER edit a function, class, or method without first running `impact`.
- NEVER ignore HIGH or CRITICAL risk warnings.
- NEVER rename symbols with find-and-replace when graph-aware rename is required.
- NEVER commit changes without checking `detect_changes()`.

## Notes

- FTS/BM25 may be unavailable on this machine even when graph indexing works. If that happens, rely on graph/context/impact workflows first.
- Do not hardcode symbol counts or commit hashes into standing instructions; those values age quickly.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/ins3009/context` | Codebase overview, check index freshness |
| `gitnexus://repo/ins3009/clusters` | Functional areas |
| `gitnexus://repo/ins3009/processes` | Execution flows |
| `gitnexus://repo/ins3009/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
