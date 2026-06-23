# -*- coding: utf-8 -*-
# Comprehensive, value-stream-scoped application catalog + per-division app pools.
# Each app maps ONLY to the divisions it actually serves (no Workday-on-finance misfits).
import json, sys
from collections import defaultdict
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
O = "documents/value-streams/_master_build"

# division display names (must match v007 L2 Division)
UW="Underwriting"; CL="Claims"; AC="Actuarial"; RE="Reinsurance"; FIN="Finance & Investments"
HR="Human Resources & Talent"; LEG="Legal & Corporate Governance"; RCA="Risk, Compliance & Audit"
CYB="Cybersecurity & IAM"; DAI="Data & AI"; TE="Technology & Engineering"; PD="Product & Delivery"
PMO="Program Management Office"; SDM="Sales, Distribution & Marketing"; BO="Business Operations"
CC="Call Center"; CFO="Corporate Functions Operations"
ALL=[UW,CL,AC,RE,FIN,HR,LEG,RCA,CYB,DAI,TE,PD,PMO,SDM,BO,CC,CFO]

# (name, vendor, category, system_of_record, [divisions served])
CAT = [
 # Policy / Underwriting
 ("Guidewire PolicyCenter","Guidewire","Policy Admin",True,[UW,BO,SDM]),
 ("Duck Creek Policy","Duck Creek","Policy Admin",True,[UW,BO]),
 ("Broker & Agent Portal","Internal","Distribution",True,[UW,SDM,RE]),
 ("Earnix Rating & Pricing","Earnix","Rating/Pricing",True,[UW,AC,PD]),
 ("Verisk / ISO ratings","Verisk","Data Service",False,[UW,AC]),
 ("LexisNexis Risk","LexisNexis","Data Service",False,[UW,CL]),
 ("Credit Bureau & Data Services","Multiple","Data Service",False,[UW,CL,SDM]),
 ("Surplus Lines / SLIP Portal","NAIC/State","Reg Filing",True,[UW,RCA]),
 # Claims
 ("Guidewire ClaimCenter","Guidewire","Claims",True,[CL]),
 ("Duck Creek Claims","Duck Creek","Claims",True,[CL]),
 ("FRISS Fraud Detection","FRISS","Fraud/SIU",True,[CL,RCA]),
 ("CCC / Mitchell Estimating","CCC","Claims Estimating",True,[CL]),
 ("Medical Bill Review (Coventry)","Coventry","Claims Medical",True,[CL]),
 ("OpenText Document Mgmt","OpenText","ECM/Docs",True,[CL,UW,BO,LEG]),
 # Billing
 ("Guidewire BillingCenter","Guidewire","Billing",True,[FIN,BO]),
 ("Payment Gateway","Stripe/Fiserv","Payments",True,[FIN,BO,CC]),
 # Policy admin / servicing / customer
 ("Policy Administration Platform","Sapiens/Majesco","Policy Admin",True,[BO,UW]),
 ("Customer Self-Service Portal","Internal","Customer",True,[BO,CC,SDM]),
 ("Salesforce FSC","Salesforce","CRM",True,[SDM,CC,BO]),
 ("Genesys Cloud (Contact Center)","Genesys","Contact Center",True,[CC]),
 ("NICE WFM","NICE","Workforce Mgmt",False,[CC,BO]),
 # Actuarial
 ("SAS Actuarial Platform","SAS","Actuarial",True,[AC]),
 ("FIS Prophet","FIS","Actuarial Modeling",True,[AC]),
 ("Milliman Arius (Reserving)","Milliman","Reserving",True,[AC]),
 ("Moody's RMS (Cat Model)","Moody's","Cat Modeling",True,[AC,RE]),
 ("Catastrophe Data Provider","Verisk/KCC","Cat Data",False,[AC,RE]),
 ("Regulatory Filing Portal (SERFF)","NAIC","Reg Filing",True,[AC,RCA,UW]),
 # Reinsurance
 ("Sapiens ReinsurancePro","Sapiens","Reinsurance",True,[RE]),
 ("Reinsurer Exchange","Internal","Reinsurance",True,[RE]),
 # Finance & Investments  (NO Workday here)
 ("SAP S/4HANA (GL)","SAP","Finance ERP",True,[FIN,CFO]),
 ("Oracle EPM","Oracle","FP&A/Close",True,[FIN]),
 ("BlackLine (Close)","BlackLine","Financial Close",True,[FIN]),
 ("OneStream (FP&A)","OneStream","FP&A",True,[FIN]),
 ("Anaplan (Planning)","Anaplan","Planning",True,[FIN,PMO]),
 ("Bank & Treasury Network","Multiple","Treasury",True,[FIN]),
 ("BlackRock Aladdin","BlackRock","Investments",True,[FIN]),
 ("Bloomberg Terminal","Bloomberg","Market Data",False,[FIN]),
 ("OPTins (Premium Tax)","NAIC","Reg Filing",True,[FIN,RCA]),
 ("Statutory Reporting (NAIC)","NAIC","Reg Reporting",True,[FIN,AC,RCA]),
 # HR & Talent  (Workday lives ONLY here)
 ("Workday HCM","Workday","HCM",True,[HR]),
 ("ADP Payroll","ADP","Payroll",True,[HR]),
 ("Cornerstone LMS","Cornerstone","Learning",True,[HR]),
 ("Greenhouse (Recruiting)","Greenhouse","Recruiting",True,[HR]),
 # Legal & Governance
 ("iManage (Legal Docs)","iManage","Legal DMS",True,[LEG]),
 ("DocuSign","DocuSign","E-Signature",True,[LEG,UW,BO,HR]),
 ("Icertis CLM (Contracts)","Icertis","Contract Mgmt",True,[LEG,CFO]),
 ("Diligent (Board)","Diligent","Governance",True,[LEG]),
 # Risk / Compliance / Audit
 ("Archer GRC","Archer","GRC",True,[RCA,LEG,CYB,CFO]),
 ("AuditBoard","AuditBoard","Audit",True,[RCA]),
 ("NICE Actimize (AML)","NICE","Financial Crime",True,[RCA,FIN]),
 ("RegEd Compliance","RegEd","Compliance",True,[RCA,SDM]),
 ("NIPR (Producer Licensing)","NIPR","Licensing",True,[SDM,RCA]),
 # Cybersecurity & IAM
 ("CrowdStrike Falcon","CrowdStrike","EDR",True,[CYB]),
 ("SailPoint IGA","SailPoint","Identity Gov",True,[CYB]),
 ("Okta / IAM Platform","Okta","IAM",True,[CYB,TE]),
 ("CyberArk (PAM)","CyberArk","PAM",True,[CYB]),
 ("Splunk SIEM","Splunk","SIEM",True,[CYB,TE]),
 ("Qualys / Tenable (Vuln)","Qualys","Vuln Mgmt",True,[CYB]),
 # Data & AI
 ("Snowflake Data Cloud","Snowflake","Data Platform",True,[DAI,FIN,AC]),
 ("Databricks Lakehouse","Databricks","Data/ML",True,[DAI]),
 ("Azure ML / MLflow","Microsoft","ML Platform",True,[DAI]),
 ("Power BI","Microsoft","BI",False,[DAI,FIN,BO,RCA]),
 ("Collibra (Data Catalog)","Collibra","Data Gov",True,[DAI]),
 ("Azure Data Factory","Microsoft","Data Pipeline",True,[DAI,TE]),
 # Technology & Engineering / Service Ops
 ("Azure Cloud Platform","Microsoft","Cloud",True,[TE,DAI]),
 ("GitHub","GitHub","Source Control",True,[TE,PD,DAI]),
 ("Azure DevOps","Microsoft","ALM/CI-CD",True,[TE,PD,DAI]),
 ("Jenkins","CloudBees","CI/CD",False,[TE]),
 ("Terraform Cloud","HashiCorp","IaC",True,[TE]),
 ("ServiceNow ITSM","ServiceNow","ITSM/Change",True,[TE,CFO,BO,PD]),
 ("Datadog","Datadog","Observability",True,[TE,DAI]),
 ("PagerDuty","PagerDuty","Incident",True,[TE]),
 # Product & Delivery / PMO  (the go/no-go fix lives here)
 ("Jira","Atlassian","Agile/Work Mgmt",True,[PD,TE,DAI,PMO]),
 ("Jira Align / Rally","Atlassian/Broadcom","Agile Portfolio",True,[PD,PMO,TE]),
 ("Confluence","Atlassian","Docs/Wiki",True,[PD,TE,PMO,DAI]),
 ("Aha! (Roadmap)","Aha!","Product Mgmt",True,[PD]),
 ("Figma","Figma","Design",False,[PD]),
 ("Clarity PPM / Planview","Broadcom","PPM",True,[PMO,CFO]),
 ("Smartsheet","Smartsheet","Work Mgmt",False,[PMO,BO]),
 # Sales / Distribution / Marketing
 ("Duck Creek Distribution","Duck Creek","Distribution",True,[SDM,UW]),
 ("Marketo (Marketing)","Adobe","Marketing Automation",True,[SDM]),
 # Cross-cutting (where work is memorialized)
 ("Microsoft 365 / SharePoint","Microsoft","Collaboration/Docs",True,ALL),
 ("Microsoft Excel","Microsoft","Spreadsheet",True,ALL),
 ("Microsoft Teams / Email","Microsoft","Comms",False,ALL),
 ("Coupa / SAP Ariba (Procurement)","Coupa","Procurement",True,[CFO,FIN]),
]
catalog=[{"name":n,"vendor":v,"category":c,"sor":s,"divisions":d} for (n,v,c,s,d) in CAT]
json.dump(catalog, open(f"{O}/enriched_catalog.json","w",encoding="utf-8"), ensure_ascii=False)

pool=defaultdict(list)
for a in catalog:
    for d in a["divisions"]:
        pool[d].append({"name":a["name"],"category":a["category"],"sor":a["sor"]})
json.dump(pool, open(f"{O}/app_pool_by_division.json","w",encoding="utf-8"), ensure_ascii=False)

# tasks_by_area from the v7 rebuild output
F=r"C:\Users\xando\AppData\Local\Temp\claude\C--Users-xando-Code-transform-platform\e7779fde-4039-436b-94a9-de90aeff60c5\tasks\wagtt3bgd.output"
res=json.load(open(F,encoding="utf-8"))["result"]
tba={}
for g in res["groups"]:
    tba[g["l3key"]]={"l4groups":[{"l4":x["l4"],"tasks":[{"name":t["name"],"owner":t["owner"],"participants":t.get("participants",[]),"deliverable":t.get("deliverable",""),"checklist":t.get("checklist",[]),"automatability":t.get("automatability",""),"ok":t.get("ok",True),"issues":t.get("issues","")} for t in x.get("tasks",[])]} for x in g.get("l4groups",[])]}
json.dump(tba, open(f"{O}/tasks_by_area.json","w",encoding="utf-8"), ensure_ascii=False)

print("enriched_catalog.json:", len(catalog), "apps")
print("app_pool_by_division.json:", {k:len(v) for k,v in sorted(pool.items())})
print("tasks_by_area.json:", len(tba), "areas")
print("\nProduct & Delivery apps:", [a["name"] for a in pool[PD]])
print("Finance & Investments apps (no Workday):", [a["name"] for a in pool[FIN]])
