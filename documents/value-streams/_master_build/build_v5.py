# -*- coding: utf-8 -*-
"""
build_v5.py — Stage A of the erd_v5 ingest pipeline.

Reads the single sheet `MASTER - L5` of
    documents/value-streams/Master Documentation/ABC-Insurance-Operating-Model-MASTER-v14-TESTPLAN.xlsx
and writes a normalized, deduplicated JSON at
    backend/data/seed/master_v5.json
which the TypeScript Prisma loader (seedMaster.ts) consumes — it never reads the .xlsx.

Normalization idioms are reused from the sibling scripts:
  - extract_wb.py  -> norm() (None-safe strip)
  - build_master.py -> nkey() (lowercase / collapse non-alnum), used here for PATH keying
Role canonicalization is a Python port of backend/src/lib/roleMatch.ts (ABBR expand +
lowercase + paren-strip + "A / B" -> first-segment) so seed-time dedup agrees with the
TS loader's resolver.
"""
import json
import os
import re
import sys

import openpyxl

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
XLSX = os.path.join(
    ROOT,
    "documents", "value-streams", "Master Documentation",
    "ABC-Insurance-Operating-Model-MASTER-v14-TESTPLAN.xlsx",
)
OUT = os.path.join(ROOT, "backend", "data", "seed", "master_v5.json")
SHEET = "MASTER - L5"

# ---------------------------------------------------------------------------
# Normalization helpers (reused idioms)
# ---------------------------------------------------------------------------


def norm(s):
    """None-safe trim — from extract_wb.py."""
    return "" if s is None else str(s).strip()


def nkey(s):
    """Lowercase, collapse runs of non-alphanumerics to single spaces — from build_master.py.
    Used to build path keys so the same L3/L4 name under different parents stays distinct."""
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


# ---------------------------------------------------------------------------
# Role canonicalization — Python port of backend/src/lib/roleMatch.ts
# ---------------------------------------------------------------------------

# Abbreviation expansion table, ported 1:1 from roleMatch.ts ABBR (\b...\b word boundaries).
_ABBR = [
    (re.compile(r"\bops\b"), "operations"),
    (re.compile(r"\bmgmt\b"), "management"),
    (re.compile(r"\bmgr\b"), "manager"),
    (re.compile(r"\buw\b"), "underwriting"),
    (re.compile(r"\bdev\b"), "development"),
    (re.compile(r"\badmin\b"), "administration"),
    (re.compile(r"\bintel\b"), "intelligence"),
    (re.compile(r"\bauto\b"), "automation"),
    (re.compile(r"\beng\b"), "engineering"),
    (re.compile(r"\bsec\b"), "security"),
    (re.compile(r"\binfo\b"), "information"),
    (re.compile(r"\bri\b"), "reinsurance"),
    (re.compile(r"\biam\b"), "identity access management"),
    (re.compile(r"\bcat\b"), "catastrophe"),
    (re.compile(r"\bcfo\b"), "chief financial officer"),
    (re.compile(r"\bceo\b"), "chief executive officer"),
]


def _str(v):
    """roleMatch.ts str(): trim + collapse internal whitespace."""
    return "" if v is None else re.sub(r"\s+", " ", str(v).strip())


def _base_norm(v):
    """roleMatch.ts baseNorm(): lowercase, strip parenthised groups, drop punctuation
    except '/' and space, collapse whitespace."""
    s = _str(v).lower()
    s = re.sub(r"\s*\([^)]*\)\s*", " ", s)
    s = re.sub(r"[^a-z0-9/ ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _expand(s):
    """roleMatch.ts expand(): apply ABBR table, collapse whitespace."""
    for rx, rep in _ABBR:
        s = rx.sub(rep, s)
    return re.sub(r"\s+", " ", s).strip()


def role_canonical(v):
    """The canonical key for a role name: full expanded form ('/' -> space).
    Mirrors candidates()[0] in roleMatch.ts (the 'full' candidate), which is what
    the resolver indexes first. Returns '' for empty/garbage tokens."""
    b = _base_norm(v)
    if not b:
        return ""
    return _expand(b.replace("/", " "))


def split_roles(cell):
    """Owner is a single role; Participants split on ';' and newlines (per the plan)."""
    if not cell:
        return []
    parts = re.split(r"[;\n]+", str(cell))
    return [p.strip() for p in parts if p.strip()]


def split_apps(cell):
    """Supporting apps split on ';' and newlines."""
    if not cell:
        return []
    parts = re.split(r"[;\n]+", str(cell))
    return [p.strip() for p in parts if p.strip()]


def app_canonical(name):
    """Apps dedup on a trimmed, whitespace-collapsed, case-insensitive key but the
    stored dbValue keeps the original display casing of the first occurrence."""
    return re.sub(r"\s+", " ", name.strip()).lower()


_NUM_PREFIX = re.compile(r"^\s*\(?\d+[.)\]:-]+\s*")


def strip_numbering(line):
    """Strip a leading list number like '1. ', '2) ', '3- ', '(4) '."""
    return _NUM_PREFIX.sub("", line).strip()


def norm_automatability(v):
    """Map col 13 to manual|augmented|automated; null otherwise."""
    t = norm(v).lower()
    return t if t in ("manual", "augmented", "automated") else None


def parse_seq(v, fallback):
    """Seq 'L4.L5' (e.g. '1.1', '12.3', '12.10') -> a single Int sort key that
    preserves BOTH the L4 (major) and the L5 (minor) order within a parent.

    The loader rounds sortOrder to an Int, so a float like 12.3 / 12.10 collapses
    to 12 and loses the within-parent order. Encode it as  L4*1000 + L5  instead,
    so 12.3 -> 12003, 12.10 -> 12010 sort correctly after 12.3. Non-numeric /
    blank Seq falls back to row order (also *1000 so it stays interleaved sanely)."""
    t = norm(v)
    if not t:
        return int(fallback) * 1000
    nums = re.findall(r"\d+", t)
    if not nums:
        return int(fallback) * 1000
    major = int(nums[0])
    minor = int(nums[1]) if len(nums) > 1 else 0
    return major * 1000 + minor


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

PROCESS_LEVEL_TYPES = [
    {"levelNumber": 1, "dbValue": "L1", "displayValue": "Segment"},
    {"levelNumber": 2, "dbValue": "L2", "displayValue": "Division"},
    {"levelNumber": 3, "dbValue": "L3", "displayValue": "Process"},
    {"levelNumber": 4, "dbValue": "L4", "displayValue": "Sub-Process"},
    {"levelNumber": 5, "dbValue": "L5", "displayValue": "Task"},
]
ORG_LEVEL_TYPES = [
    {"levelNumber": 1, "dbValue": "L1", "displayValue": "Segment"},
    {"levelNumber": 2, "dbValue": "L2", "displayValue": "Division"},
]

# ---------------------------------------------------------------------------
# Left-to-right ordering of the process tree (the map renders siblings by
# sortOrder; ties fall back to alphabetical which is NOT the value chain).
#   L1: fixed segment order.
#   L2: authored value-chain flow per segment (NOT the workbook's alphabetical
#       row order). Keys are exact workbook dbValues.
#   L3: workbook first-appearance row order (deliberate analytical sequence).
#   L4: Seq major (its position within the L3).
#   L5: Seq major*1000 + minor (parse_seq).
# ---------------------------------------------------------------------------
L1_ORDER = {
    "Core Business": 0,
    "Corporate Functions": 1,
    "Technology": 2,
}
L2_FLOW = {
    # Core Business — operating value chain
    ("Core Business", "Product & Delivery"): 0,
    ("Core Business", "Sales, Distribution & Marketing"): 1,
    ("Core Business", "Underwriting"): 2,
    ("Core Business", "Business Operations"): 3,
    ("Core Business", "Claims"): 4,
    ("Core Business", "Reinsurance"): 5,
    ("Core Business", "Actuarial"): 6,
    ("Core Business", "Call Center"): 7,
    ("Core Business", "Corporate Functions Operations"): 8,
    # Corporate Functions — finance → control → people → delivery
    ("Corporate Functions", "Finance & Investments"): 0,
    ("Corporate Functions", "Risk, Compliance & Audit"): 1,
    ("Corporate Functions", "Legal & Corporate Governance"): 2,
    ("Corporate Functions", "Human Resources & Talent"): 3,
    ("Corporate Functions", "Program Management Office"): 4,
    # Technology — build → data → secure
    ("Technology", "Technology & Engineering"): 0,
    ("Technology", "Data & AI"): 1,
    ("Technology", "Cybersecurity & IAM"): 2,
}


def seq_major(v, fallback):
    """The L4-position component of a 'L4.L5' Seq cell. Falls back to row index."""
    nums = re.findall(r"\d+", norm(v))
    return int(nums[0]) if nums else int(fallback)


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb[SHEET]
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    # Process tree: keyed by full normalized path so (parent,name) collapses to one node
    # while the same name under a different parent stays distinct.
    process_nodes = {}  # key -> node dict
    org_units = {}      # key -> org unit dict

    roles = {}          # canonical -> dbValue (first display form seen)
    apps = {}           # canonical -> dbValue (first display form seen)

    l3_order = {}       # l3 path key -> sortOrder (workbook first-appearance order)
    l3_counter = [0]

    # Deliverables are now ONE-PER-L4-SUB-PROCESS (a grouping of its L5 tasks),
    # NOT one-per-task. Keyed by the L4 path key; title = the L4 sub-process name.
    # The per-task workbook deliverable TEXT is preserved on the L5 task node
    # (attributes.deliverable) so it still renders in task detail.
    deliverables = {}      # l4Key -> {l4Key, l4Name, autos: [..task automatabilities..]}
    checklists = []
    testing = []           # per-task, but carries l4Key (loader ties to the L4 deliverable)
    node_role = []
    node_app_usage = []
    node_deliverable = []   # built post-loop: L4 deliverable -> L4 node + each L5 task node

    def ensure_path_node(store, names, level, sort_order=None,
                         is_task=False, automatability=None, attributes=None):
        """Insert (or fetch) a node keyed by the full path of nkey(name) segments."""
        key = "/".join(nkey(n) for n in names)
        parent_key = "/".join(nkey(n) for n in names[:-1]) if level > 1 else None
        if key not in store:
            node = {
                "key": key,
                "levelNumber": level,
                "parentKey": parent_key,
                "dbValue": names[-1],
            }
            if store is process_nodes:
                node["isTask"] = is_task
                node["automatability"] = automatability
                node["sortOrder"] = sort_order
                node["attributes"] = attributes or {}
            else:
                node["sortOrder"] = sort_order  # org units carry value-chain order too
            store[key] = node
        return key

    for ridx, r in enumerate(rows):
        cells = list(r) + [None] * (18 - len(r))  # pad short rows
        l1, l2, l3, l4, l5 = (norm(cells[i]) for i in range(5))
        if not any([l1, l2, l3, l4, l5]):
            continue  # fully-blank row

        is_task_flag = norm(cells[5]).upper() == "Y"
        owner_role = cells[6]
        part_roles = cells[7]
        primary_app = norm(cells[8])
        supporting = cells[9]
        deliverable = norm(cells[10])
        checklist_cell = cells[11]
        testing_cell = norm(cells[12])
        automatability = norm_automatability(cells[13])
        owner_level = norm(cells[14]) or None
        verified = norm(cells[15]) or None
        issues = norm(cells[16]) or None
        seq = cells[17]

        # --- Process tree L1..L5 ---
        names = [l1, l2, l3, l4, l5]
        path = []
        task_key = None
        l4_key = None
        for lvl, name in enumerate(names, start=1):
            if not name:
                break
            path.append(name)
            if lvl == 4:
                l4_key = "/".join(nkey(n) for n in path)
            is_leaf = lvl == 5

            # Per-level left-to-right sortOrder (see L1_ORDER / L2_FLOW above).
            if lvl == 1:
                lvl_sort = L1_ORDER.get(name, 99)
            elif lvl == 2:
                lvl_sort = L2_FLOW.get((l1, name), 99)
            elif lvl == 3:
                k3 = "/".join(nkey(n) for n in path)
                if k3 not in l3_order:
                    l3_order[k3] = l3_counter[0]
                    l3_counter[0] += 1
                lvl_sort = l3_order[k3]
            elif lvl == 4:
                lvl_sort = seq_major(seq, ridx)
            else:  # L5
                lvl_sort = parse_seq(seq, ridx)

            attrs = {}
            if is_leaf:
                if verified is not None:
                    attrs["verified"] = verified
                if issues is not None:
                    attrs["issues"] = issues
                # Preserve the task's own workbook deliverable text on the L5 node,
                # so it still shows in task detail now that the Deliverable row is
                # the L4-grain grouping rather than this one task's output.
                if deliverable:
                    attrs["deliverable"] = deliverable
            node_key = ensure_path_node(
                process_nodes, path, lvl,
                sort_order=lvl_sort,
                is_task=(is_task_flag if is_leaf else False),
                automatability=(automatability if is_leaf else None),
                attributes=attrs,
            )
            if is_leaf:
                task_key = node_key

        # --- Org units: L1 Segment + L2 Division only ---
        org_path = []
        for lvl, name in enumerate((l1, l2), start=1):
            if not name:
                break
            org_path.append(name)
            org_sort = L1_ORDER.get(name, 99) if lvl == 1 else L2_FLOW.get((l1, name), 99)
            ensure_path_node(org_units, org_path, lvl, sort_order=org_sort)

        if task_key is None:
            continue  # no L5 task on this row — nothing more to attach

        # --- Roles (dedup) + nodeRole ---
        owner_tokens = split_roles(owner_role)
        # owner cell is conceptually one role, but be robust to ';'-joined values
        for tok in owner_tokens:
            canon = role_canonical(tok)
            if not canon:
                continue
            if canon not in roles:
                roles[canon] = tok.strip()
            node_role.append({
                "taskKey": task_key,
                "roleDbValue": roles[canon],
                "role": "Owner",
                "ownerLevel": owner_level,
            })
        for tok in split_roles(part_roles):
            canon = role_canonical(tok)
            if not canon:
                continue
            if canon not in roles:
                roles[canon] = tok.strip()
            node_role.append({
                "taskKey": task_key,
                "roleDbValue": roles[canon],
                "role": "Participant",
                "ownerLevel": None,
            })

        # --- Applications (dedup) + nodeAppUsage ---
        if primary_app:
            ck = app_canonical(primary_app)
            if ck not in apps:
                apps[ck] = primary_app
            node_app_usage.append({
                "taskKey": task_key,
                "appDbValue": apps[ck],
                "usageType": "performed",
            })
        for tok in split_apps(supporting):
            ck = app_canonical(tok)
            if not ck:
                continue
            if ck not in apps:
                apps[ck] = tok.strip()
            node_app_usage.append({
                "taskKey": task_key,
                "appDbValue": apps[ck],
                "usageType": "memorialized",
            })

        # --- Deliverable (ONE PER L4 sub-process; this task contributes to it) ---
        # The L4 node always exists for an L5 task (strict L1..L5 tree). Record the
        # L4 grouping once and accumulate each task's automatability for the roll-up.
        if l4_key is not None:
            d = deliverables.get(l4_key)
            if d is None:
                d = {"l4Key": l4_key, "l4Name": l4, "autos": []}
                deliverables[l4_key] = d
            if automatability:
                d["autos"].append(automatability)

        # --- Checklist (1/task) + items ---
        if checklist_cell:
            items = []
            for line in str(checklist_cell).split("\n"):
                text = strip_numbering(line)
                if text:
                    items.append({"text": text, "sortOrder": len(items)})
            if items:
                checklists.append({
                    "taskKey": task_key,
                    "name": deliverable or l5,
                    "items": items,
                })

        # --- Testing (per-task; ties to the task's L4 deliverable via l4Key) ---
        if testing_cell:
            testing.append({
                "taskKey": task_key,
                "l4Key": l4_key,
                "deliverableTitle": deliverable or None,
                "system": primary_app or None,
                "expected": testing_cell,
            })

    # ----------------------------------------------------------------------
    # Finalize L4-grain deliverables + their nodeDeliverable links.
    #   • deliverable list: one row per L4 sub-process (title = L4 name,
    #     automatability = the most-common value among its L5 tasks, else null).
    #   • nodeDeliverable: link each L4 deliverable to the L4 node AND to every
    #     L5 task node under it, so node-scoped lens queries resolve the
    #     deliverable at any level (L4 or any of its tasks).
    # An L4 with NO recorded deliverable rows on any task still becomes a valid
    # 1-deliverable grouping (the workbook always has the L4; deliverables{} is
    # keyed off the task→L4 walk so every task-bearing L4 is present).
    def _mode(vals):
        if not vals:
            return None
        counts = {}
        for v in vals:
            counts[v] = counts.get(v, 0) + 1
        # most common; tie-break deterministically by token order
        return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]

    # Map each L4 key to its child L5 task node keys (a task key's first 4 path
    # segments are exactly its L4 key).
    l4_task_keys = {}
    for n in process_nodes.values():
        if n["levelNumber"] != 5:
            continue
        segs = n["key"].split("/")
        if len(segs) < 4:
            continue
        lk = "/".join(segs[:4])
        l4_task_keys.setdefault(lk, []).append(n["key"])

    deliverables_list = []
    single_task_l4s = []
    for lk, d in deliverables.items():
        deliverables_list.append({
            "l4Key": lk,
            "title": d["l4Name"],
            "automatability": _mode(d["autos"]),
        })
        # L4 node itself
        node_deliverable.append({"nodeKey": lk, "l4Key": lk})
        # each L5 task node under this L4
        tkeys = l4_task_keys.get(lk, [])
        for tk in tkeys:
            node_deliverable.append({"nodeKey": tk, "l4Key": lk})
        if len(tkeys) == 1:
            single_task_l4s.append((lk, d["l4Name"]))

    # Sort process nodes by (level, sortOrder/key) for stable, readable output
    proc_list = sorted(
        process_nodes.values(),
        key=lambda n: (n["levelNumber"], n.get("sortOrder") if n.get("sortOrder") is not None else 0, n["key"]),
    )
    org_list = sorted(
        org_units.values(),
        key=lambda n: (n["levelNumber"], n.get("sortOrder") if n.get("sortOrder") is not None else 0, n["key"]),
    )

    out = {
        "company": {"dbValue": "ABC Insurance", "displayValue": "ABC Insurance"},
        "processLevelTypes": PROCESS_LEVEL_TYPES,
        "orgLevelTypes": ORG_LEVEL_TYPES,
        "processNodes": proc_list,
        "orgUnits": org_list,
        "roles": [{"dbValue": v} for v in sorted(roles.values())],
        "applications": [{"dbValue": v, "kind": None} for v in sorted(apps.values())],
        "deliverables": deliverables_list,
        "checklists": checklists,
        "testing": testing,
        "nodeRole": node_role,
        "nodeAppUsage": node_app_usage,
        "nodeDeliverable": node_deliverable,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    # ----------------------------------------------------------------------
    # Verification
    # ----------------------------------------------------------------------
    by_level = {}
    for n in proc_list:
        by_level[n["levelNumber"]] = by_level.get(n["levelNumber"], 0) + 1

    print("=== build_v5.py summary ===")
    print(f"output: {OUT}")
    print("processNodes by level (L1..L5):")
    for lvl in range(1, 6):
        print(f"  L{lvl}: {by_level.get(lvl, 0)}")
    print(f"orgUnits: {len(org_list)} (L1={sum(1 for o in org_list if o['levelNumber']==1)}, "
          f"L2={sum(1 for o in org_list if o['levelNumber']==2)})")
    print(f"roles (distinct): {len(roles)}")
    print(f"applications (distinct): {len(apps)}")
    tasks_with_deliv = sum(
        1 for n in proc_list if n["levelNumber"] == 5 and (n.get("attributes") or {}).get("deliverable")
    )
    print(f"deliverables (one per L4 sub-process): {len(deliverables_list)}")
    print(f"  L5 tasks with attributes.deliverable text: {tasks_with_deliv}")
    print(f"  L4 deliverables grouping a single task: {len(single_task_l4s)}")
    print(f"checklists: {len(checklists)}  (items: {sum(len(c['items']) for c in checklists)})")
    print(f"testing: {len(testing)}")
    print(f"nodeRole: {len(node_role)}  nodeAppUsage: {len(node_app_usage)}  "
          f"nodeDeliverable: {len(node_deliverable)}")
    print("top-level keys:", list(out.keys()))

    # Hard assertion on the node tree — it defines correctness.
    expected = {1: 3, 2: 17, 3: 135, 4: 867, 5: 3811}
    actual = {lvl: by_level.get(lvl, 0) for lvl in range(1, 6)}
    assert actual == expected, f"process node tree mismatch: got {actual}, want {expected}"
    print("ASSERT OK: process node tree == 3/17/135/867/3811")

    # Deliverables are now one-per-L4: must equal the count of distinct
    # task-bearing L4s (≤ 867; equal when every L4 has ≥1 L5 task — which holds
    # for this strict tree). nodeDeliverable = #deliverables (L4 self-links) +
    # 3811 (one per task).
    assert len(deliverables_list) == len(l4_task_keys), \
        f"deliverable count {len(deliverables_list)} != task-bearing L4s {len(l4_task_keys)}"
    assert len(node_deliverable) == len(deliverables_list) + by_level.get(5, 0), \
        f"nodeDeliverable {len(node_deliverable)} != deliverables {len(deliverables_list)} + tasks {by_level.get(5,0)}"
    print(f"ASSERT OK: deliverables == task-bearing L4s == {len(deliverables_list)} "
          f"(was 3811 per-task); nodeDeliverable == {len(node_deliverable)}")

    # Soft checks (report deviation, don't fail).
    if abs(len(roles) - 257) > 25:
        print(f"WARN: distinct roles {len(roles)} deviates from target ~257")
    if abs(len(apps) - 65) > 15:
        print(f"WARN: distinct applications {len(apps)} deviates from target ~65")


if __name__ == "__main__":
    main()
