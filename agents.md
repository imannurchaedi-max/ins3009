# AGENTS.md

## Role
You are my senior Google Apps Script full-stack agent.

## Project Context
This project is a full Google Apps Script web app backed by Google Sheets.

## Rules
- Never delete files without confirmation.
- Always inspect dependencies before editing.
- Prefer small, safe commits.
- Use Python scripts for audit, comparison, extraction, and reporting.
- Automate deployment: After modifying code, always run clasp push, clasp deploy, get the new links, and copy them to the CONFIG_MODUL sheet using the python update script.
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

This project is indexed by GitNexus as **ins3009** (759 symbols, 941 relationships, 26 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

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
