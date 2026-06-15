# Live evidence — controls bound to real sources

This folder holds worked examples of binding controls to **live sources** instead of synthetic
fixtures — the acquire → evaluate → evidence → surface-debt loop running against real data. Two
bindings ship here:

- **SOX-ITGC-CM-02** → local **Git** history (SCM/Git).
- **SOX-ELC-404-02** → **Linear** via the Linear **MCP** (ITSM) — see the section at the bottom.

## SOX-ITGC-CM-02 ("developers cannot approve or deploy their own changes") → Git

## What's here

| File | What it is |
|---|---|
| `SOX-ITGC-CM-02.snapshot.json` | Immutable evidence snapshot: every PR-merge on `master` with its merger, change-author, self-merge flag, and PR URL, plus provenance (repo, HEAD SHA, method, review-source status). |
| `SOX-ITGC-CM-02.live-run.json` | The control run produced from that snapshot — schema-valid, with the assertion results, the opened issue, and the blocked downstream artifact. |
| `../fixtures/SOX-ITGC-CM-02.live.fixture.json` | The live metrics the run evaluated (regenerated each collection). |

## How it was produced

```bash
# 1. Bind the live git source and capture the evidence snapshot + live fixture
node standards/control-framework/cli/collect-git.mjs sox SOX-ITGC-CM-02

# 2. Evaluate the control against the live data
node standards/control-framework/cli/run-one.mjs sox SOX-ITGC-CM-02 fixtures/SOX-ITGC-CM-02.live.fixture.json
```

The collector is [`control-framework/lib/collectors/git-merge-approval.mjs`](../../../control-framework/lib/collectors/git-merge-approval.mjs).

## The real finding

This repository is a **single-developer** project: all PR merges to `master` were authored and
merged by the same identity, and no independent code-review approval could be evidenced. The control
**fails** both assertions (`self_approved_merges = 0`, `self_deploys = 0`) — an honest ITGC change
segregation-of-duties gap that a SOX auditor would flag.

## Honest source boundary (and how to close it)

Local Git proves **who merged and authored** each change. It cannot prove an **independent reviewer
approved** it — that lives in the GitHub review API / GitHub MCP. Because that source was not reachable
here (the repo is private and no token was supplied), no merge could be evidenced as independently
approved, so every merge is counted as self-approved and the missing review source is reported as a
**Missing-Source** technical-debt signal.

To enrich with real review data, supply a token and re-run — the collector will call the GitHub
review API and replace the conservative assumption with actual approval facts:

```bash
GH_TOKEN=<token> node standards/control-framework/cli/collect-git.mjs sox SOX-ITGC-CM-02
```

(In production this is the **GitHub MCP** server — same data, no token handling. The connector is
catalogued as `scm.github` in `control-framework/source-connectors.md`.)

---

## SOX-ELC-404-02 ("remediation tracked to closure with owner and due date") → Linear (MCP)

A second live binding, this time to an **authenticated MCP** rather than git.

| File | What it is |
|---|---|
| `SOX-ELC-404-02.linear-raw.json` | Immutable capture of the Linear `list_issues` result (the raw evidence as returned by the MCP). |
| `SOX-ELC-404-02.snapshot.json` | Derived evidence snapshot: per-item owner / due-date / priority + provenance. |
| `SOX-ELC-404-02.live-run.json` | The schema-valid control run produced from the live data. |

How it was produced (the agent performs the MCP acquisition; the deterministic transform is code):

```bash
# 1. Agent calls the Linear MCP (list_issues) and captures the result to
#    live/SOX-ELC-404-02.linear-raw.json  (the immutable evidence)
# 2. Derive metrics + live fixture from that capture:
node standards/control-framework/cli/collect-linear.mjs sox SOX-ELC-404-02
# 3. Evaluate:
node standards/control-framework/cli/run-one.mjs sox SOX-ELC-404-02 fixtures/SOX-ELC-404-02.live.fixture.json
```

Collector: [`control-framework/lib/collectors/linear-remediation.mjs`](../../../control-framework/lib/collectors/linear-remediation.mjs)
(`deriveMetrics()` is pure and unit-tested). Connector: `itsm.linear`.

**The real finding:** the live Linear workspace has 4 open items, **none with an owner, priority, or
due date** → the control **fails** (`items_without_owner = 4`, `items_without_due_date = 4`),
opening an issue and blocking the downstream §404 assessment. An honest deficiency-tracking gap,
evidenced straight from the authenticated MCP.
