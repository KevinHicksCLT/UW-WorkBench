import json, os, re, sys
import psycopg2
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
OUT="documents/value-streams/_master_build"
# read DATABASE_URL from backend/.env without printing the secret
url=None
for line in open("backend/.env", encoding="utf-8"):
    line=line.strip()
    if line.startswith("DATABASE_URL"):
        url=line.split("=",1)[1].strip().strip('"').strip("'"); break
if not url: print("NO DATABASE_URL"); sys.exit(1)
m=re.search(r'@([^/]+)/([^?]+)', url)
print("DB host/db:", m.group(1) if m else "?", "/", m.group(2) if m else "?")
conn=psycopg2.connect(url); conn.set_session(readonly=True, autocommit=True)
cur=conn.cursor()
def dump(name, sql):
    cur.execute(sql)
    cols=[d[0] for d in cur.description]
    rows=[dict(zip(cols,r)) for r in cur.fetchall()]
    # stringify non-serializable
    for r in rows:
        for k,v in list(r.items()):
            if v is not None and not isinstance(v,(str,int,float,bool)): r[k]=str(v)
    json.dump(rows, open(f"{OUT}/db_{name}.json","w",encoding="utf-8"), ensure_ascii=False)
    print(f"  db_{name}.json: {len(rows)} rows")
    return len(rows)
Q={
"vs":'SELECT vs.name vs, COALESCE(d.name,vs.domain) domain FROM "ValueStream" vs LEFT JOIN "ValueStreamDomain" d ON d.id=vs."domainId"',
"rvs":'SELECT vs.name vs, r.name role, rvs."participationType" pt, rvs."subStream" sub FROM "RoleValueStream" rvs JOIN "ValueStream" vs ON vs.id=rvs."valueStreamId" JOIN "Role" r ON r.id=rvs."roleId"',
"avs":'SELECT vs.name vs, a.name app, avs."systemRole" sr FROM "ApplicationValueStream" avs JOIN "ValueStream" vs ON vs.id=avs."valueStreamId" JOIN "Application" a ON a.id=avs."applicationId"',
"reqvs":'SELECT vs.name vs, rr.title, rr.category, x.relationship FROM "RequirementValueStream" x JOIN "ValueStream" vs ON vs.id=x."valueStreamId" JOIN "RegulatoryRequirement" rr ON rr.id=x."requirementId"',
"metric":'SELECT vs.name vs, m.name, m.l3, m.unit FROM "Metric" m JOIN "ValueStream" vs ON vs.id=m."valueStreamId"',
"io":'SELECT vs.name vs, io.l3, io.l4, io.type, io.name, io."keyRoles" FROM "IoItem" io JOIN "ValueStream" vs ON vs.id=io."valueStreamId"',
"step":'SELECT vs.name vs, ps.l3, ps.l4, ps.code, ps.name, ps.leads, ps.supporting, ps."externalParticipants" ext FROM "ProcessStep" ps JOIN "ValueStream" vs ON vs.id=ps."valueStreamId"',
"stepapp":'SELECT ps.code, ps.l3, ps.l4, a.name app, sau."usageType" usage, sau."activityCode" ac FROM "StepAppUsage" sau LEFT JOIN "ProcessStep" ps ON ps.id=sau."processStepId" LEFT JOIN "Application" a ON a.id=sau."applicationId"',
"stepdel":'SELECT ps.code, ps.l3, ps.l4, sd.name, sd."approverRoleRaw" approver, a.name sor, sd."activityCode" ac FROM "StepDeliverable" sd LEFT JOIN "ProcessStep" ps ON ps.id=sd."processStepId" LEFT JOIN "Application" a ON a.id=sd."sorApplicationId"',
"subvs":'SELECT vs.name vs, sv.level, sv.code, sv.name, sv."keyRoles" key_roles, sv."participationFocus" pf FROM "SubValueStream" sv JOIN "ValueStream" vs ON vs.id=sv."valueStreamId"',
"deliv":'SELECT vs.name vs, d.title, d.owner, d.type, d.status FROM "Deliverable" d LEFT JOIN "ValueStream" vs ON vs.id=d."valueStreamId"',
"role":'SELECT name, "roleFamily" fam, "roleLevel" lvl, "primaryDomain" dom, "primaryValueStream" pvs, "managerRoleId" mgr, id FROM "Role"',
"app":'SELECT name, kind, category, vendor, "systemOfRecord" sor, code, description FROM "Application"',
"standard":'SELECT department, count, owner, mission, scope FROM "Standard"',
"ext":'SELECT "partyType" pt, "externalRole" er, "internalRoleOwner" iro, "interactionType" it, "relatedValueStream" rvs, "dependencyType" dep, frequency FROM "ExternalInteraction"',
}
tot=0
for n,s in Q.items():
    try: tot+=dump(n,s)
    except Exception as e: print(f"  ERR {n}: {e}")
print("TOTAL rows:", tot)
cur.close(); conn.close()
