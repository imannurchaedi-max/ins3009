# Graph Report - .  (2026-06-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 169 nodes · 212 edges · 21 communities (18 shown, 3 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]

## God Nodes (most connected - your core abstractions)
1. `scan_project()` - 12 edges
2. `GAS Architecture` - 8 edges
3. `fallback_update_via_temp_deploy()` - 7 edges
4. `scripts` - 6 edges
5. `main()` - 6 edges
6. `load_access_token()` - 6 edges
7. `update_sheet()` - 6 edges
8. `refresh_access_token()` - 5 edges
9. `request_json_with_retry()` - 5 edges
10. `main()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `EMPLOYEE DATA` --shares_data_with--> `GAS Architecture`  [INFERRED]
  graphify-out/converted/EMPLOYEE DATA_b692a2f4.md → docs/GAS_ARCHITECTURE.md
- `HOME_PORTAL app.html` --calls--> `Google Apps Script Backend`  [INFERRED]
  active/HOME_PORTAL/app.html → README.md
- `MODUL_AREA_KERJA app.html` --calls--> `Google Apps Script Backend`  [INFERRED]
  active/MODUL_AREA_KERJA/app.html → README.md
- `MODUL_GATE_PABRIK app.html` --calls--> `Google Apps Script Backend`  [INFERRED]
  active/MODUL_GATE_PABRIK/app.html → README.md
- `main()` --calls--> `ensure_reports_dir()`  [INFERRED]
  scripts/audit_project.py → scripts/common_audit.py

## Import Cycles
- None detected.

## Communities (21 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (18): Path, first_file_line(), main(), md_table(), ensure_reports_dir(), extract_google_script_run_calls(), Finding, iter_source_files() (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.19
Nodes (22): build_payload(), build_temp_injector_code(), compact_text(), ensure_deploy_capacity(), extract_preserved_home_url(), fallback_update_via_temp_deploy(), get_clasprc_path(), get_default_token_entry() (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (13): AreaFunctions.gs, Deployment Guide, EMPLOYEE DATA, GAS Architecture, GateFunctions.gs, HOME_PORTAL, MODUL_AREA_KERJA, MODUL_GATE_PABRIK (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.29
Nodes (6): bindKartu(), getBindingStatus(), releaseKartu(), safeUpdateRecapAbsen(), scanAreaKerja(), updateRecapAbsen()

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (10): dependencies, acorn, devDependencies, dependency-cruiser, scripts, deploy, deploy:force, push (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (10): Google Apps Script Backend, Google Sheets Database, HOME_PORTAL app.html, HOME_PORTAL Index.html, HOME_PORTAL style.html, MODUL_AREA_KERJA app.html, MODUL_AREA_KERJA Index.html, MODUL_AREA_KERJA style.html (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.20
Nodes (9): dependencies, exceptionLogging, executionApi, access, runtimeVersion, timeZone, webapp, access (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.20
Nodes (8): CONFIG, CONFIG_PATH, doDeploy, { execSync }, force, fs, path, ROOT

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 12 - "Community 12"
Cohesion: 0.38
Nodes (3): buildAbsenReportCacheKey(), getAbsenReport(), toDateKey()

### Community 13 - "Community 13"
Cohesion: 0.60
Nodes (5): build_snapshot(), find_changed_paths(), iter_watched_files(), main(), run_deploy()

## Knowledge Gaps
- **47 isolated node(s):** `timeZone`, `dependencies`, `exceptionLogging`, `runtimeVersion`, `executeAs` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Path` connect `Community 0` to `Community 7`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `scan_project()` (e.g. with `main()` and `build_comparison()`) actually correct?**
  _`scan_project()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `main()` (e.g. with `ensure_reports_dir()` and `names()`) actually correct?**
  _`main()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `timeZone`, `dependencies`, `exceptionLogging` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._