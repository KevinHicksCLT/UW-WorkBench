# BRANCH target model in PROD's ERD format: mermaid erDiagram, left->right,
# attribute boxes + crow's-foot one-to-many. Connection tables as associative entities.
# Owner/Contributor on RoleDeliverable; Role->Value Stream derived (dashed).
import os
HERE=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(HERE,"ERD_branch.html")

mer = r'''erDiagram
  direction LR
  Company {
    string id PK
    string name
    int rows "1"
  }
  L1_Segment {
    string table "ValueStreamDomain"
    string id PK
    string companyId FK
    string name
  }
  L2_Division {
    string table "ValueStream"
    string id PK
    string segmentId FK
    string name
  }
  L3_Process {
    string table "SubValueStream·L3"
    string id PK
    string divisionId FK
    string name
  }
  L4_SubProcess {
    string table "SubValueStream·L4"
    string id PK
    string processId FK
    string name
  }
  L5_Step {
    string table "ProcessStep = Task"
    string id PK
    string subProcessId FK
    string name
  }
  Division {
    string id PK
    string companyId FK
    string name
  }
  Department {
    string id PK
    string divisionId FK
    string name
  }
  Role {
    string id PK
    string divisionId FK
    string name
  }
  Deliverable {
    string id PK
    string title
  }
  ChecklistItem {
    string id PK
    string roleId FK
    string text
  }
  RoleDeliverable {
    string role "Owner | Contributor"
    string roleId FK
    string deliverableId FK
  }
  Application {
    string id PK
    string name
  }
  Standard {
    string id PK
    string name
  }
  RegulatoryReq {
    string id PK
    string name
  }
  StepDeliverable {
    string status "WIPED — 0 rows"
    string l3Id FK
    string deliverableId FK
  }
  RequirementValueStream {
    string status "WIPED — 0 rows"
    string l3Id FK
    string regId FK
  }
  Standard_L4 {
    string status "NEW — to build"
    string l4Id FK
    string standardId FK
  }
  Checklist_Step {
    string status "NEW — to build"
    string l5Id FK
    string checklistId FK
  }
  StepAppUsage {
    string status "WIPED — 0 rows"
    string l5Id FK
    string appId FK
  }
  Initiative {
    string id PK
    string note "PARKED"
  }
  Metric {
    string id PK
    string note "PARKED / empty"
  }

  Company ||--o{ L1_Segment : "has"
  L1_Segment ||--o{ L2_Division : "has"
  L2_Division ||--o{ L3_Process : "has"
  L3_Process ||--o{ L4_SubProcess : "has"
  L4_SubProcess ||--o{ L5_Step : "has"

  Company ||--o{ Division : "has"
  Division ||--o{ Department : "has"
  Division ||--o{ Role : "staffs"
  Department ||--o{ Role : "has"

  L3_Process ||--o{ StepDeliverable : ""
  Deliverable ||--o{ StepDeliverable : ""
  L3_Process ||--o{ RequirementValueStream : ""
  RegulatoryReq ||--o{ RequirementValueStream : ""
  L4_SubProcess ||--o{ Standard_L4 : ""
  Standard ||--o{ Standard_L4 : ""
  L5_Step ||--o{ Checklist_Step : ""
  ChecklistItem ||--o{ Checklist_Step : ""
  Role ||--o{ ChecklistItem : "performs"
  L5_Step ||--o{ StepAppUsage : ""
  Application ||--o{ StepAppUsage : ""

  Role ||--o{ RoleDeliverable : "owns / contributes"
  Deliverable ||--o{ RoleDeliverable : "has"
  Role }o..o{ L2_Division : "derived (via work)"
'''

html=f"""<!doctype html><html><head><meta charset="utf-8"><title>Branch ERD (target)</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>body{{font-family:Segoe UI,Arial,sans-serif;margin:0;padding:18px;background:#fff;color:#222}}
h1{{color:#1F3864;margin-bottom:4px}} .meta{{font-size:13px;color:#555;margin:6px 0}}
.banner{{background:#FEF9E7;border:1px solid #B7950B;border-radius:8px;padding:10px 14px;font-size:13px;margin:10px 0}}
.mermaid{{font-size:13px}}</style></head><body>
<h1>Operating-Model ERD — branch (proposed target)</h1>
<div class="meta">Same format as the prod ERD: entity boxes with PK/FK attributes, crow's-foot one&rarr;many, left&rarr;right. Connection tables are associative-entity boxes carrying their two FKs.</div>
<div class="banner"><b>Spine:</b> Company &rarr; L1 Segment &rarr; L2 Division &rarr; L3 Process &rarr; L4 Sub-Process &rarr; L5 Step (= Task). <b>Connections:</b> Deliverable&rarr;L3 (StepDeliverable), Reg&rarr;L3 (RequirementValueStream), Standard&rarr;L4 (Standard_L4 new), Checklist&rarr;L5 (Checklist_Step new) + Role, Application&rarr;L5 (StepAppUsage). The <code>status</code> row on each link table flags WIPED (rebuild) vs NEW. <b>Owner/Contributor</b> lives on <code>RoleDeliverable</code> (role&harr;deliverable), NOT on the value stream; <b>Role&rarr;Value Stream is derived</b> (dashed) from the work a role does. Initiative/Metric parked.</div>
<pre class="mermaid">
{mer}
</pre>
<script>mermaid.initialize({{startOnLoad:true, securityLevel:'loose'}});</script>
</body></html>"""
open(OUT,"w",encoding="utf-8").write(html)
open(OUT.replace(".html",".erd.mmd"),"w",encoding="utf-8").write(mer)
print("SAVED:",OUT)
