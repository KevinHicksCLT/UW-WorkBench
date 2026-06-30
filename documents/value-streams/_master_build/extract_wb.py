import openpyxl, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
OUT="documents/value-streams/_master_build"
def norm(s): return "" if s is None else str(s).strip()
def grab(path, sheet, hdr, out, maxr=None):
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws=wb[sheet]
    rows=list(ws.iter_rows(min_row=hdr, values_only=True))
    head=[norm(c) for c in rows[0]]
    data=[]
    for r in rows[1:]:
        if maxr and len(data)>=maxr: break
        d={head[i]:norm(c) for i,c in enumerate(r) if i<len(head) and head[i]}
        if any(d.values()): data.append(d)
    json.dump(data, open(f"{OUT}/{out}","w",encoding="utf-8"), ensure_ascii=False)
    print(f"{out}: {len(data)} rows | cols: {head[:14]}")
    wb.close()
V="documents/value-streams/"
grab(V+"ABC-Insurance-Operating-Model-REFINED-v007.xlsx","L5 Process List",1,"wb_v007.json")
grab(V+"ABC-Insurance-Operating-Model-v7_062226.xlsx","L5 Process List",1,"wb_v7.json")
B="documents/AI Transformation Bridge Input.xlsx"
grab(B,"L4 Process Master",4,"wb_bridge_l4.json")
grab(B,"L5 Process Steps",4,"wb_bridge_l5.json")
grab(B,"Standards Index",5,"wb_standards.json")
grab(B,"External Interactions",4,"wb_ext.json")
