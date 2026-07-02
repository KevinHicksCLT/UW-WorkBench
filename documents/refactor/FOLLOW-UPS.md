# Refactor Follow-ups (post-cutover hardening)

Items consciously deferred from the overnight big-bang refactor, with rationale.

## 1. Converge the spine-pair composites into shared engines

The primitive layer is unified (`components/ui/`), but three composite *pattern pairs*
remain — one implementation per spine:

| Pattern | Process-spine impl | Org-spine impl |
| --- | --- | --- |
| Tree-drill list explorer | `components/ListExplorer.tsx` | `components/OrgListExplorer.tsx` |
| Interactive map canvas | `viz/MapCanvas.tsx` (+ `viz/map/*`) | `viz/OrgMapCanvas.tsx` (+ `viz/org/*`) |
| Hierarchy chart | — | `components/RolesOrgChart.tsx` |

Target shape: **shared engine + thin adapters**, not one mega-component with dozens of
config flags. Extract the generic machinery (closure-walking drill state, focus/zoom,
breadcrumb wiring, layout math) into one engine per pattern with render-prop slots;
each tab supplies a small adapter (data mapping, labels, level semantics). `Sheet.tsx`
already plays this role for flat lists — the explorers/canvases should reach the same
grain.

Deferred because merging two ~1,000-line interactive canvases is a behavior rewrite,
not code motion — incompatible with the pixel-identical guarantee of the cutover
baseline. Do it behind the now-existing E2E + unit-test harness, one pattern at a time.

## 2. React-Compiler-era hook lint rules

`react-hooks` set-state-in-effect / use-memo / purity / exhaustive-deps are disabled
(documented in `eslint.config.js`). Re-enable one rule at a time post-cutover; each fix
changes effect timing and needs the smoke suite run.

## 3. sonarjs/cognitive-complexity ratchet

Disabled during the structural refactor. Re-enable at a threshold the post-split code
already meets, then ratchet down.

## 4. Security & tenant isolation review

Charter Task 14 — explicitly on hold. Revisit before multi-company production
onboarding (tenant-isolation tests, dependency scanning in CI, secrets rotation:
JWT_SECRET + the committed-in-.env API keys should move to a secrets manager).

## 5. /work payload pagination

`GET /work` still ships a 6 MB body (all deliverables + tasks + rollups) by design —
the body is part of the frozen baseline contract. Real fix is pagination/virtualized
fetch + a frontend change, done together after cutover.
