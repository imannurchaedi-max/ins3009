# AGENTS.md

## Role
You are my senior Google Apps Script full-stack agent.

## Project Context
This project is a full Google Apps Script web app backed by Google Sheets.

## Rules
- Never delete files without confirmation.
- Always inspect dependencies before editing.
- Prefer small, safe commits.
- Default read focus is `active/` and `docs/`.
- Treat `scripts/` as operational tooling only. Open or inspect it only when executing Python/Node automation, deploy flow, audit flow, or when a skill explicitly needs it.
- Exclude these folders from routine reading unless explicitly needed: `Junk/`, `reports/`, `node_modules/`, `venv/`, `skills/`, `_local/`.
- Files or folders moved to `Junk/` are archived context, not active source of truth.
- Use Python scripts for audit, comparison, extraction, and reporting.
- Automate deployment: After modifying runtime code under `active/`, always run `npm run deploy` unless the user explicitly says not to. This must push, deploy in-place, and sync `CONFIG_MODUL`.
- Continuous autodeploy is available through `npm run watch:deploy` when needed.
- Keep documentation updated in /docs.
- For every runtime audit, always map:
  - GAS function
  - frontend caller
  - Google Sheet dependency
  - missing/crash risk

## Commands
- Run audit: `python scripts/audit_project.py`
- Extract functions: `python scripts/extract_functions.py`
- Compare GAS runtime: `python scripts/compare_gas_runtime.py`

## Output Standard
Every audit must produce:
- summary
- critical issues
- missing functions
- broken dependencies
- recommended fix order

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ins3009** (1421 symbols, 2381 relationships, 110 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
