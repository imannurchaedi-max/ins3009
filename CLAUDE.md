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
