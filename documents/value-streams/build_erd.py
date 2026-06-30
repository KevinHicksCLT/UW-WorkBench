# Generates two ERDs (Mermaid erDiagram in standalone HTML): PROD and BRANCH.
# Same schema; each entity annotated with that environment's row count and an
# EMPTY flag, so the severed VS-link tables (0 rows on branch) stand out.
import os
HERE=os.path.dirname(os.path.abspath(__file__))

# entity -> list of (type, name, key)   key in {"PK","FK",""}
ENT={
 "Company":[("string","id","PK"),("string","tenantId","FK"),("string","name","")],
 "Division":[("string","id","PK"),("string","companyId","FK"),("string","name",""),("string","higherCategory","")],
 "Department":[("string","id","PK"),("string","divisionId","FK"),("string","name","")],
 "Role":[("string","id","PK"),("string","divisionId","FK"),("string","departmentId","FK"),("string","name",""),("string","primaryValueStream","")],
 "ValueStreamDomain":[("string","id","PK"),("string","companyId","FK"),("string","name","")],
 "ValueStream":[("string","id","PK"),("string","companyId","FK"),("string","domainId","FK"),("string","name","")],
 "SubValueStream":[("string","id","PK"),("string","valueStreamId","FK"),("string","parentId","FK"),("int","level",""),("string","name","")],
 "ProcessStep":[("string","id","PK"),("string","valueStreamId","FK"),("int","stepNumber",""),("string","name","")],
 "Level":[("string","id","PK"),("string","companyId","FK"),("string","parentId","FK"),("int","levelNumber",""),("string","name","")],
 "RoleValueStream":[("string","id","PK"),("string","roleId","FK"),("string","valueStreamId","FK"),("string","participationType","")],
 "ApplicationValueStream":[("string","id","PK"),("string","applicationId","FK"),("string","valueStreamId","FK")],
 "StepAppUsage":[("string","id","PK"),("string","processStepId","FK"),("string","applicationId","FK"),("string","usageType","")],
 "StepDeliverable":[("string","id","PK"),("string","processStepId","FK"),("string","name","")],
 "IoItem":[("string","id","PK"),("string","valueStreamId","FK"),("string","type",""),("string","name","")],
 "Metric":[("string","id","PK"),("string","valueStreamId","FK"),("string","name",""),("float","value","")],
 "RequirementValueStream":[("string","id","PK"),("string","valueStreamId","FK")],
 "InitiativeValueStream":[("string","id","PK"),("string","initiativeId","FK"),("string","valueStreamId","FK")],
 "Application":[("string","id","PK"),("string","companyId","FK"),("string","name",""),("string","category","")],
 "Initiative":[("string","id","PK"),("string","companyId","FK"),("string","name","")],
 "Deliverable":[("string","id","PK"),("string","companyId","FK"),("string","valueStreamId","FK"),("string","title","")],
 "Task":[("string","id","PK"),("string","deliverableId","FK"),("string","title",""),("string","status","")],
 "RoleTask":[("string","id","PK"),("string","roleId","FK"),("string","categoryId","FK"),("string","text","")],
 "ChecklistItem":[("string","id","PK"),("string","roleId","FK"),("string","categoryId","FK"),("string","text","")],
 "Category":[("string","id","PK"),("string","companyId","FK"),("string","name","")],
 "ExternalInteraction":[("string","id","PK"),("string","companyId","FK"),("string","internalRoleId","FK"),("string","partyType","")],
 "Standard":[("string","id","PK"),("string","companyId","FK"),("string","department","")],
 "StandardItem":[("string","id","PK"),("string","standardId","FK"),("string","ownerRoleId","FK"),("string","name","")],
 "NodeType":[("string","id","PK"),("string","key",""),("int","level","")],
 "Node":[("string","id","PK"),("string","companyId","FK"),("string","parentId","FK"),("string","typeKey",""),("string","name","")],
 "NodeLink":[("string","id","PK"),("string","fromNodeId","FK"),("string","toNodeId","FK"),("string","kind","")],
}

# relationships: (parent, child, cardinality, label)
REL=[
 ("Company","Division","||--o{","has"),("Company","Role","||--o{","employs"),
 ("Division","Department","||--o{","has"),("Division","Role","||--o{","staffs"),
 ("Department","Role","||--o{","contains"),
 ("Company","ValueStreamDomain","||--o{","defines"),("ValueStreamDomain","ValueStream","||--o{","groups"),
 ("Company","ValueStream","||--o{","owns"),
 ("ValueStream","SubValueStream","||--o{","decomposes"),("ValueStream","ProcessStep","||--o{","sequences"),
 ("Company","Level","||--o{","tree"),
 ("Role","RoleValueStream","||--o{","participates"),("ValueStream","RoleValueStream","||--o{","staffed-by"),
 ("Application","ApplicationValueStream","||--o{","supports"),("ValueStream","ApplicationValueStream","||--o{","uses"),
 ("ProcessStep","StepAppUsage","||--o{","uses"),("Application","StepAppUsage","||--o{","used-at"),
 ("ProcessStep","StepDeliverable","||--o{","produces"),
 ("ValueStream","IoItem","||--o{","io"),("ValueStream","Metric","||--o{","measured-by"),
 ("ValueStream","RequirementValueStream","||--o{","governed-by"),
 ("Initiative","InitiativeValueStream","||--o{","targets"),("ValueStream","InitiativeValueStream","||--o{","impacted-by"),
 ("Company","Application","||--o{","catalog"),("Company","Initiative","||--o{","runs"),
 ("Company","Deliverable","||--o{","tracks"),("ValueStream","Deliverable","|o--o{","optional"),
 ("Deliverable","Task","||--o{","breaks-into"),
 ("Role","RoleTask","||--o{","responsible-for"),("Role","ChecklistItem","||--o{","checklist"),
 ("Category","RoleTask","||--o{","groups"),("Category","ChecklistItem","||--o{","groups"),
 ("Company","Category","||--o{","defines"),
 ("Company","ExternalInteraction","||--o{","has"),("Role","ExternalInteraction","||--o{","internal"),
 ("Company","Standard","||--o{","has"),("Standard","StandardItem","||--o{","contains"),("Role","StandardItem","||--o{","owns"),
 ("Company","Node","||--o{","graph"),("Node","NodeLink","||--o{","from"),
]

# row counts: entity -> (prod, branch)
COUNTS={
 "Company":(1,1),"Division":(15,15),"Department":(99,99),"Role":(282,299),
 "ValueStreamDomain":(7,7),"ValueStream":(36,132),"SubValueStream":(1390,868),"ProcessStep":(1052,8355),"Level":(896,1012),
 "RoleValueStream":(523,0),"ApplicationValueStream":(63,0),"StepAppUsage":(1250,0),"StepDeliverable":(811,0),
 "IoItem":(962,0),"Metric":(267,0),"RequirementValueStream":(477,0),"InitiativeValueStream":(9,0),
 "Application":(61,56),"Initiative":(6,6),"Deliverable":(568,688),"Task":(5795,6256),"RoleTask":(5615,5698),
 "ChecklistItem":(5604,5604),"Category":(40,40),"ExternalInteraction":(27,277),"Standard":(13,13),"StandardItem":(1467,1391),
 "NodeType":(10,10),"Node":(2674,9782),"NodeLink":(3308,111),
}

def mermaid(env_idx):
    L=["erDiagram"]
    for e,attrs in ENT.items():
        cnt=COUNTS.get(e,(0,0))[env_idx]
        L.append(f"  {e} {{")
        L.append(f'    rows n{cnt} "{"EMPTY!" if cnt==0 else format(cnt,",")+" rows"}"')
        for t,n,k in attrs:
            L.append(f"    {t} {n}{' '+k if k else ''}")
        L.append("  }")
    for p,c,card,lab in REL:
        L.append(f'  {p} {card} {c} : "{lab}"')
    return "\n".join(L)

def html(env_name, env_idx, sub):
    empties=[e for e in ENT if COUNTS.get(e,(0,0))[env_idx]==0]
    emp = ("<b>Empty tables:</b> "+", ".join(empties)) if empties else "No empty core tables."
    mer=mermaid(env_idx)
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>ERD — {env_name}</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>body{{font-family:Segoe UI,Arial,sans-serif;margin:0;padding:20px;background:#fff;color:#222}}
h1{{color:#1F3864}} .meta{{font-size:13px;color:#555;margin-bottom:6px}}
.empty{{background:#FDEDEC;border:1px solid #C0392B;border-radius:8px;padding:10px 14px;font-size:13px;margin:10px 0}}
.mermaid{{font-size:13px}}</style></head><body>
<h1>Operating-Model ERD — {env_name}</h1>
<div class="meta">{sub}. Each entity shows its row count (or EMPTY) in this environment; PK/FK marked on attributes.</div>
<div class="empty">{emp}</div>
<pre class="mermaid">
{mer}
</pre>
<script>mermaid.initialize({{startOnLoad:true, er:{{layoutDirection:'LR'}}, securityLevel:'loose'}});</script>
</body></html>"""

for env_name,idx,sub,fn in [
  ("PRODUCTION (br-curly-poetry / ep-rough-bar)",0,"Live prod branch","ERD_prod.html"),
  ("BRANCH proud-lab (ep-raspy-boat)",1,"Current working branch","ERD_branch.html")]:
    p=os.path.join(HERE,fn)
    open(p,"w",encoding="utf-8").write(html(env_name,idx,sub))
    open(p.replace(".html",".mmd"),"w",encoding="utf-8").write(mermaid(idx))
    print("SAVED:",p)
