# Refactor Behavioral Baseline — 2026-07-02

Captured on branch `refactor` at commit `5d75e81` (== `origin/develop`), against Neon DB
branch `refactor` (`br-ancient-hat-aq0y4y43`, forked from `develop`). This is the
"before" record required by the refactor charter (Task 19): every change made during the
refactor is verified against these numbers and artifacts.

## Artifacts

| Artifact | Location |
| --- | --- |
| API response bodies (31 endpoints) | `api-before/*.json` |
| API status/latency/size table | `api-before/_timings.csv` |
| Screenshots of every route | `screens-before/*.png` |
| Capture script (re-runnable) | `capture-api.sh` |
| E2E smoke suite (re-runnable) | `e2e/` at repo root |

## Build metrics (before)

| Metric | Value |
| --- | --- |
| Vite build time | 10.1 s |
| JS bundle | **1 chunk, 1,121.91 kB (316.76 kB gzip)** — no code splitting |
| CSS bundle | 95.30 kB (15.69 kB gzip) |
| Modules transformed | 532 |
| Typecheck | clean (`npm run typecheck`) |
| Lint | n/a — no linter configured |
| Tests | n/a — no test runner configured |

## API latency (warm, local dev, refactor DB branch)

Worst offenders — the charter's "very, very long wait times":

| Endpoint | Latency | Payload |
| --- | --- | --- |
| `GET /roles` | **19.7 s** | 824 kB |
| `GET /work?tab=tasks` | **12.7 s** | **6.05 MB** |
| `GET /work?tab=deliverables` | **12.3 s** | **6.05 MB** |
| `GET /applications` | **8.5 s** | 769 kB |
| `GET /regulations/federal` | **6.2 s** | 31 kB |
| `GET /explorer/value-streams` | **5.8 s** | 47 kB |
| `GET /explorer/org-table` | 3.7 s | 224 kB |
| `GET /regulations/requirements` | 2.6 s | 1.05 MB |
| `GET /explorer/tree` | 2.2 s | 1.38 MB |
| `GET /standards-skills` | 2.1 s | 13 kB |
| `GET /external-interactions` | 2.1 s | 11 kB |

Full table in `api-before/_timings.csv`. Cold-start (Neon compute wake) adds ~0.5–8 s to
the first request; warm numbers are the comparison basis.

## Notes

- `/work?tab=deliverables` and `/work?tab=tasks` return the **same 6 MB body** — the tab
  param is client-side only; the endpoint ships every deliverable AND every task with all
  rollups on every call.
- Reference deployment (must match at all times):
  https://transform-platform-git-develop-kevins-projects-e3a4abb1.vercel.app
- Login: kevin.hicks@capgemini.com / demo1234 (ADMIN).
