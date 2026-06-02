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
