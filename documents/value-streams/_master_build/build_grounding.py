# -*- coding: utf-8 -*-
# Grounding for the MIDDLE rebuild: keep L1-L4 skeleton (from v007), regenerate logical L5 + associations.
import json, re, sys
from collections import defaultdict, Counter
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
O = "documents/value-streams/_master_build"
def L(n): return json.load(open(f"{O}/{n}", encoding="utf-8"))
def nk(s): return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

v007 = L("wb_v007.json"); db_role = L("db_role.json"); bmet = L("wb_metrics.json"); stds = L("wb_standards.json")
VF = L("vs_fill.json"); vsapps = VF["vsapps"]; vsreg_n = VF["vsreg_n"]; vsreg_titles = VF["vsreg_titles"]
PRODF = "C:/Users/xando/.claude/projects/C--Users-xando-Code-transform-platform/ef5e9499-acfa-4c2b-a6ad-9f6711879ab5/tool-results/mcp-Neon-run_sql-1782174530544.txt"
prod = json.load(open(PRODF, encoding="utf-8"))[0]["data"]

XWALK = {
 "actuarial": ["Actuarial Pricing, Reserving & Capital Modeling"],
 "business operations": ["Policy Administration & Servicing", "Service Operations, Incident & Production Support"],
 "call center": ["Customer Service, Complaints & Experience"],
 "claims": ["Claims Intake-to-Settlement", "Claims Recoveries & Subrogation", "Life & Annuity Claims"],
 "corporate functions operations": ["Enterprise Strategy & Portfolio Management", "Third-Party & Vendor Management"],
 "cybersecurity iam": ["Cybersecurity, Identity & Resilience"],
 "data ai": ["Data, Analytics & AI Management", "MLOps / ML Lifecycle Management", "AIOps & Intelligent Operations"],
 "finance investments": ["Finance, Treasury & Capital Management", "Investment & Asset Management", "FinOps / Cloud Financial Management", "Billing, Collections & Receivables"],
 "human resources talent": ["Talent & Workforce Management"],
 "legal corporate governance": ["Legal, Governance & Privacy Management"],
 "product delivery": ["Product & Proposition Management", "Technology Delivery & Change"],
 "program management office": ["Change Management & Adoption"],
 "reinsurance": ["Reinsurance & Retrocession Management"],
 "risk compliance audit": ["Risk, Compliance & Regulatory Management", "Audit & Assurance"],
 "sales distribution marketing": ["Distribution & Channel Management", "Marketing, Growth & Customer Insights"],
 "technology engineering": ["Technology Strategy, Architecture & Delivery"],
 "underwriting": ["Submission-to-Bind / Underwriting", "Delegated Authority Management"],
}
STD_X = {"actuarial":"actuarial","claims":"claims","underwriting":"underwriting","technology engineering":"engineering",
 "data ai":"data","finance investments":"finance","human resources talent":"hr","risk compliance audit":"compliance",
 "legal corporate governance":"legal","cybersecurity iam":"cyber","product delivery":"pmo","program management office":"pmo",
 "business operations":"operations","call center":"operations","corporate functions operations":"operations"}
rolelvl = {nk(r.get("name")): nk(r.get("lvl")) for r in db_role if r.get("name")}
EXEC = {"executive", "leadership"}
def is_exec(name):
    n = nk(name); return rolelvl.get(n) in EXEC or n.startswith("chief ") or n.startswith("head of") or "officer" in n
std_map = {nk(r.get("Department / Team")): {"count": r.get("Standards Count"), "owner": r.get("Primary Owner")} for r in stds if r.get("Department / Team")}
met_by = defaultdict(set)
for r in bmet: met_by[nk(r.get("L2 Value Stream"))].add(r.get("Metric Name"))
# prod vs_roles per vs
prod_roles = defaultdict(set)
for r in prod:
    for x in [s.strip() for s in (r.get("vs_roles") or "").split(";") if s.strip()]: prod_roles[nk(r.get("vs"))].add(x)

# ---- skeleton: distinct L1/L2/L3/L4 from v007, grouped by L3
l4_by_l3 = {}
for r in v007:
    l1, l2, l3, l4 = r.get("L1 Segment"), r.get("L2 Division"), r.get("L3 Process"), r.get("L4 Sub-Process")
    key = f"{l2} || {l3}"
    g = l4_by_l3.setdefault(key, {"l1": l1, "l2": l2, "l3": l3, "l4s": []})
    if l4 and l4 not in g["l4s"]: g["l4s"].append(l4)
json.dump(l4_by_l3, open(f"{O}/l4_by_l3.json", "w", encoding="utf-8"), ensure_ascii=False)

# ---- pools per division
pools = {}
for dnk, disp in {nk(r["L2 Division"]): r["L2 Division"] for r in v007}.items():
    vss = XWALK.get(dnk, [])
    roles = set(); apps = set(); metrics = set(); regn = 0; regt = ""
    for vs in vss:
        v = nk(vs)
        roles |= prod_roles.get(v, set()); apps |= set(vsapps.get(v, [])); metrics |= met_by.get(v, set())
        if vsreg_n.get(v, 0) > regn: regn = vsreg_n.get(v, 0); regt = vsreg_titles.get(v, "")
    doers = sorted([r for r in roles if r and not is_exec(r)])
    execs = sorted([r for r in roles if r and is_exec(r)])
    kw = STD_X.get(dnk); std = ""
    if kw:
        for dk, dv in std_map.items():
            if kw in dk: std = f"{dv['count']} standards - {dv['owner']}"; break
    pools[disp] = {"value_streams": vss, "doer_roles": doers, "senior_roles": execs,
                   "applications": sorted(apps), "standards": std,
                   "regulations": (f"{regn} requirements - {regt}".strip(" -") if regn else ""),
                   "metrics": sorted([m for m in metrics if m])}
json.dump(pools, open(f"{O}/pools_by_division.json", "w", encoding="utf-8"), ensure_ascii=False)

print("l4_by_l3.json:", len(l4_by_l3), "L3 groups |", sum(len(g["l4s"]) for g in l4_by_l3.values()), "L4 total")
print("pools_by_division.json:", len(pools), "divisions")
# show pilot candidates (moderate L4 counts) in key divisions
for div in ["Underwriting", "Claims", "Actuarial"]:
    ks = [(k, len(g["l4s"])) for k, g in l4_by_l3.items() if g["l2"] == div]
    print(f"\n{div}: {len(ks)} L3 groups; sample:")
    for k, n in sorted(ks, key=lambda x: x[1])[:6]: print(f"   ({n} L4s)  {k}")
    p = pools.get(div, {})
    print(f"   doer_roles({len(p.get('doer_roles',[]))}): {p.get('doer_roles',[])[:8]}")
    print(f"   apps: {p.get('applications')}")
