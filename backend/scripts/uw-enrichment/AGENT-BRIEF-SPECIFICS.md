# Underwriting task enrichment — SPECIFIC STEPS pass

The generic template answers are already filled. Now add the **item-specific procedure** for
each L5 Underwriting task, matching the GOLD-STANDARD SED task **"Initiate project or sprint"**
exactly.

## The gold-standard shape (copy this style precisely, not its content)

"Initiate project or sprint" has 11 numbered steps; each step is a PAIR of rows:

CHECKLIST row — customKey `1. Create the sprint with start plus end dates in Jira`, value:

```
By the Scrum Master:
1) Open the team's project in Jira and select the Backlog view of the Scrum board
2) Click Create sprint above the backlog list
3) Open the new sprint's actions menu and choose Edit sprint
4) Enter the sprint name, set the start date, then the end date exactly 2 weeks later, save
Done when the board shows the sprint header with its start and end dates
```

TEST row — customKey `1. Verify: Create the sprint with start plus end dates in Jira`, value:

```
By the Product Owner:
1) Open the Scrum board in Jira and locate the sprint on the Backlog view
2) Open Edit sprint and read the start and end dates
Pass when the sprint exists and the dates span exactly 2 weeks
```

So EVERY step shows the three things the user asked for:

1. **WHO does the work** — the `By the <Role>:` first line. The performer (often the Owner, but
   pick whichever role on the task realistically does THAT action) does the checklist; a
   different role — the approver/reviewer Participant — does the Verify.
2. **The exact steps in the tool** — numbered clicks/entries naming the real system
   (Guidewire PolicyCenter, Earnix, OpenText, SERFF, LexisNexis, MIB, Archer GRC, Power BI,
   ALIP, the underwriting workstation… — the apps actually on this task).
3. **The definition of done** — the checklist ends with a `Done when …` line; the Verify ends
   with a `Pass when …` line.

## Inputs

- This brief.
- `spec-tasks-NN.json` (NN from your prompt): your chunk, each task =
  `{ id, name, description, l3, l4, owner, participants[], apps[] }` (post-cleanup).
- No other file needed; the gold standard above is the bar.

## Output

Write `spec-dec-NN.json` (same NN): `{ "tasks": [ { id, steps: [...] } ] }`, each step:

```json
{
  "title": "<short imperative step name, ending with the tool, e.g. 'Verify bind authority in PolicyCenter'>",
  "performer": "<role on this task who does the action>",
  "checklist": "By the <performer>:\n1) ...\n2) ...\nDone when <definition of done>",
  "verifier": "<role on this task who checks it>",
  "testing": "By the <verifier>:\n1) ...\nPass when <definition of done>"
}
```

## Rules

- **6–11 steps per task** that trace the ACTUAL work of THIS task start to finish, in order.
  Fewer only for genuinely trivial tasks; never fewer than 5.
- Checklist value ALWAYS ends with a line starting `Done when `. Testing value ALWAYS ends
  with a line starting `Pass when `. Both start with `By the <Role>:`.
- `performer`/`verifier` must be roles actually on the task (Owner or a Participant). Performer
  ≠ verifier where the task has an approver; if the task has only an Owner, Owner verifies too.
- Ground every step in real underwriting practice for the task's line of business (infer from
  name + l3 + l4) and the specific systems on the task (`apps`). Name real fields, screens,
  record/folder conventions, thresholds, SLAs, authority-matrix versions, sample sizes — the
  gold standard's density. No vague "review the data" filler.
- Keep systems/conventions consistent across your chunk (it shares an L3/L4 area).
- Valid JSON, no trailing commas, each task present exactly once, `id` copied verbatim.
