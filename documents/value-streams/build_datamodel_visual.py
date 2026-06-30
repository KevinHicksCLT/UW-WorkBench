# Generates a standalone HTML data-model visual: PROD vs BRANCH, FK edges,
# colour-coded by drift severity. Highlights the SEVERED value-stream link tables.
import os
HERE=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(HERE,"DB-DataModel_prod-vs-branch.html")
SVGOUT=os.path.join(HERE,"DB-DataModel_prod-vs-branch.svg")

# entity -> (zone, prod, branch)
E={
 "Company":("ORG",1,1),"Division":("ORG",15,15),"Department":("ORG",99,99),"Role":("ORG",282,299),
 "ValueStreamDomain":("VS",7,7),"ValueStream":("VS",36,132),"SubValueStream":("VS",1390,868),
 "ProcessStep":("VS",1052,8355),"Level":("VS",896,1012),
 "RoleValueStream":("LINK",523,0),"ApplicationValueStream":("LINK",63,0),"StepAppUsage":("LINK",1250,0),
 "StepDeliverable":("LINK",811,0),"IoItem":("LINK",962,0),"Metric":("LINK",267,0),
 "RequirementValueStream":("LINK",477,0),"InitiativeValueStream":("LINK",9,0),
 "Application":("WORK",61,56),"Deliverable":("WORK",568,688),"Task":("WORK",5795,6256),
 "RoleTask":("WORK",5615,5698),"ChecklistItem":("WORK",5604,5604),
 "Node":("GRAPH",2674,9782),"NodeLink":("GRAPH",3308,111),"NodeType":("GRAPH",10,10),
}
ZONES=["ORG","VS","LINK","WORK","GRAPH"]
ZTITLE={"ORG":"Org spine","VS":"Value-stream spine (rebuilt)","LINK":"VS connectivity links (SEVERED)",
        "WORK":"Work & role detail","GRAPH":"Unified graph (rework)"}
ORDER={z:[n for n,(zz,_,_) in E.items() if zz==z] for z in ZONES}

# FK edges: (from, to, severed?)
EDGES=[
 ("Company","Division",0),("Division","Department",0),("Department","Role",0),("Division","Role",0),
 ("Company","ValueStream",0),("ValueStreamDomain","ValueStream",0),
 ("ValueStream","SubValueStream",0),("ValueStream","ProcessStep",0),
 ("Role","RoleValueStream",1),("ValueStream","RoleValueStream",1),
 ("Application","ApplicationValueStream",1),("ValueStream","ApplicationValueStream",1),
 ("ProcessStep","StepAppUsage",1),("Application","StepAppUsage",1),
 ("ProcessStep","StepDeliverable",1),("ValueStream","IoItem",1),("ValueStream","Metric",1),
 ("ValueStream","RequirementValueStream",1),("ValueStream","InitiativeValueStream",1),
 ("Role","ChecklistItem",0),("Role","RoleTask",0),("Deliverable","Task",0),
 ("ValueStream","Deliverable",2),  # nullable / weak FK
 ("Node","NodeLink",0),
]

# layout
BW,BH=216,60; VGAP=20; TOP=170; ZX={z:40+i*272 for i,z in enumerate(ZONES)}
pos={}
for z in ZONES:
    for i,n in enumerate(ORDER[z]):
        pos[n]=(ZX[z], TOP+i*(BH+VGAP))
W=ZX["GRAPH"]+BW+40
H=max(y for _,y in pos.values())+BH+60

def sev(n):
    z,p,b=E[n]
    if z=="LINK" and p>0 and b==0: return "crit"
    if n=="NodeLink" and b<p*0.2: return "crit"
    if z=="VS" or n=="Node": return "major"
    if p!=b: return "minor"
    return "same"
FILL={"crit":"#FDEDEC","major":"#FEF5E7","minor":"#FCF3CF","same":"#EAF2F8"}
STROKE={"crit":"#C0392B","major":"#E67E22","minor":"#B7950B","same":"#5499C7"}

def cx(n): x,y=pos[n]; return x+BW/2
def cy(n): x,y=pos[n]; return y+BH/2

svg=[f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI,Arial,sans-serif" role="img">']
svg.append(f'<title>Data model: production vs branch</title>')
svg.append('<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#999"/></marker>'
           '<marker id="ahr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#C0392B"/></marker></defs>')
svg.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#FFFFFF"/>')
svg.append(f'<text x="40" y="44" font-size="26" font-weight="700" fill="#1F3864">Operating-Model Data — Production vs Branch (proud-lab)</text>')
svg.append(f'<text x="40" y="72" font-size="14" fill="#555">Each box: PROD&#8594;BRANCH row count. Red = value-stream link tables wiped to 0 by the spine rebuild (connectivity severed).</text>')

# zone headers + backing panels
for z in ZONES:
    x=ZX[z]-12; ys=TOP-34; yb=TOP+len(ORDER[z])*(BH+VGAP)-VGAP+12
    svg.append(f'<rect x="{x}" y="{ys-22}" width="{BW+24}" height="{yb-ys+30}" rx="10" fill="#F8F9FB" stroke="#E0E0E0"/>')
    crit = z=="LINK"
    svg.append(f'<text x="{ZX[z]+BW/2}" y="{ys}" font-size="13" font-weight="700" text-anchor="middle" fill="{"#C0392B" if crit else "#1F3864"}">{ZTITLE[z]}</text>')

# edges
def edge(a,b,kind):
    x1,y1=cx(a),cy(a); x2,y2=cx(b),cy(b)
    # anchor to box sides
    ax = pos[a][0]+(BW if x2>=x1 else 0); bx=pos[b][0]+(0 if x2>=x1 else BW)
    ay=cy(a); by=cy(b)
    mx=(ax+bx)/2
    col="#C0392B" if kind==1 else ("#999" if kind==0 else "#9B59B6")
    dash=' stroke-dasharray="6 4"' if kind!=0 else ''
    w=2.2 if kind==1 else 1.3
    mk="url(#ahr)" if kind==1 else "url(#ah)"
    svg.append(f'<path d="M{ax},{ay} C{mx},{ay} {mx},{by} {bx},{by}" fill="none" stroke="{col}" stroke-width="{w}"{dash} marker-end="{mk}" opacity="{0.9 if kind==1 else 0.5}"/>')
for a,b,k in EDGES:
    edge(a,b,k)

# boxes (drawn after edges)
for n,(z,p,b) in E.items():
    x,y=pos[n]; s=sev(n)
    svg.append(f'<rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="8" fill="{FILL[s]}" stroke="{STROKE[s]}" stroke-width="{2.5 if s=="crit" else 1.6}"/>')
    svg.append(f'<text x="{x+12}" y="{y+24}" font-size="14" font-weight="700" fill="#222">{n}</text>')
    delta=b-p; dtxt=("=" if delta==0 else (f"+{delta}" if delta>0 else str(delta)))
    dcol="#C0392B" if (s=="crit") else ("#1E8449" if delta>0 else ("#B03A2E" if delta<0 else "#666"))
    svg.append(f'<text x="{x+12}" y="{y+46}" font-size="13" fill="#444">{p:,} &#8594; <tspan font-weight="700">{b:,}</tspan></text>')
    svg.append(f'<text x="{x+BW-12}" y="{y+46}" font-size="13" font-weight="700" text-anchor="end" fill="{dcol}">{dtxt}</text>')

# legend
ly=H-34
svg.append(f'<text x="40" y="{ly}" font-size="12" fill="#333">Legend:</text>')
leg=[("#C0392B","Severed / wiped to 0"),("#E67E22","Major rebuild"),("#B7950B","Minor change"),("#5499C7","Identical"),("#9B59B6","Nullable FK")]
lx=110
for col,lab in leg:
    svg.append(f'<rect x="{lx}" y="{ly-11}" width="14" height="14" rx="3" fill="{col}"/>')
    svg.append(f'<text x="{lx+20}" y="{ly}" font-size="12" fill="#333">{lab}</text>')
    lx+=len(lab)*7+44
svg.append('</svg>')
SVG="\n".join(svg)
open(SVGOUT,"w",encoding="utf-8").write(SVG)

# diagnosis cards
severed=[(n,E[n][1]) for n in ORDER["LINK"]]
DIAG="".join(f"<li><b>{n}</b>: {p:,} &rarr; 0</li>" for n,p in severed)
html=f"""<!doctype html><html><head><meta charset="utf-8"><title>Data Model — Prod vs Branch</title>
<style>body{{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#fff;color:#222}}
.wrap{{max-width:{W+40}px;margin:0 auto;padding:20px}}
.diag{{background:#FDEDEC;border:1px solid #C0392B;border-radius:10px;padding:16px 20px;margin:18px 0}}
.diag h2{{margin:0 0 8px;color:#C0392B;font-size:18px}} .diag ul{{columns:2;margin:8px 0 0}}
svg{{width:100%;height:auto;border:1px solid #eee;border-radius:10px}}
.note{{font-size:13px;color:#555}}</style></head><body><div class="wrap">
<h1 style="color:#1F3864">Operating-Model Data Model — Production vs Branch (proud-lab)</h1>
<p class="note">Generated from a live row-count + natural-key diff of the two Neon branches. See <code>DB-Diff_prod-vs-branch.xlsx</code> for row-level detail.</p>
{SVG}
<div class="diag"><h2>&#9888; Core finding — value-stream connectivity was severed</h2>
<p>The branch rebuilt the value-stream spine (<b>ProcessStep</b> 1,052&rarr;8,355 with <b>zero</b> shared keys; <b>ValueStream</b> 36&rarr;132). The FK link tables that tied roles, apps, metrics, IO, requirements and step-lens data to value streams were <b>wiped to 0</b> &mdash; the new value streams are disconnected:</p>
<ul>{DIAG}<li><b>NodeLink</b>: 3,308 &rarr; 111</li></ul>
<p class="note" style="margin-top:10px">Path forward: re-wire (or re-seed) these link tables against the new ValueStream/ProcessStep ids before promoting, or the value streams in the app have no connected roles/apps/metrics.</p></div>
</div></body></html>"""
open(OUT,"w",encoding="utf-8").write(html)
print("SAVED:",OUT)
print("SAVED:",SVGOUT)
print("canvas",W,"x",H)
