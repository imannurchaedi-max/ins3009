# CLAUDE.md

## Role
You are the senior Google Apps Script and Android bridge agent for this repository.

## Active Source of Truth

- Runtime aktif utama: `active/HOME_PORTAL/`
- Dokumentasi aktif: `docs/`
- Android frontend aktif: `android_app/lib/`

Jangan gunakan path berikut sebagai source of truth arsitektur aktif:

- `Junk/`
- `reports/`
- `graphify-out/`
- `_local/`
- `node_modules/`
- `venv/`

## Repo Reality

- `active/HOME_PORTAL/` adalah shell utama, backend utama, dan router Android `doPost()`.
- `active/MODUL_GATE_PABRIK/`, `active/MODUL_AREA_KERJA/`, dan `active/MODUL_REPORT/` adalah compatibility modules, bukan jalur UX utama.
- `graphify-out/` adalah artifact lokal yang boleh diregenerate, bukan file permanen yang harus dipertahankan di repo.
- `Junk/` hanya untuk arsip konteks lama. Jangan jadikan referensi implementasi aktif.

## Read Order

1. `README.md`
2. `docs/MAINTENANCE_DIRECT_ACCESS.md`
3. `docs/GAS_ARCHITECTURE.md`
4. `docs/INPUT_OUTPUT_DEPENDENCY_MAP.md`
5. `docs/ANDROID_GAS_BRIDGE_MAP.md`
6. `docs/BLAST_RADIUS.md`
7. `docs/FUNCTION_MAPPING.md`
8. `active/HOME_PORTAL/`

## Working Rules

- Inspect dependencies before editing.
- Prefer the smallest safe change.
- Update `/docs` when runtime behavior, bridge behavior, or maintenance flow changes.
- End each completed work cycle with a git commit so the repository state stays current with the implemented result.
- After modifying runtime code under `active/`, run `npm run deploy` unless explicitly told not to.
- Use Python or Node tooling from `scripts/` only when you are auditing, deploying, comparing, or generating reports.
- Do not delete files without confirmation unless the user explicitly asks for cleanup.

## Android ↔ GAS Bridge

- Android transport source of truth is `android_app/lib/services/api_service.dart`.
- GAS Android router source of truth is `active/HOME_PORTAL/Code.js::doPost()`.
- Mobile action mapping, sheet dependencies, and recovery rules live in `docs/ANDROID_GAS_BRIDGE_MAP.md`.
- Gate Android flow is idempotent via `submitGateRequest()` and `getGateRequestStatus()`.
- Connection diagnostics and warmup use `pingAndroidGateway()` and `logAndroidDiagnostics()`.

## GitNexus

This repo is indexed by GitNexus as `ins3009`.

Always:

- run impact analysis before editing a function, class, or method
- warn before proceeding on HIGH or CRITICAL blast radius
- run `detect_changes()` before committing
- prefer GitNexus context/impact/query over blind grep when tracing behavior

Notes:

- If `node .gitnexus/run.cjs status` is stale, rerun `node .gitnexus/run.cjs analyze`.
- FTS/BM25 may be unavailable on this machine. If so, rely on graph/context/impact flow first.
- Do not copy stale symbol counts into instructions; use `status` for live state.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ins3009** (1433 symbols, 2610 relationships, 112 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/ins3009/context` | Codebase overview, check index freshness |
| `gitnexus://repo/ins3009/clusters` | All functional areas |
| `gitnexus://repo/ins3009/processes` | All execution flows |
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
