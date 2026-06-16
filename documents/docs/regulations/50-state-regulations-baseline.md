**State-by-State Summary of U.S. Insurance Regulators, Standards &
Notices, and System Integrations**

**Introduction:** Insurance regulation in the U.S. is primarily handled
at the **state level**, with each state (plus the District of Columbia)
maintaining its own insurance regulatory authority. These **state
insurance departments/commissions** enforce **state insurance laws and
regulations**, issue **bulletins and directives** to clarify policy
changes, and oversee insurer compliance.

To help insurers and system integrators navigate this complex landscape
effectively, it is crucial to understand the **official regulator
websites**, the sources of **state statutes, administrative regulations,
and regulatory notices**, and any **electronic systems** that facilitate
integration between insurer systems (such as **policy administration or
claims management** systems) and regulators' platforms.

Additionally, many states leverage **national resources** and **shared
infrastructure** provided by the **National Association of Insurance
Commissioners (NAIC)**:

-   **SERFF (System for Electronic Rate and Form Filing):** A
    widely-used NAIC system that enables digital submission, review, and
    management of **insurance policy form and rate filings**. Nearly
    *all states accept or require SERFF* for most lines of insurance
    (some with **Electronics Filing Portals** or **APIs** that integrate
    with insurer systems). *Direct integration of insurer systems with
    SERFF is possible via NAIC web services interfaces, enabling
    carriers to automate filings and track review status.*
    [\[serff.com\]](https://www.serff.com/),
    [\[serff.com\]](https://www.serff.com/serff_participation_massachusetts.htm)

-   **Uniform Certificate of Authority Application (UCAA):** A
    standardized **company licensing application** process used
    nationwide; states allow or mandate electronic submission of insurer
    licensing and corporate changes via NAIC's UCAA portal.

-   **National Insurance Producer Registry (NIPR):** A NAIC-affiliated
    system for **agent/producer licensing**, renewals, and appointments
    used by all states. This provides **APIs and batch processing** for
    integration with insurer licensing systems in many states.

-   **State Based Systems (SBS):** An NAIC technology platform used by
    *over 30 states* to manage licensing (producers and companies),
    regulatory actions, and consumer services in a unified system.
    **States that use SBS** typically rely on NAIC-run interfaces
    (including **state-specific SBS portals** or **NIPR portals** for
    insurer and agent interactions) rather than building their own
    independent systems. Examples include **Oklahoma** (converted to SBS
    for complaint management in 2023), **South Dakota** (joined SBS in
    2025), and **West Virginia** (went live with SBS in 2025).

-   **Interstate Insurance Product Regulation Commission (IIPRC)**
    (Insurance Compact): A multi-state agreement (currently **46
    jurisdictions** including D.C.) to establish **uniform product
    standards** and **single-point approvals** for certain **life
    insurance, annuities, long-term care, and disability insurance
    products**. **States participating in the Compact** allow insurers
    to file eligible products **one time through the Compact's SERFF
    portal**, which covers all member states (for these lines). Notable
    **non-members** include **California, New York, and Florida**, which
    require separate state filings for those products.
    [\[insurancecompact.org\]](https://www.insurancecompact.org/industry-resources)

-   **Market Conduct and Data Reporting Portals:** The NAIC's **Market
    Conduct Annual Statement (MCAS)** and **Financial data
    repositories** allow insurers to submit **annual financial
    statements** and **market conduct data** to regulators across all
    states in a standardized format, easing multi-state compliance.
    These platforms are integrated with insurers' back-end systems
    through NAIC's secure **iSite+** environment and data-filing tools.
    [\[aldoi.gov\]](https://aldoi.gov/Legal/Regulations.aspx)

-   **Electronic Funds Transfer (EFT)**: Many states accept or require
    **electronic payment of fees** for filings or other obligations via
    NAIC's EFT service integrated into SERFF.
    [\[serff.com\]](https://www.serff.com/serff_participation_alabama.htm)

-   **OPTins (Online Premium Tax for Insurance System):** An NAIC system
    that **facilitates electronic premium tax payments and surplus lines
    tax filings** in many states. Some states have recently *moved to
    alternate platforms for surplus lines*, such as "**SLIP+ for
    States**" (e.g., Alabama and others).
    [\[aldoi.gov\]](https://aldoi.gov/)
    [\[7\]](http://www.aldoi.gov/pdf/legal/Bulletin%202025-06.pdf)

**Policy and Claims System Integrations:** In addition to SERFF, various
state regulators or related agencies provide **electronic submission
mechanisms** for regulatory data that insurers need to integrate with
their internal systems:

-   **Product Filing Portals:** Some states deploy **state-specific
    electronic filing platforms**. For example, **Florida's Insurance
    Regulation Filing System (IRFS)** (formerly known as I-File) is the
    mandatory portal for all product filings in the state. Insurers must
    integrate their internal product development/rate systems to produce
    the required electronic filling components for IRFS. (Florida is
    *one of the few states not using SERFF* for most filings, making
    IRFS integration crucial for carriers doing business there.)
    [\[serff.com\]](https://www.serff.com/serff_participation_florida.htm)

-   **Batch Data Submissions & EDI for Claims:** Many regulators or
    related agencies require **Electronic Data Interchange (EDI)** to
    collect specific insurance data. Notably, **state workers'
    compensation regulators** (often separate commissions) require
    insurers to submit **First Report of Injury (FROI)** and
    **Subsequent Report of Injury (SROI)** **claim data** via IAIABC EDI
    standards (XML or flat-file)\*\* in batch or real-time\*\*. For
    example, **Texas** requires carriers to transmit workers' comp claim
    events using the IAIABC EDI Claims Release 3.1.4 standard, with an
    **EDI portal (Verisk)** for transmissions. **California's Workers'
    Compensation Information System (WCIS)** similarly uses EDI to
    gather comprehensive claim data from insurers' systems. These EDI
    programs involve *signing up as a "trading partner" and formatting
    data in standardized files for SFTP or web portal upload*, enabling
    integration from carriers' **claims administration systems**.

-   **State Insurance Verification Systems:** Many states have
    **compulsory auto insurance verification programs**, often in
    cooperation with motor vehicle departments. Insurers may be required
    to *electronically report active auto policy data* to a state-run or
    vendor-operated database on a recurring basis (via secure FTP or web
    services). **For example:** Georgia's Electronic Insurance
    Compliance System (GEICS) and **TexasSure** in Texas use
    insurer-supplied data to allow law enforcement/DMVs to verify auto
    insurance coverage in real-time, requiring insurers' policy admin
    systems to produce **regular data feeds or respond to state
    inquiries via API** (varies by state). These systems are typically
    separate from the insurance department's main site but mandated by
    state law and overseen by regulatory authorities or state motor
    vehicle departments.

In the sections below, each state's **official insurance regulator
website** is provided along with key sources for **statutes,
regulations, and regulatory bulletins/notices**. Each section also
summarizes **electronic filing or integration mechanisms** used in that
state -- including **SERFF or alternative filing systems, NAIC or
multi-state integrations, and any known state-specific electronic
submission requirements for insurers** (e.g., data calls, claims EDI).
Use the information as a guide to plan **IT system integration** and
ensure compliance with each state's uniquely managed regulatory
processes.

**Alabama**

**Regulator:** **Alabama Department of Insurance (ALDOI)** -- Official
website: [**aldoi.gov**](https://aldoi.gov/).
[\[content.naic.org\]](https://content.naic.org/sites/default/files/publication-ins-ou-insurance-directory.pdf)

**Statutes & Regulations:** *Statutory authority* is primarily in
**Alabama Insurance Code (Title 27, Code of Alabama)**. Detailed
**Administrative Regulations** are available on **ALDOI's "Regulations"
page**. ALDOI also provides an online **Bulletins** archive (with
bulletins numbered by year and subject) for regulatory guidance and
industry directives. For example, **Bulletin 2026-01** (Jan. 2026)
covers **Group Capital Calculation Filing Requirements**, and **Bulletin
2025-04** outlines filing fees and electronic payment requirements via
SERFF. [\[aldoi.gov\]](https://aldoi.gov/Legal/CodeofAlabama.aspx)
[\[aldoi.gov\]](https://aldoi.gov/Legal/Regulations.aspx)
[\[aldoi.gov\]](https://aldoi.gov/Legal/Bulletins.aspx)

**Integration & Electronic Systems:** **Alabama** participates in
**NAIC's SERFF** for rate and form filings (SERFF submissions are
accepted for **all lines** of insurance in Alabama). ALDOI supports
**electronic filing payments via NAIC's EFT** system (electronic fee
transfers are accepted and even mandated for certain filings). The state
also uses NAIC's **OPTins** system for online premium tax payments and
some surplus lines tax submissions -- although recently **ALDOI adopted
a new system, "SLIP+ for States," for surplus lines data and tax
reporting** (effective Jan. 1, 2026), replacing OPTins for those
transactions.
[\[serff.com\]](https://www.serff.com/serff_participation_alabama.htm)
[\[7\]](http://www.aldoi.gov/pdf/legal/Bulletin%202025-06.pdf)

For **claims data integration**, **Alabama's workers' compensation**
claims are overseen by a separate **Alabama Department of Labor**
(Workers' Compensation Division) which requires **electronic reporting**
of work comp injuries via **EDI** (using the national IAIABC EDI
standards for FROI/SROI submissions), necessitating integration with
insurers' claims systems. Beyond these portals and EDI feeds, Alabama's
insurance regulator does not provide public APIs for real-time
integration with insurer *policy admin* systems; insurers primarily
interact through **SERFF (web interface or SERFF web services)** for
product filings and NAIC aggregator systems for financial/market conduct
data.

**Alaska**

**Regulator:** **Alaska Division of Insurance** -- Official website via
**Alaska Department of Commerce, Community & Economic Development
(DCCED)**:
\*\*<https://www.commerce.alaska.gov/web/ins**%5B12>\](<https://www.insurancebusinessmag.com/us/companies/alaska-division-of-insurance/544930/>).

**Statutes & Regulations:** Alaska's **Insurance Statutes** are
contained in **Title 21 of the Alaska Statutes**. The **Alaska
Administrative Code (3 AAC 21 et seq.)** provides detailed regulations
under the Division's authority. The Division's **Resources** include an
online listing of **Bulletins** (e.g., Bulletin B26-03 -- Annual Health
Insurance Survey, 2026), **Regulatory Orders**, and **Notices**. The
official site hosts **Bulletins (current and past)** in the
**"Resources" section** and typically issues **annual regulatory
updates** summarizing new insurance laws or requirements.
[\[insuranceb\...essmag.com\]](https://www.insurancebusinessmag.com/us/companies/alaska-division-of-insurance/544930/)

**Integration & Electronic Systems:** **Alaska accepts SERFF** for
electronic submission of **rate, rule, and form filings** for all major
lines (SERFF is mandated for P&C filings since 2009). The Division does
not currently maintain its own separate rate/form filing portal, so
insurers should plan to integrate with **SERFF** for product filings.
Many insurer **back-office systems** can leverage SERFF's integration
features or web services to automate filings and track status in Alaska.
The state also participates in **NAIC's centralized data reporting**
(financial statements, MCAS, etc.), meaning insurers in Alaska submit
required financial and market data through NAIC's systems (which then
distribute the information to Alaska regulators).

For **claims integration**, workers' compensation claims must be
reported to the **Alaska Workers' Compensation Board** (under Dept. of
Labor), which accepts **electronic first and subsequent injury reports**
in *IAIABC EDI* format (the state moved to the **EDI Claims Release
3.1** standard for FROI/SROI). Other lines of insurance do not have
routine direct claim system integration with the Division, except that
insurers might have to provide data for special **state data calls** or
**market conduct surveys** in specified formats (usually via Excel/CSV
or an online form) as requested.

**Arizona**

**Regulator:** **Arizona Department of Insurance and Financial
Institutions (DIFI)** -- Official website:
[**https://difi.az.gov/insurance**](https://difi.az.gov/insurance) (DIFI
houses both insurance and other financial regulators).

**Statutes & Regulations:** Arizona's **Insurance Code** is in **Title
20 of the Arizona Revised Statutes** (accessible via the Arizona State
Legislature's website). The **Arizona Administrative Code (Title 20,
Chapter 6)** covers insurance regulations (available through Arizona's
official rules site). DIFI's insurance division provides **Regulatory
Bulletins** (e.g., bulletin series with year and number) on its site,
along with **Circular Letters** and **Director's Orders** as needed.

**Integration & Electronic Systems:** **Arizona requires electronic
submissions for insurance product filings** via **SERFF** (which it
accepts for all major lines of business). Insurers must use **SERFF**
for form, rate, and rule filings; this can be done through SERFF's user
interface or through automated system integration (NAIC's SERFF provides
optional **web services** for direct integration with company systems,
enabling carriers to send filings programmatically).
[\[serff.com\]](https://www.serff.com/serff_participation_massachusetts.htm)

Arizona is a **member of the Insurance Compact (IIPRC)** for life and
annuity products, so insurers can file those *once via the Compact's
SERFF portal* to satisfy Arizona's requirements as well. The state uses
NAIC's **UCAA** for company licensing processes (including corporate
amendments) and **NIPR/SBS** for producer licensing and renewals,
enabling carriers and agencies to integrate these licensing transactions
electronically. Arizona's regulator does not maintain a separate
state-specific insurer portal beyond what's provided through NAIC.
[\[insurancecompact.org\]](https://www.insurancecompact.org/industry-resources)

On the **claims side**, Arizona generally does not require direct
system-to-system integration for insurers' claim systems outside of
*special data calls or statistical reporting*. For example, carriers
might need to submit **annual statistical reports or data calls** (e.g.,
for closed claims in medical malpractice or certain P&C lines) through
spreadsheets or secure email, but these are not continuous integrations.
**No specific EDI program for routine claims** is mandated by the
insurance regulator for general P&C lines. However, *Arizona's workers'
compensation claims are reported through EDI to the state's industrial
commission, separate from DIFI's processes.*

**Arkansas**

**Regulator:** **Arkansas Insurance Department (AID)** -- Official
website:
[**https://insurance.arkansas.gov**](https://insurance.arkansas.gov/).

**Statutes & Regulations:** **Arkansas Insurance Code** is codified in
**Title 23, Subtitle 3 of the Arkansas Code** (and relevant sections in
Title 4 and 20 for specific lines). The Insurance Department provides
access to **Rules and Regulations** on its site and archives
**Directives/Bulletins** (often titled "Bulletin" with a number and
year) that communicate regulatory guidance or changes.

**Integration & Electronic Systems:** **Arkansas accepts SERFF for
electronic filings** of rates, rules, and forms across all major lines,
aligning with NAIC's system for speed-to-market. Filings submitted via
SERFF meet Arkansas's requirements, and **SERFF submissions** are
integrated into the state's internal review pipeline (insurers can
optionally use SERFF's integration services to feed data from their
policy admin or product management systems into SERFF to automate filing
preparation).
[\[serff.com\]](https://www.serff.com/serff_participation_massachusetts.htm)

Arkansas participates in **NAIC's centralized systems** for financial
and producer licensing: it uses **OPTins** for premium tax payments and
**NIPR** for electronic producer licensing. For **workers'
compensation**, Arkansas requires insurers/administrators to report
claims data via EDI in compliance with IAIABC standards -- meaning
insurers' claims systems must output standardized data (often
transmitted via a secure vendor portal or SFTP) for FROI/SROI to the
**Arkansas Workers' Compensation Commission**. No additional
state-specific APIs for real-time policy/claims integration are
currently offered beyond these standardized channels; insurers typically
interface with AID through **SERFF** for product/filing needs and
through NAIC-provided platforms or EDI for other regulatory data.

**California**

**Regulator:** **California Department of Insurance (CDI)** -- Official
website:
[**http://www.insurance.ca.gov**](http://www.insurance.ca.gov/).

**Statutes & Regulations:** California's extensive **Insurance Code**
forms the statutory framework (available on the California Legislative
Information website, e.g., *California Insurance Code, Sections
1-20000*). **Regulations** are in **Title 10, Chapter 5 of the
California Code of Regulations**. **CDI's website** provides direct
access to **Laws & Regulations** and a robust archive of **Notices and
Bulletins**. For example, CDI issues **Notices** to insurers (e.g., on
new mandated benefits or changes in Proposition 103 procedures) and
posts **Legal rulings and decisions** affecting insurers.

**Integration & Electronic Systems:** **California accepts SERFF
electronic filings** for many lines of insurance (Life,
Disability/Health, and **P&C rate filings** are accessible through
**SERFF Filing Access (SFA)**). However, California also maintains
unique systems:

-   **"CDI Filing Search"** (Virtual *Viewing Room*): For certain public
    filings, notably **Proposition 103 personal auto and home insurance
    rate filings**, CDI directs users to its own **Rate Filing Search
    portal**. Insurers still **submit these filings via SERFF** but
    CDI's public portal allows for browsing the content of those filings
    easily.

-   **California Workers' Compensation Information System (WCIS):**
    Operated by the Dept. of Industrial Relations (separate from CDI),
    **WCIS uses EDI to collect detailed workers' comp claims data** from
    insurers' claims systems. Insurers (or their TPAs) must integrate
    with **IAIABC EDI standards** (currently Release 3.1) to
    automatically report FROI/SROI events into WCIS's database.

-   **Other Data Calls and Portals:** CDI sometimes uses specialized
    electronic portals for data collection, such as **the California
    FAIR Plan's systems** or the **Earthquake Authority's reporting**,
    but these are not directly integrated into insurer policy systems
    and typically involve periodic data submissions (often through
    CSV/XML or designated portals).

**National Integrations:** California is *not a member of the Interstate
Insurance Product Regulation Compact* (it requires separate filings for
life/annuity forms), but the state leverages **NAIC's systems** for
other purposes. Insurers licensed in California file **financial
statements and RBC reports** through the NAIC's system (which California
then accesses), and they use **NIPR** for producer licensing tasks.
**SERFF's statewide adoption** has allowed California to also use
**SERFF Plan Management** for health plan filings under the ACA (QHP
filings). Insurers should treat California's SERFF usage as essential
and note that some *public records, especially sensitive rating data
under Prop 103, might require FOIA requests if not in the public
viewer*.
[\[insurancecurator.com\]](https://insurancecurator.com/state-insurance-department-directory-links-to-filing-requirements-forms-and-consumer-alerts/)
[\[dfs.ny.gov\]](https://www.dfs.ny.gov/apps_and_licensing/health_insurers)

**Colorado**

**Regulator:** **Colorado Division of Insurance** (part of the Dept. of
Regulatory Agencies, DORA) -- Official website:
[**https://doi.colorado.gov**](https://doi.colorado.gov/).

**Statutes & Regulations:** The **Colorado Insurance Code** is found in
**Title 10 of the Colorado Revised Statutes**. **Insurance regulations**
are located in **3 CCR (Code of Colorado Regulations) 702-** (with
various parts for different lines). The Division's site provides a
collection of **Regulations**, **Bulletins** (commonly labeled with
series numbers *B-1.x*, etc.), and **Insurance Bulletins** that clarify
regulatory positions or changes.

**Integration & Electronic Systems:** **Colorado accepts SERFF for all
lines** of insurance product filings (the Division encourages companies
to utilize **SERFF** for rate & form submissions to the maximum extent).
Carriers can use SERFF's web interface or integrate through automated
feeds (SERFF's web services API) to streamline filings. **Colorado**
also requires **electronic filings for some financial and corporate
transactions** (e.g., company licensing) through NAIC's **UCAA portal**
and requires insurers' direct participation in **NAIC data collection
(financial statements, market conduct data)**, meaning insurers should
have internal processes to produce those data outputs as required.
[\[serff.com\]](https://www.serff.com/serff_participation_massachusetts.htm)

Colorado is a long-time adopter of **SERFF's add-ons** like **electronic
funds transfer** to pay filing fees online (reducing paper checks in
favor of integrated digital payments). The state uses **OPTins** for
premium tax filings, and **SBS** (State Based Systems) as its regulatory
platform (Colorado was an early SBS adopter), integrating licensing,
enforcement actions, and more on the NAIC's platform. **SBS
integration** means that tasks like **producer license processing** and
**company appointments** rely on NIPR's online systems and data flows,
which carriers can integrate with to handle agent licensing updates
electronically.

**For claims data integration**, **Colorado's Division of Workers'
Compensation** (separate from DOI) **mandates EDI submission** of work
comp claims (the **CO DOWC EDI portal** follows IAIABC standards Release
3.1 for FROI/SROI). Other regulatory claim or policy data (e.g.,
connectivity for auto insurance verification) are handled by separate
agencies or third-party systems -- for instance, **Colorado's Vehicle
Insurance Reporting** is facilitated by a DMV database to which insurers
submit data via *batch processes*, but this is outside the DOI's direct
scope. Overall, insurers engage electronically with Colorado's DOI
primarily via SERFF and NAIC-supported systems, supplemented by mandated
EDI or data file submissions to other state entities (like DOWC or DMV)
where required by law.

**Connecticut**

**Regulator:** **Connecticut Insurance Department (CID)** -- Official
website: [**https://portal.ct.gov/cid**](https://portal.ct.gov/cid).

**Statutes & Regulations:** Connecticut's **Insurance Statutes** are in
**Title 38a of the Connecticut General Statutes**. **Insurance
regulations** (administrative code provisions) fall under **Title 38a**
and are accessible via the Secretary of State's regulation portal. CID's
website provides direct links to **Laws** and **Regulations**, as well
as an archive of **Bulletins** (often denoted "Bulletin IC-**number**"
or similar) and **Notices** to industry (which can include guidance on
compliance, e.g., data call instructions).

**Integration & Electronic Systems:** **Connecticut requires electronic
filing** of insurance product forms and rates via **SERFF** for most
lines of business, enhancing speed-to-market processes. The **NAIC SERFF
portal** should be integrated into insurers' product lifecycle or
regulatory compliance management systems for ease of submitting and
tracking filings. In addition to SERFF, **Connecticut participates in
the Interstate Insurance Product Regulation Compact** (for life and
annuity products), meaning if an insurer opts to file through the
**IIPRC**, a single SERFF submission can cover Connecticut along with
other member states (Connecticut as a member of the Compact will accept
the **Compact's approval** of those products, in lieu of a separate
state filing). The state also uses **NAIC's UCAA** for company licensing
and **NIPR** for producer licensing tasks, so insurers interact with
these national systems when adding new lines or updating corporate
status.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

**Connecticut** has also established **electronic claim data reporting**
requirements in some areas. For example, **Medicare Supplement
insurance** and other health carriers have to report **claims experience
data** electronically via templates on the department's website.
**Workers' compensation** is overseen by the **CT Workers' Compensation
Commission**, which requires electronic submission of certain claims
data (though CT historically has had its own approach not fully
integrated with IAIABC EDI, many carriers utilize vendor solutions or
EDI if mandated). For **auto insurance verification**, **Connecticut**
requires carriers to participate in its **Uninsured Motorist
Identification Database** -- insurers must regularly provide policy data
to a state contractor (often via **SFTP batch files** of policy
records). These specific integration points mean that insurers' **policy
administration systems** should be configured to export the required
data on schedule in the correct format (with minimal manual
intervention). No general public-facing RESTful APIs are offered by CID
for on-demand policy/claim queries; integration is mostly achieved
through formal submission systems.

**Delaware**

**Regulator:** **Delaware Department of Insurance** -- Official website:
[**https://insurance.delaware.gov**](https://insurance.delaware.gov/).

**Statutes & Regulations:** Delaware's **Insurance Code** is contained
in **Title 18 of the Delaware Code**. The Department's site links to
**Delaware Regulations** (various chapters of the Administrative Code
for insurance) and publishes **Domestic and Foreign Insurers Bulletins**
and **Consumer Alerts**. Delaware often issues **Domestic/Foreign
Insurer Bulletins** to communicate with industry; for instance,
bulletins about data security requirements or pandemic accommodations
have been posted in recent years.

**Integration & Electronic Systems:** **Delaware mandates the use of
SERFF for insurance rate and form filings** for all lines (it emphasizes
speed and consistency by using NAIC's platform). **SERFF** (with NAIC
integration and EFT for payments) is the primary interface for insurers'
product filing systems. Delaware does not use a separate, state-specific
product filing portal, instead leveraging NAIC's infrastructure
entirely, making it simpler for multi-state insurers to integrate
compliance processes. Delaware is also a member of the **Insurance
Compact (IIPRC)**, accepting life and annuity filings through the
Compact's SERFF channel.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

In terms of claims and policy data integration, there are no widely
unique state-run insurer integration portals in Delaware beyond NAIC's
standard data calls. Delaware has **adopted NAIC's MCAS** for annual
market conduct/claims data (insurers submit their claims and policy
performance metrics to NAIC's MCAS portal for Delaware). **Workers'
compensation first-report and subsequent-injury reporting** is mandatory
but done via **EDI** to the Delaware Office of Workers\' Compensation --
insurers writing WC should integrate or subscribe to an IAIABC-compliant
EDI feed for Delaware FROI/SROI. The Delaware DOI itself does not
operate real-time API services for insurer systems; interactions are
through the established networks (SERFF, data call submissions, etc.)
and any **industry stakeholders integration** is often facilitated
through **NAIC** or **third-party** systems.

**District of Columbia**

**Regulator:** **District of Columbia Department of Insurance,
Securities and Banking (DISB)** -- Official website:
[**https://disb.dc.gov**](https://disb.dc.gov/).

**Statutes & Regulations:** The **D.C. Official Code Title 31** contains
the District's insurance laws. **D.C. Municipal Regulations (DCMR)**
Title 26 covers insurance regulatory rules. **DISB** publishes
**Bulletins and Commissioner\'s Orders** for the insurance industry on
its site, which include guidance on compliance, e.g., bulletins on new
legislation or industry advisories.

**Integration & Electronic Systems:** The District of Columbia uses
NAIC's **SERFF** for electronic submission of insurance product filings
(all major lines use SERFF; mandatory use for most property-casualty and
life/health filings). DISB, being a smaller jurisdiction, relies heavily
on **national systems** rather than developing bespoke IT solutions:
**SERFF for product filings**, **NIPR for licensing**, **NAIC's
financial filing system** (with which insurers' financial reporting must
integrate for RBC and statutory statements). The District is part of the
**Interstate Insurance Product Regulation Compact**, so eligible
life/annuity products can be filed via the Compact for DC.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

**Integration**: **DC** does not run separate API-based integration for
insurers' core systems beyond the above. However, it does **participate
in national data calls and EDI** -- for example, **WC claims in DC** are
to be reported by insurers in compliance with **IAIABC EDI standards**
to the D.C. Department of Employment Services. Additionally, **auto
insurers** must comply with **D.C.'s electronic insurance verification**
with the DMV by submitting policy data (the District uses a program in
line with the national Motor Vehicle Insurance Verification system,
typically integrated with carriers either via insurers' providing
monthly FTP files or participating in real-time verification services).

**Florida**

**Regulator:** **Florida Office of Insurance Regulation (OIR)** --
Official website: [**floir.gov**](https://www.floir.gov/). *(Note:
Florida's regulatory structure is unique; the OIR handles insurer
oversight, while the separate **Department of Financial Services (DFS)**
handles consumer services and agent licensing. For product and rate
regulation, OIR is the primary authority.*)
[\[floir.gov\]](https://www.floir.gov/)

**Statutes & Regulations:** **Florida Insurance Code** is collected in
**Title XXXVII, Chapters 624-651 of the Florida Statutes**, and rules
are in the **Florida Administrative Code (Chapter 69O)**. **OIR's
website** provides a **"Laws & Rules"** section with links to these
statutes and administrative rules, and also an **Industry Portal** with
**notices of rulemaking** and **informational memoranda** to insurers.
Florida issues **Informational Memoranda (OIR-** series) and **Industry
Alerts**, instead of traditional "bulletins," to communicate regulatory
expectations and statutory changes.

**Integration & Electronic Systems:** **Florida is an outlier** in that
it operates its own end-to-end **electronic filing system, not SERFF,
for all insurance product filings.** Insurers must use the **Insurance
Regulation Filing System (IRFS)** via Florida's **Industry Portal**.
This portal (also formerly known as "I-File") is a **single point of
entry** for:

-   **Filing Assembly and Submission**: Insurers upload or build
    form/rate filings through IRFS (with **web interfaces; no publicly
    documented API** presently, meaning integration is typically via
    manual upload or possible custom-coded scripts if allowed).

-   **Rate Collection**: Certain rate and other data (like P&C closed
    claims or experience reporting for specific coverages) are collected
    via **online forms or batch uploads** in the portal.

-   **Financial Filings**: Florida's **REFS (Regulatory Electronic
    Filing System)** is used to submit financial documents and other
    required reports, accessed through the same industry portal.
    [\[floir.gov\]](https://www.floir.gov/tools-and-data/required-filing-and-reporting)

Florida's early **differentiation** from SERFF, however, has blurred
somewhat: For instance, Florida participates in NAIC's **SERFF Plan
Management** for **ACA health plan filings** and has **integrations with
federal systems** for health insurance oversight. But for P&C and most
life/health product filings, insurers must integrate their compliance
workflow to output Florida-specific filing components for IRFS. **The
NAIC's SERFF** is not the main pipeline for Florida filings (though some
insurers may use third-party services that take their SERFF filings and
convert them to Florida's format). *Important for systems integration:*
ensure Florida-specific product filings are prepared for IRFS and not
simply sent to SERFF.

Beyond product filings, **Florida requires numerous electronic data
reporting**:

-   **Catastrophe Claims Data Calls:** After major hurricanes or
    catastrophes, OIR often activates a **catastrophe claims portal**
    for insurers to report claims counts, losses, etc., typically via a
    secure spreadsheet or portal upload. The **"Catastrophe Claims Data
    & Reporting"** system on the OIR site reflects this, with insurers
    mandated to **electronically submit data on claims and losses**
    within set timeframes.

-   **Florida's PIP (Personal Injury Protection) and other auto claims
    reporting**: Under **Florida laws**, insurers must submit certain
    **auto insurance claim and policy data** (e.g., PIP claims
    experiences) electronically to OIR on a quarterly or annual basis
    (via specified templates).

-   **NAIC Integrations:** Florida collects financial statements through
    NAIC's systems (so insurer finance departments integrate with NAIC's
    data submission process for Florida's compliance). Producer
    licensing goes through **NIPR** as Florida is not an SBS state
    (Florida's DFS uses its own license system but accepts NIPR for
    applications).

-   **Workers' Compensation** in Florida is regulated by the **Division
    of Workers' Compensation (FL Dept. of Financial Services)**, which
    mandates insurers to file injury reports electronically via **IAIABC
    EDI (via a vendor)** -- carriers integrate claims systems for
    **FROI/SROI** transmissions.

-   **Auto Insurance Verification:** Florida currently operates an
    **Electronic Insurance Verification** program requiring insurers to
    maintain a web service for real-time verification of personal auto
    policies (per Florida's Motor Vehicle Insurance law) and to
    regularly upload policy data to the state's system.

In summary, insurers and integrators should treat Florida as a special
case: most states rely on NAIC-run integration like SERFF, but
**Florida's OIR demands integration with its proprietary IRFS/Industry
Portal** for filings, plus separate data feeds for various required
reports and claims data.
[\[serff.com\]](https://www.serff.com/serff_participation_florida.htm)

**Georgia**

**Regulator:** **Georgia Office of the Commissioner of Insurance and
Safety Fire (OCI)** -- Official website:
[**https://oci.georgia.gov**](https://oci.georgia.gov/).

**Statutes & Regulations:** Georgia's **Insurance Laws** are in **Title
33 of the Official Code of Georgia Annotated (O.C.G.A.)**. Detailed
**Insurance Regulations** are found in **Ga. Comp. Rules & Regulations
(Chapter 120-2)**. The **OCI website** provides **"Insurance
Resources"** with links to **Laws & Regulations**, as well as
**Bulletins** and **Directives** (e.g., guidance on coverage issues,
regulatory expectations, etc.). Georgia often issues **Directive
letters** and regulatory **Bulletins**, which are accessible on the
official site.

**Integration & Electronic Systems:** Georgia requires insurers to use
**SERFF for product filings** (rates, forms, and rules) in both
**Property & Casualty and Life & Health** lines. SERFF is integrated
with OCI's internal systems for reviewing submissions, and insurers can
leverage SERFF's web interfaces or connect their systems via SERFF's web
services. Georgia's O.C.I. site also offers **SERFF Public Access** (the
state opted to open public searching of filings on **SERFF Filing
Access** for major lines from Jan. 15, 2019 onward), enabling
transparency for filed rates/forms. Georgia is a member of the
**Interstate Insurance Compact**, allowing life/annuity filings through
the single Compact SERFF submission.

OCI uses NAIC's **OPTins for premium tax** filings (for admitted
carriers) and **NIPR** for electronic producer licensing. For **surplus
lines**, Georgia employs a **state-specific Surplus Line portal** (in
partnership with the **Georgia Surplus Line Association**) where brokers
and insurers report and pay surplus lines premium taxes electronically.

**Claims & Policy Data Integration:** **Georgia mandates participation
in an electronic insurance verification system** (to ensure compliance
with auto liability insurance requirements). Insurers must report
private passenger auto policy status to the **Georgia Electronic
Insurance Compliance System (GEICS)**. GEICS is integrated with insurer
systems via *secure web services* or file uploads: for example, insurers
provide updated policy information **electronically (typically via daily
or real-time web service data exchanges)** to a state-managed database
accessible by law enforcement and the DMV. Insurers' policy
administration systems must be configured for these data feeds.

For **workers' compensation**, Georgia's **State Board of Workers'
Compensation** adopted **IAIABC EDI for claims** (Release 3.0/3.1) and
provides an **EDI implementation guide** for insurers to follow.
Insurers must integrate their claim systems to output FROI/SROI data and
register as trading partners with the Board's EDI vendor. Aside from
these, Georgia uses **NAIC data calls** (such as for market conduct or
special inquiries) which often allow data to be submitted via email or
web forms.

AI-Friendly Compliance Artifacts for Georgia
--------------------------------------------

The section below converts the Georgia material into two reusable
artifacts: an executive-friendly markdown profile and a strict
machine-readable YAML rules file. This is the pattern I recommend
replicating for every state so an AI agent can both explain the
regulatory posture and enforce decision rules consistently. Because
regulatory details change, treat this as an operational compliance aid
that should be reviewed by regulatory counsel before production use.

**GA\_compliance\_profile.md**

\# State Compliance Profile: Georgia\
\
\#\# Metadata\
- state\_code: GA\
- state\_name: Georgia\
- regulator\_name: Georgia Office of the Commissioner of Insurance and
Safety Fire\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, licensing, regulatory directives\
- primary\_filing\_platforms:\
- SERFF\
- NAIC systems for licensing and reporting\
- important\_adjacent\_systems:\
- GEICS (Georgia Electronic Insurance Compliance System)\
- Georgia State Board of Workers' Compensation EDI program\
- compact\_status: IIPRC member for eligible life and annuity products\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Georgia follows the mainstream national pattern for insurance product
regulation in that insurers generally use SERFF for rate, rule, and form
filings, while relying on NAIC-linked systems for several adjacent
compliance processes. What makes Georgia more operationally important
for AI-enabled controls is that it also requires direct insurer
participation in state-specific electronic reporting environments,
particularly for private passenger auto insurance verification and
workers' compensation claims reporting. That means an AI compliance
layer for Georgia cannot stop at product filing logic; it must also
monitor evidence from policy-administration and claims systems.\
\
For executive decision-making, Georgia should be treated as a state with
three control zones. The first is filing discipline, where products and
changes must flow through approved channels with documented evidence of
submission and status. The second is operational reporting discipline,
where policy and claim events create ongoing obligations outside the
product filing cycle. The third is exception discipline, where
bulletins, directives, or state-specific implementation guidance can
override generic multi-state operating assumptions.\
\
\#\# Regulatory Principles\
1. Required insurance product filings must go through approved
regulatory channels before implementation where state law requires
filing or approval.\
2. Regulatory activity must be auditable, with evidence of submission,
acknowledgment, status, and effective date preserved in a retrievable
form.\
3. Private passenger auto insurance operations must support the state's
electronic insurance verification requirements through timely and
accurate policy data reporting.\
4. Workers' compensation claim events must be reported through the
required electronic reporting framework when Georgia mandates
submission.\
5. State bulletins, directives, and implementation guidance must be
treated as enforceable operating constraints when they are newer or more
specific than general enterprise policy.\
6. Ambiguity, exceptions, and non-standard products must be escalated to
regulatory compliance or legal review before launch or implementation.\
\
\#\# What This Means Operationally\
For AI systems, Georgia is not just a repository of legal text; it is a
state where AI should continuously test whether the organization has
chosen the right filing channel, gathered proof of filing activity,
connected policy systems to state-required verification feeds, and
connected claim systems to workers' compensation EDI obligations where
applicable. In practice, that means Georgia rules should be wired into
launch gates, filing-readiness workflows, policy-administration
monitoring, and claims-reporting controls.\
\
\#\# Core Operating Rules\
- Use SERFF for standard Georgia rate, rule, and form filings unless a
more specific Georgia instruction or specialized process applies.\
- Do not treat product implementation as complete if filing evidence is
missing, rejected, withdrawn, or otherwise not in the status required by
the underlying filing obligation.\
- For private passenger auto business, maintain the ability to provide
accurate policy status information to Georgia's electronic verification
program.\
- For workers' compensation, maintain compliant EDI reporting capability
and evidence of transmission and acknowledgment for reportable events.\
- Preserve references to Georgia bulletins, directives, filing
objections, and implementation notes so AI can distinguish standard
rules from state-specific exceptions.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- georgia\_auto\_verification\_feed\_status\
- auto\_policy\_status\_extract\_timestamp\
- wc\_trading\_partner\_status\
- wc\_edi\_acknowledgment\
- bulletin\_reference\
- exception\_flag\
- legal\_review\_flag\
\
\#\# Typical AI Actions\
- Block launch when a required Georgia filing lacks acceptable
evidence.\
- Route work to regulatory filing when the state is Georgia and the
filing package is incomplete or misrouted.\
- Flag likely operational noncompliance when auto verification evidence
is absent or stale.\
- Escalate workers' compensation reporting failures when required EDI
evidence is missing.\
- Require human review when a Georgia bulletin or directive creates
uncertainty that the system cannot resolve confidently.\
\
\#\# Common Georgia Exception Areas\
- Product-specific filing nuances may differ by line, filing type, and
whether the filing is prior approval, file-and-use, informational, or
exempt.\
- Surplus lines and producer-related processes may involve separate
entities, portals, or workflow evidence outside standard product filing
logic.\
- Workers' compensation oversight is operationally adjacent but governed
through a separate reporting structure from ordinary product filing.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutory language, regulations, and newer
directives\
- Any implementation where required evidence cannot be retrieved
automatically\
\
\#\# Recommended AI Posture\
Use Georgia as a model state for a broader pattern: combine legal
principles, explicit operational rules, required evidence, and
escalation actions in one state artifact. This enables AI to reason, not
just retrieve.

**GA\_compliance\_rules.yaml**

state\_code: GA\
state\_name: Georgia\
jurisdiction\_type: state\
regulator:\
  name: Georgia Office of the Commissioner of Insurance and Safety Fire\
  category: insurance\_regulator\
last\_reviewed: 2026-06-08\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
principles:\
  - id: GA-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: GA-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: GA-P-003\
    text: Maintain compliant electronic reporting for private passenger
auto insurance verification obligations.\
  - id: GA-P-004\
    text: Maintain compliant electronic reporting for workers
compensation claim events when required.\
  - id: GA-P-005\
    text: Escalate ambiguity, exceptions, and state-specific directives
for human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: auto\_verification\_feed\_status\
    type: enum\
    values: \[active, inactive, error, unknown\]\
  - name: auto\_policy\_extract\_timestamp\
    type: datetime\
  - name: wc\_trading\_partner\_status\
    type: enum\
    values: \[registered, pending, inactive, unknown\]\
  - name: wc\_edi\_acknowledgment\
    type: string\
  - name: bulletin\_reference\
    type: string\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
\
rules:\
  - id: GA-FILING-001\
    category: filing\
    description: Standard Georgia product filings should use SERFF
unless a more specific state instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: GA\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: SERFF\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: GA-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
Georgia filing evidence is missing or filing status is not acceptable
for the obligation type.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: GA\
        - field: filing\_receipt\_id\
          operator: is\_missing\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
escalate\_compliance\]\
\
  - id: GA-AUTO-001\
    category: auto\_verification\
    description: Private passenger auto operations must support Georgia
electronic insurance verification obligations.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: GA\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
    then:\
      require:\
        evidence\_fields: \[auto\_verification\_feed\_status,
auto\_policy\_extract\_timestamp\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: GA-AUTO-002\
    category: auto\_verification\_health\
    description: Auto verification feeds should be active and current.\
    if:\
      any:\
        - field: auto\_verification\_feed\_status\
          operator: in\
          value: \[inactive, error, unknown\]\
        - field: auto\_policy\_extract\_timestamp\
          operator: is\_missing\
    then:\
      actions\_if\_true: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, notify\_business\_owner\]\
\
  - id: GA-WC-001\
    category: workers\_compensation\_reporting\
    description: Georgia workers compensation claim events requiring EDI
must have trading partner readiness and acknowledgment evidence.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: GA\
        - field: line\_of\_business\
          operator: equals\
          value: workers\_compensation\
    then:\
      require:\
        evidence\_fields: \[wc\_trading\_partner\_status,
wc\_edi\_acknowledgment\]\
      actions\_if\_missing: \[escalate\_claims\_compliance,
open\_remediation\_ticket, require\_manual\_review\]\
\
  - id: GA-BULLETIN-001\
    category: bulletin\_exception\_management\
    description: State-specific bulletins, directives, or implementation
guidance override generic operating assumptions when newer or more
specific.\
    if:\
      any:\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close\]\
\
  - id: GA-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard product
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - conflicting\_state\_guidance\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_auto\_verification\_failure\
  - unresolved\_workers\_comp\_edi\_failure

Cross-State Taxonomy Table
--------------------------

This table gives an AI-friendly cross-state taxonomy for the most
operationally important dimensions that commonly vary by jurisdiction:
filing channel, compact participation, auto-verification obligations,
workers' compensation reporting model, APCD reporting, and SBS usage. It
is designed as a pragmatic control layer rather than a legal opinion.
Use it to drive state-specific branching logic, evidence collection, and
exception routing in your compliance architecture.

  **State / DC**   **Filing portal**    **Compact**   **Auto verification**                 **Workers' comp**                      **APCD**   **SBS**
  ---------------- -------------------- ------------- ------------------------------------- -------------------------------------- ---------- --------------------
  AL               SERFF                Member        No                                    EDI                                    No         No
  AK               SERFF                Member        No                                    EDI                                    No         No
  AZ               SERFF                Member        No                                    EDI                                    No         No
  AR               SERFF                Member        No                                    EDI                                    No         No
  CA               SERFF                Non-member    No                                    EDI                                    No         No
  CO               SERFF                Member        Yes                                   EDI                                    Yes        Yes
  CT               SERFF                Member        Yes                                   Mixed / non-EDI emphasis               Yes        Yes
  DE               SERFF                Member        No                                    EDI                                    No         No
  DC               SERFF                Member        Yes                                   EDI                                    No         No
  FL               Proprietary (IRFS)   Non-member    Yes                                   EDI                                    No         No
  GA               SERFF                Member        Yes                                   EDI                                    No         No
  HI               SERFF                Member        No                                    Non-EDI                                Yes        No
  ID               SERFF                Member        Yes                                   EDI                                    No         No
  IL               SERFF                Member        No                                    Mixed / evolving                       No         No
  IN               SERFF                Member        No                                    EDI                                    No         Yes
  IA               SERFF                Member        Yes                                   EDI                                    No         Yes
  KS               SERFF                Member        No                                    EDI                                    No         Yes
  KY               SERFF                Member        Emerging / partial                    EDI                                    No         No
  LA               SERFF                Member        No                                    Mixed / evolving                       No         No
  ME               SERFF                Member        No                                    EDI                                    Yes        Yes
  MD               SERFF                Member        Yes                                   Mixed / partial EDI                    Yes        Yes
  MA               SERFF                Member        Limited / query-based                 Non-EDI / limited pilot                Yes        No
  MI               SERFF                Member        Yes                                   Non-EDI / portal-based                 No         Yes
  MN               SERFF                Member        Random verification, not continuous   EDI                                    Yes        Yes
  MS               SERFF                Member        No                                    Non-EDI                                No         Yes
  MO               SERFF                Member        No                                    EDI                                    No         No
  MT               SERFF                Member        No                                    Non-EDI                                No         No
  NE               SERFF                Member        Yes                                   Mixed / evolving                       No         Yes
  NV               SERFF                Member        Yes                                   Mixed / evolving                       No         No
  NH               SERFF                Member        No                                    Non-EDI / limited electronic           No         No
  NJ               SERFF                Member        No                                    Non-EDI / specialized electronic       Yes        No
  NM               SERFF                Member        No                                    EDI                                    Yes        Yes
  NY               SERFF                Non-member    No                                    EDI                                    No         No
  NC               SERFF                Member        Yes                                   EDI                                    No         Yes
  ND               SERFF                Member        Yes                                   Monopolistic fund                      No         Yes
  OH               SERFF                Member        No                                    Monopolistic fund                      Emerging   No
  OK               SERFF                Member        Yes                                   EDI                                    No         Yes
  OR               SERFF                Member        No                                    State-specific / non-IAIABC standard   Yes        Transitioning
  PA               SERFF                Member        No                                    EDI                                    No         No
  RI               SERFF                Member        No                                    Mixed / optional EDI                   No         Yes
  SC               SERFF                Member        Yes                                   EDI                                    No         Yes
  SD               SERFF                Member        No                                    EDI / approved alternative             No         Yes
  TN               SERFF                Member        Yes                                   EDI                                    No         No
  TX               SERFF                Non-member    Yes                                   EDI                                    No         Partial / evolving
  UT               SERFF                Member        Yes                                   EDI                                    Yes        No
  VT               SERFF                Member        No                                    EDI                                    Yes        Yes
  VA               SERFF                Member        Yes                                   EDI                                    Yes        No
  WA               SERFF                Member        Emerging                              Monopolistic fund                      Yes        No
  WV               SERFF                Member        Yes                                   Non-EDI / mixed                        No         Transitioning
  WI               SERFF                Member        No                                    EDI                                    No         No
  WY               SERFF                Member        Yes                                   Monopolistic fund                      No         No

**Legend:** **Filing portal** distinguishes mainstream SERFF states from
proprietary exceptions such as Florida. **Compact** refers to Interstate
Insurance Product Regulation Compact participation for eligible life and
annuity products. **Auto verification** indicates whether the state
generally requires ongoing electronic insurer participation in a motor
vehicle insurance verification program. **Workers' comp** distinguishes
states with IAIABC-style EDI, mixed or non-EDI approaches, and
monopolistic fund states where private carrier filing obligations differ
materially. **APCD** reflects whether the state has a material all-payer
claims database reporting regime relevant to health insurers. **SBS**
reflects current or transitioning use of NAIC State Based Systems for
licensing and related regulatory workflows.

**Implementation note:** In your AI rule set, treat these columns as
routing and control flags rather than final legal determinations. For
example, **Filing portal** drives submission-channel logic, **Compact**
drives whether eligible life and annuity products can follow a compact
path, **Auto verification** and **Workers' comp** drive operational feed
and acknowledgment monitoring, **APCD** drives health-claims extraction
requirements, and **SBS** helps determine licensing and regulatory
workflow integration patterns. Where the table says **mixed**,
**partial**, **emerging**, or **transitioning**, the AI should require
state-specific review before making an automated decision.

**How to use this pattern for all states:** Replicate these two
artifacts for each jurisdiction using the same structure: a
human-readable compliance profile for executive and business users, and
a machine-readable YAML rules file for AI orchestration. The main
state-by-state variables to change are filing platform exceptions,
compact membership, auto-verification obligations, workers' compensation
reporting method, premium tax or surplus lines mechanisms, APCD
requirements, and bulletin-driven exceptions.

Master Templates for All States
-------------------------------

These master templates provide the standard structure I recommend using
for every state. The idea is simple: keep one human-readable profile for
executives, legal, compliance, and business users, and pair it with one
machine-readable YAML artifact for AI orchestration. This lets your AI
reason consistently across jurisdictions while still preserving
state-level nuance such as filing portal exceptions, compact membership,
workers' compensation reporting method, auto-verification obligations,
APCD requirements, and bulletin-driven exceptions.

**STATE\_compliance\_profile.md**

\# State Compliance Profile: {{STATE\_NAME}}\
\
\#\# Metadata\
- state\_code: {{STATE\_CODE}}\
- state\_name: {{STATE\_NAME}}\
- regulator\_name: {{REGULATOR\_NAME}}\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, licensing, regulatory directives\
- primary\_filing\_platforms:\
- {{PRIMARY\_FILING\_PLATFORM}}\
- {{SECONDARY\_PLATFORM\_OR\_NA}}\
- important\_adjacent\_systems:\
- {{AUTO\_VERIFICATION\_SYSTEM\_OR\_NA}}\
- {{WORKERS\_COMP\_SYSTEM\_OR\_NA}}\
- {{SURPLUS\_LINES\_OR\_PREMIUM\_TAX\_SYSTEM\_OR\_NA}}\
- compact\_status: {{COMPACT\_STATUS}}\
- sbs\_status: {{SBS\_STATUS}}\
- apcd\_status: {{APCD\_STATUS}}\
- last\_reviewed: {{DATE}}\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
{{STATE\_NAME}} should be treated as a state with a distinct regulatory
operating pattern. At a minimum, AI should understand the state's
required filing path, the evidence needed to prove filing or reporting
compliance, and the operational reporting obligations that arise outside
the filing cycle. Where the state uses a proprietary filing portal,
auto-verification system, workers' compensation EDI program, all-payer
claims database, or state-specific bulletin process, those features
should be modeled explicitly instead of assumed from national defaults.\
\
For executive decision-making, the state should be translated into a
practical control model: filing discipline, operational reporting
discipline, and exception discipline. Filing discipline governs whether
the organization used the correct submission channel and preserved audit
evidence. Operational reporting discipline governs recurring feeds,
acknowledgments, and data quality obligations. Exception discipline
governs how the organization treats bulletins, directives,
state-specific carve-outs, and ambiguity requiring legal or compliance
review.\
\
\#\# Regulatory Principles\
1. Required insurance product filings must go through the approved
channel before implementation where state law requires filing or
approval.\
2. Regulatory activity must be auditable, with evidence of submission,
status, acknowledgment, and effective date retained in retrievable
form.\
3. Recurring operational reporting obligations, such as auto
verification, workers' compensation reporting, APCD feeds, or
catastrophe data calls, must be monitored continuously rather than
treated as one-time legal requirements.\
4. State bulletins, directives, circular letters, and implementation
guidance must override generic enterprise assumptions when they are
newer or more specific.\
5. Ambiguity, unusual products, state exceptions, and evidence gaps must
be escalated to compliance or legal review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: {{FILING\_PATH\_EXPLANATION}}\
- Compact treatment: {{COMPACT\_EXPLANATION}}\
- Auto verification: {{AUTO\_EXPLANATION}}\
- Workers' compensation: {{WC\_EXPLANATION}}\
- APCD or health data reporting: {{APCD\_EXPLANATION}}\
- Licensing and regulatory workflow pattern: {{LICENSING\_EXPLANATION}}\
- Bulletin / directive posture: {{BULLETIN\_EXPLANATION}}\
\
\#\# Core Operating Rules\
- {{RULE\_1}}\
- {{RULE\_2}}\
- {{RULE\_3}}\
- {{RULE\_4}}\
- {{RULE\_5}}\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- exception\_flag\
- legal\_review\_flag\
- {{STATE\_SPECIFIC\_SIGNAL\_1}}\
- {{STATE\_SPECIFIC\_SIGNAL\_2}}\
- {{STATE\_SPECIFIC\_SIGNAL\_3}}\
\
\#\# Typical AI Actions\
- Block launch when required filing or reporting evidence is missing.\
- Route work to the correct filing or reporting queue when the selected
channel is inconsistent with state requirements.\
- Flag likely operational noncompliance when required state reporting
feeds are absent, stale, or in error status.\
- Escalate to compliance or legal review when bulletin-driven
exceptions, ambiguity, or state carve-outs are detected.\
- Require named ownership for remediation of unresolved filing or
reporting failures.\
\
\#\# Common Exception Areas\
- Filing treatment may vary by line, product structure, filing type, or
whether the obligation is prior approval, file-and-use, informational,
exempt, or managed through a specialized program.\
- State-specific portals, data calls, and agency adjacencies may sit
outside the ordinary insurance department filing path.\
- Bulletin language may alter implementation expectations faster than
statutes or regulations alone suggest.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, regulations, and newer state guidance\
- Missing evidence for required filing or operational reporting\
- State-specific exceptions that cannot be resolved confidently by rule
logic\
\
\#\# Recommended AI Posture\
Use {{STATE\_NAME}} as one node in a broader multi-state control
architecture. Combine legal principles, explicit rules, required
evidence, and escalation actions in a way that allows AI to reason
across jurisdictions without flattening critical state differences.

**STATE\_compliance\_rules.yaml**

state\_code: {{STATE\_CODE}}\
state\_name: {{STATE\_NAME}}\
jurisdiction\_type: state\
regulator:\
  name: {{REGULATOR\_NAME}}\
  category: insurance\_regulator\
last\_reviewed: {{DATE}}\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primary\_filing\_platform: {{PRIMARY\_FILING\_PLATFORM}}\
  secondary\_platform: {{SECONDARY\_PLATFORM\_OR\_NA}}\
  compact\_status: {{COMPACT\_STATUS}}\
  sbs\_status: {{SBS\_STATUS}}\
  apcd\_status: {{APCD\_STATUS}}\
\
principles:\
  - id: {{STATE\_CODE}}-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: {{STATE\_CODE}}-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: {{STATE\_CODE}}-P-003\
    text: Monitor recurring state operational reporting obligations
continuously.\
  - id: {{STATE\_CODE}}-P-004\
    text: Treat state bulletins, directives, and implementation guidance
as enforceable operating constraints when newer or more specific.\
  - id: {{STATE\_CODE}}-P-005\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: bulletin\_reference\
    type: string\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
  - name: state\_specific\_signal\_1\
    type: {{STATE\_SPECIFIC\_TYPE\_1}}\
  - name: state\_specific\_signal\_2\
    type: {{STATE\_SPECIFIC\_TYPE\_2}}\
  - name: state\_specific\_signal\_3\
    type: {{STATE\_SPECIFIC\_TYPE\_3}}\
\
rules:\
  - id: {{STATE\_CODE}}-FILING-001\
    category: filing\_channel\
    description: Standard {{STATE\_NAME}} product filings should use the
required filing channel unless a more specific state instruction
applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: {{STATE\_CODE}}\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: {{PRIMARY\_FILING\_PLATFORM}}\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: {{STATE\_CODE}}-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
filing evidence is missing or not in the acceptable state-defined
status.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: {{STATE\_CODE}}\
        - field: filing\_receipt\_id\
          operator: is\_missing\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
escalate\_compliance\]\
\
  - id: {{STATE\_CODE}}-OPS-001\
    category: operational\_reporting\
    description: State-specific recurring reporting obligations must
have current evidence of successful operation.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: {{STATE\_CODE}}\
    then:\
      require:\
        evidence\_fields: \[state\_specific\_signal\_1,
state\_specific\_signal\_2\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, notify\_business\_owner\]\
\
  - id: {{STATE\_CODE}}-BULLETIN-001\
    category: bulletin\_exception\_management\
    description: State-specific bulletins, circular letters, directives,
or implementation guidance override generic operating assumptions when
newer or more specific.\
    if:\
      any:\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close\]\
\
  - id: {{STATE\_CODE}}-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard product
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - conflicting\_state\_guidance\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_state\_reporting\_failure

Priority State Variations to Implement Next
-------------------------------------------

**Florida:** Treat Florida as the most important filing-channel
exception because standard product filing logic should route to **IRFS**
rather than SERFF for most product submissions, while also preserving
logic for separate financial and catastrophe-reporting workflows.
Florida should also be marked as a **non-member of the Insurance
Compact** and as a state with meaningful **auto verification** and
**workers' compensation EDI** obligations.

**Texas:** Treat Texas as a high-intensity operational state. Product
filing generally routes through **SERFF**, but AI must also continuously
monitor **TexasSure** auto-verification evidence and **workers'
compensation EDI** readiness. Texas is a current **Insurance Compact
member**, so eligible life and annuity products can follow a compact
path when applicable.

**New York:** Treat New York as a regulatory-intensity state with a
strong bulletin and circular-letter posture. Product filing logic can
route through **SERFF**, but AI should force stronger legal-review
controls around circular letters, cybersecurity filings, and
line-specific product interpretation. New York is a **non-member of the
Insurance Compact**.

**California:** Treat California as a state with mainstream SERFF usage
but exceptional line-specific scrutiny, especially around public
rate-review processes and specialized programs. California is a
**non-member of the Insurance Compact**, so eligible life and annuity
products require direct state treatment rather than compact logic.

**North Carolina:** Treat North Carolina as a strong example of the
standard national pattern: **SERFF**-based filing, current **Insurance
Compact membership**, active **SBS** participation, and meaningful
**auto-verification** plus **workers' compensation EDI** obligations.
This makes it a strong baseline state for reusable multi-state AI
controls.

**Recommended build sequence:** Start with Florida, Texas, New York,
California, and North Carolina. Together, these five states give you the
most useful first-pass coverage of the major control patterns:
proprietary filing portal, compact divergence, strong bulletin
intensity, large-state scrutiny, SBS usage, auto-verification, and
workers' compensation EDI. Once those are completed, the remaining
states can be generated much faster by reusing the templates and the
cross-state taxonomy already in this document.

Florida and Texas State Artifacts
---------------------------------

**FL\_compliance\_profile.md**

\# State Compliance Profile: Florida\
\
\#\# Metadata\
- state\_code: FL\
- state\_name: Florida\
- regulator\_name: Florida Office of Insurance Regulation\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, rate review, regulatory reporting, directives\
- primary\_filing\_platforms:\
- IRFS (Insurance Regulation Filing System)\
- REFS for certain financial and related reporting\
- important\_adjacent\_systems:\
- Florida electronic insurance verification program\
- Florida workers' compensation EDI program\
- catastrophe claims reporting workflows and portal-based data calls\
- compact\_status: non-member of the Insurance Compact\
- sbs\_status: not an SBS state\
- apcd\_status: no broad APCD obligation reflected in this operating
pattern\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Florida should be treated as one of the most important exception states
in a multi-state AI compliance architecture because it diverges from the
national default filing pattern. Instead of routing most insurance
product filings through SERFF, Florida generally requires insurers to
use its own proprietary filing environment, IRFS, through the state's
industry portal. That single fact changes the control model materially
because AI cannot assume that mainstream filing logic applies. Florida
also carries meaningful recurring operational obligations beyond the
filing cycle, including auto insurance verification, workers'
compensation electronic claim reporting, catastrophe-related reporting,
and selected claims or experience data submissions. For executive
decision-making, Florida should therefore be governed through three
connected control layers: filing-path discipline, operational reporting
discipline, and exception-response discipline.\
\
In practice, Florida is the state that proves whether an AI compliance
architecture can truly handle state-specific divergence rather than
merely automate a SERFF-centric workflow. The AI should explicitly test
for Florida filing-channel selection, preserve filing and acknowledgment
evidence, monitor the health of ongoing operational feeds, and escalate
any product, claims, or catastrophe-reporting ambiguity for human
review. Florida is also a non-member of the Insurance Compact, so AI
should not route eligible life and annuity filings through a compact
path for this state.\
\
\#\# Regulatory Principles\
1. Required Florida product filings must use the state-approved filing
channel rather than default national assumptions.\
2. Regulatory activity must be auditable with evidence of submission,
status, acceptance, and effective date preserved in retrievable form.\
3. Recurring Florida operational reporting obligations, including auto
insurance verification, workers' compensation claim reporting, and
catastrophe-driven reporting, must be monitored continuously.\
4. Florida informational memoranda, rule changes, and portal
instructions must override enterprise defaults when they are newer or
more specific.\
5. Ambiguity, unusual products, or missing operational evidence must be
escalated to compliance or legal review before implementation or
launch.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard Florida rate, rule, and form filings should
route to IRFS, not SERFF, unless a specialized Florida instruction or
federal/ACA health-plan workflow specifically says otherwise.\
- Compact treatment: Florida is not a member of the Insurance Compact,
so eligible life and annuity products still require Florida-specific
treatment rather than compact routing.\
- Auto verification: Florida requires electronic participation in motor
vehicle insurance verification, so policy-administration systems must
produce reliable evidence of policy status reporting or query response
capability.\
- Workers' compensation: Florida workers' compensation reporting is
operationally adjacent and requires EDI-based reporting through the
state's workers' compensation framework.\
- APCD or health data reporting: Florida is not treated here as a broad
APCD state, but it does require periodic data submissions and experience
reporting in selected areas.\
- Licensing and regulatory workflow pattern: Florida uses NIPR for
producer-related connectivity but is not an SBS-led operating model.\
- Bulletin / directive posture: Florida frequently uses informational
memoranda, industry notices, and portal-based instructions that should
be treated as implementation-critical guidance.\
\
\#\# Core Operating Rules\
- Use IRFS for standard Florida product filings unless a more specific
Florida instruction governs the submission path.\
- Do not treat a Florida filing as complete if filing evidence, status,
or required attachments are missing or inconsistent with the filing
obligation.\
- For personal auto business, maintain reliable evidence that the
insurer's verification obligations are being met through current data
feeds or query-response capability.\
- For workers' compensation, maintain compliant EDI reporting capability
with evidence of submission and acknowledgment for reportable events.\
- Treat catastrophe data calls, claims reporting directives, and Florida
memoranda as state-specific control triggers that can override general
operating assumptions.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- exception\_flag\
- legal\_review\_flag\
- florida\_auto\_verification\_status\
- florida\_wc\_edi\_acknowledgment\
- catastrophe\_data\_call\_status\
\
\#\# Typical AI Actions\
- Block launch when a required Florida filing has not been routed
through the correct state channel or lacks acceptable evidence.\
- Route work to Florida filing operations when a user or process
attempts to use a default SERFF path for ordinary Florida product
submissions.\
- Flag likely operational noncompliance when Florida auto verification
or workers' compensation reporting evidence is missing, stale, or in
error status.\
- Escalate catastrophe reporting gaps or late data-call response risk
when reporting triggers are active.\
- Require human review when Florida memoranda, filing objections, or
implementation instructions create ambiguity that the system cannot
resolve confidently.\
\
\#\# Common Exception Areas\
- Some health-plan and federal program workflows may differ from the
standard Florida IRFS pattern.\
- Certain claims, experience, catastrophe, and financial reporting
obligations run through related but distinct Florida systems or
processes.\
- Filing treatment can vary by line, filing type, and whether the
obligation is prior approval, informational, emergency, or otherwise
specialized.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, rules, memoranda, and portal instructions\
- Missing evidence for required filing or operational reporting\
- Catastrophe-triggered reporting scenarios with compressed timeframes\
\
\#\# Recommended AI Posture\
Use Florida as the lead exception state in the multi-state model. If the
AI can reliably detect Florida's filing-channel divergence, preserve
state-specific evidence, and monitor ongoing operational reporting
duties, the architecture will be much more resilient across the rest of
the country.

**FL\_compliance\_rules.yaml**

state\_code: FL\
state\_name: Florida\
jurisdiction\_type: state\
regulator:\
  name: Florida Office of Insurance Regulation\
  category: insurance\_regulator\
last\_reviewed: 2026-06-08\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primary\_filing\_platform: IRFS\
  secondary\_platform: REFS\
  compact\_status: non\_member\
  sbs\_status: no\
  apcd\_status: no\
\
principles:\
  - id: FL-P-001\
    text: Use Florida-approved regulatory channels for required product
submissions.\
  - id: FL-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: FL-P-003\
    text: Monitor recurring Florida operational reporting obligations
continuously.\
  - id: FL-P-004\
    text: Treat Florida memoranda, directives, and implementation
guidance as enforceable operating constraints when newer or more
specific.\
  - id: FL-P-005\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: bulletin\_reference\
    type: string\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
  - name: florida\_auto\_verification\_status\
    type: enum\
    values: \[active, inactive, error, unknown\]\
  - name: florida\_wc\_edi\_acknowledgment\
    type: string\
  - name: catastrophe\_data\_call\_status\
    type: enum\
    values: \[not\_triggered, pending, submitted, late, error,
unknown\]\
\
rules:\
  - id: FL-FILING-001\
    category: filing\_channel\
    description: Standard Florida product filings should use IRFS unless
a more specific Florida instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: FL\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: IRFS\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: FL-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
Florida filing evidence is missing or inconsistent with the filing
obligation.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: FL\
        - field: filing\_receipt\_id\
          operator: is\_missing\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
escalate\_compliance\]\
\
  - id: FL-AUTO-001\
    category: auto\_verification\
    description: Florida personal auto operations must maintain evidence
of compliant insurance verification capability.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: FL\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
    then:\
      require:\
        evidence\_fields: \[florida\_auto\_verification\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: FL-WC-001\
    category: workers\_compensation\_reporting\
    description: Florida workers compensation reportable claim events
must have acknowledgment evidence when EDI reporting applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: FL\
        - field: line\_of\_business\
          operator: equals\
          value: workers\_compensation\
    then:\
      require:\
        evidence\_fields: \[florida\_wc\_edi\_acknowledgment\]\
      actions\_if\_missing: \[escalate\_claims\_compliance,
open\_remediation\_ticket, require\_manual\_review\]\
\
  - id: FL-CAT-001\
    category: catastrophe\_reporting\
    description: Active Florida catastrophe data calls require timely
reporting evidence and named ownership.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: FL\
        - field: catastrophe\_data\_call\_status\
          operator: in\
          value: \[pending, late, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: FL-BULLETIN-001\
    category: bulletin\_exception\_management\
    description: Florida memoranda, portal guidance, and state-specific
instructions override generic operating assumptions when newer or more
specific.\
    if:\
      any:\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close\]\
\
  - id: FL-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard product
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - conflicting\_state\_guidance\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_auto\_verification\_failure\
  - unresolved\_workers\_comp\_edi\_failure\
  - active\_catastrophe\_reporting\_gap

**TX\_compliance\_profile.md**

\# State Compliance Profile: Texas\
\
\#\# Metadata\
- state\_code: TX\
- state\_name: Texas\
- regulator\_name: Texas Department of Insurance\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, rate and form
oversight, market oversight, data calls, regulatory directives\
- primary\_filing\_platforms:\
- SERFF\
- Texas-specific reporting and data-call portals where applicable\
- important\_adjacent\_systems:\
- TexasSure auto insurance verification\
- Texas workers' compensation EDI program\
- TDI data-call reporting processes\
- compact\_status: non-member of the Insurance Compact\
- sbs\_status: partial / evolving usage\
- apcd\_status: no broad APCD obligation reflected in this operating
pattern\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Texas should be treated as one of the most operationally demanding
states in the country for AI-enabled compliance. The state uses the
mainstream SERFF filing path for most product submissions, but that does
not make Texas simple. What makes Texas strategically important is the
combination of standard filing logic with high-intensity recurring
operational reporting. In particular, Texas requires strong control over
auto insurance verification through TexasSure, workers' compensation
claim reporting through a mature EDI environment, and frequent
state-directed data-call responsiveness across multiple lines. Texas
therefore forces an AI compliance architecture to go beyond filing
workflow automation and actively monitor evidence produced by policy,
claims, and reporting systems.\
\
For executive decision-making, Texas should be governed through three
layers: filing discipline, operational evidence discipline, and
reporting-intensity discipline. Filing discipline ensures the right
filing channel and proof of submission. Operational evidence discipline
ensures that TexasSure and workers' compensation reporting remain
healthy and current. Reporting-intensity discipline ensures that the
organization can quickly detect, route, and respond to Texas data calls
or reporting requests without relying on ad hoc manual coordination.
Texas is also not a member of the Insurance Compact, so compact routing
should not be assumed for eligible life and annuity products.\
\
\#\# Regulatory Principles\
1. Required Texas product filings must use the approved filing channel
with complete and auditable evidence of submission and status.\
2. Operational reporting obligations, especially TexasSure and workers'
compensation EDI, must be continuously monitored rather than treated as
point-in-time legal requirements.\
3. Regulatory data calls and reporting requests must be triaged,
assigned, and completed with named ownership and evidence of
submission.\
4. Texas bulletins, orders, implementation guides, and reporting
instructions override generic enterprise assumptions when newer or more
specific.\
5. Ambiguity, missing evidence, or line-specific exceptions must be
escalated to compliance or legal review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard Texas rate, rule, and form filings should route
through SERFF unless a specialized Texas process or filing instruction
says otherwise.\
- Compact treatment: Texas is not a member of the Insurance Compact, so
compact-path assumptions should not be used for Texas product approval
logic.\
- Auto verification: Personal auto business must maintain a reliable
TexasSure compliance capability through scheduled data submission or
state-approved query-response methods.\
- Workers' compensation: Texas workers' compensation is one of the
stronger EDI operating environments and requires reliable claim-event
reporting readiness and acknowledgment evidence.\
- APCD or health data reporting: Texas is not modeled here as a broad
APCD state, but carriers should still expect line-specific claims,
experience, and market data reporting obligations.\
- Licensing and regulatory workflow pattern: Texas uses NIPR and has
partial or evolving SBS usage, but the overall pattern remains
state-directed rather than fully standardized on SBS.\
- Bulletin / directive posture: Texas frequently uses bulletins, orders,
guidance pages, and structured data-call instructions that should be
modeled explicitly in AI workflows.\
\
\#\# Core Operating Rules\
- Use SERFF for standard Texas rate, rule, and form filings unless a
more specific Texas filing path applies.\
- Do not treat Texas filing work as complete when filing evidence is
missing or filing status is not acceptable for the obligation type.\
- For personal auto business, maintain current and testable evidence
that TexasSure reporting obligations are being met.\
- For workers' compensation, maintain compliant EDI claim-event
reporting capability with acknowledgment and trading-partner readiness
evidence.\
- Treat Texas data calls as formal operating obligations requiring
routing, named ownership, due-date control, and proof of submission.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- exception\_flag\
- legal\_review\_flag\
- texassure\_feed\_status\
- texas\_wc\_edi\_acknowledgment\
- tdi\_data\_call\_status\
\
\#\# Typical AI Actions\
- Block launch when a required Texas filing lacks acceptable evidence or
is routed incorrectly.\
- Flag likely operational noncompliance when TexasSure or workers'
compensation reporting evidence is absent, stale, or in error status.\
- Open remediation workflows when data-call obligations are active and
ownership, due dates, or evidence of submission are missing.\
- Route filing, claims, and reporting issues to the correct specialized
teams rather than treating Texas as a generic compliance state.\
- Require human review when Texas guidance, filing objections, or
reporting instructions create ambiguity that the AI cannot resolve
confidently.\
\
\#\# Common Exception Areas\
- Certain corporate, surplus lines, specialty, or line-specific
reporting obligations may sit outside ordinary product filing
workflows.\
- Data-call expectations can change quickly in response to market,
catastrophe, or legislative developments.\
- Filing treatment may vary by line, filing type, and whether the
submission is prior approval, informational, exempt, or otherwise
specialized.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, rules, bulletins, and reporting
instructions\
- Missing evidence for required filing or operational reporting\
- Unresolved TexasSure or workers' compensation reporting failures\
\
\#\# Recommended AI Posture\
Use Texas as the leading state for operational evidence control. If the
AI can monitor filing evidence, TexasSure health, workers' compensation
EDI, and state-directed data calls in one integrated model, it will be
far better prepared to manage the most demanding multi-state operating
environments.

**TX\_compliance\_rules.yaml**

state\_code: TX\
state\_name: Texas\
jurisdiction\_type: state\
regulator:\
  name: Texas Department of Insurance\
  category: insurance\_regulator\
last\_reviewed: 2026-06-08\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primary\_filing\_platform: SERFF\
  secondary\_platform: Texas reporting and data-call workflows\
  compact\_status: non\_member\
  sbs\_status: partial\_evolving\
  apcd\_status: no\
\
principles:\
  - id: TX-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: TX-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: TX-P-003\
    text: Monitor recurring Texas operational reporting obligations
continuously.\
  - id: TX-P-004\
    text: Treat Texas bulletins, orders, and reporting instructions as
enforceable operating constraints when newer or more specific.\
  - id: TX-P-005\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: bulletin\_reference\
    type: string\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
  - name: texassure\_feed\_status\
    type: enum\
    values: \[active, inactive, error, unknown\]\
  - name: texas\_wc\_edi\_acknowledgment\
    type: string\
  - name: tdi\_data\_call\_status\
    type: enum\
    values: \[not\_triggered, pending, submitted, late, error,
unknown\]\
\
rules:\
  - id: TX-FILING-001\
    category: filing\_channel\
    description: Standard Texas product filings should use SERFF unless
a more specific Texas instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: TX\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: SERFF\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: TX-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
Texas filing evidence is missing or not in the acceptable state-defined
status.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: TX\
        - field: filing\_receipt\_id\
          operator: is\_missing\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
escalate\_compliance\]\
\
  - id: TX-AUTO-001\
    category: auto\_verification\
    description: Texas personal auto operations must maintain evidence
of compliant TexasSure reporting capability.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: TX\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
    then:\
      require:\
        evidence\_fields: \[texassure\_feed\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: TX-WC-001\
    category: workers\_compensation\_reporting\
    description: Texas workers compensation reportable claim events must
have acknowledgment evidence when EDI reporting applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: TX\
        - field: line\_of\_business\
          operator: equals\
          value: workers\_compensation\
    then:\
      require:\
        evidence\_fields: \[texas\_wc\_edi\_acknowledgment\]\
      actions\_if\_missing: \[escalate\_claims\_compliance,
open\_remediation\_ticket, require\_manual\_review\]\
\
  - id: TX-DATACALL-001\
    category: data\_call\_reporting\
    description: Active Texas data calls require timely reporting
evidence, named ownership, and escalation when status is late or
uncertain.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: TX\
        - field: tdi\_data\_call\_status\
          operator: in\
          value: \[pending, late, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: TX-BULLETIN-001\
    category: bulletin\_exception\_management\
    description: Texas bulletins, orders, and implementation guidance
override generic operating assumptions when newer or more specific.\
    if:\
      any:\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close\]\
\
  - id: TX-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard product
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - conflicting\_state\_guidance\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_texassure\_failure\
  - unresolved\_workers\_comp\_edi\_failure\
  - active\_data\_call\_reporting\_gap

**NY\_compliance\_profile.md**

\# State Compliance Profile: New York\
\
\#\# Metadata\
- state\_code: NY\
- state\_name: New York\
- regulator\_name: New York Department of Financial Services\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, rate and form review, cybersecurity compliance, regulatory
reporting, circular-letter guidance\
- primary\_filing\_platforms:\
- SERFF\
- DFS secure portals for cybersecurity and selected regulatory reporting
obligations\
- important\_adjacent\_systems:\
- DFS cybersecurity filing portal under 23 NYCRR 500\
- New York Workers' Compensation Board eClaims / EDI environment\
- state-specific supplemental reporting and data-call workflows\
- compact\_status: non-member of the Insurance Compact\
- sbs\_status: not an SBS state\
- apcd\_status: no broad APCD obligation reflected in this operating
pattern\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
New York should be treated as one of the highest-regulatory-intensity
states in a multi-state AI compliance architecture. Although New York
now uses SERFF as the standard filing channel for rate and form
submissions, the state is still operationally distinctive because it
combines standard filing mechanics with a strong guidance and
interpretation posture. New York relies heavily on circular letters,
department guidance, and formal regulatory expectations that often shape
implementation behavior beyond the plain text of statutes and
regulations. That means AI cannot treat New York as just another SERFF
state. It must also assess whether circular letters, cybersecurity
obligations, and line-specific regulatory expectations create additional
constraints, evidence requirements, or mandatory legal review triggers.\
\
For executive decision-making, New York should be governed through four
connected control layers: filing discipline, interpretation discipline,
cybersecurity discipline, and claims-reporting discipline. Filing
discipline ensures that the correct filing channel is used with
auditable evidence of submission and status. Interpretation discipline
ensures that circular letters, department guidance, and objection
language are treated as active operating constraints. Cybersecurity
discipline ensures that required attestations, notices, and
incident-related filings are not separated from the broader compliance
model. Claims-reporting discipline ensures that workers' compensation
EDI obligations are monitored continuously. New York is also a
non-member of the Insurance Compact, so eligible life and annuity
products require direct New York treatment rather than compact routing.\
\
\#\# Regulatory Principles\
1. Required New York product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. New York circular letters, regulations, guidance memoranda, and
department instructions must be treated as binding operating constraints
when newer, more specific, or explicitly directive.\
3. Cybersecurity-related certifications, notices, and evidence required
by the Department must be governed as core compliance obligations rather
than peripheral IT tasks.\
4. Workers' compensation reporting obligations must be monitored
continuously through the state's required electronic claims reporting
framework.\
5. Ambiguity, line-specific interpretation questions, or unresolved
objection language must be escalated to compliance or legal review
before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard New York rate, rule, and form filings should
route through SERFF unless a specialized New York process or department
instruction specifically directs another path.\
- Compact treatment: New York is not a member of the Insurance Compact,
so eligible life and annuity products require direct filing and review
through New York channels rather than compact logic.\
- Auto verification: New York is not modeled here as a continuous
insurer-operated motor vehicle insurance verification state in the same
way as Texas, Georgia, or Florida.\
- Workers' compensation: New York workers' compensation reporting is
highly material and requires compliant electronic claims reporting
through the Workers' Compensation Board's EDI environment.\
- APCD or health data reporting: New York is not treated here as a broad
APCD state, but it does impose line-specific reporting, supplemental
schedules, and targeted data-call obligations.\
- Licensing and regulatory workflow pattern: New York uses NIPR
connectivity for producer-related processes but is not an SBS-led
operating model; several obligations remain state-portal or
DFS-specific.\
- Bulletin / directive posture: Circular letters, cybersecurity
guidance, filing instructions, and objection language are especially
important in New York and should be treated as first-class decision
inputs for AI.\
\
\#\# Core Operating Rules\
- Use SERFF for standard New York rate, rule, and form filings unless a
more specific New York instruction governs the submission path.\
- Do not treat a New York filing as implementation-ready when filing
evidence is missing, department objections are unresolved, or required
supporting material is incomplete.\
- Treat circular letters, formal guidance, and objection language as
operationally controlling until resolved or superseded.\
- Maintain evidence that required DFS cybersecurity certifications,
notices, and related governance actions have been completed where
applicable.\
- For workers' compensation, maintain compliant EDI reporting capability
with evidence of transmission, acknowledgment, and issue remediation for
reportable events.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- circular\_letter\_reference\
- objection\_status\
- exception\_flag\
- legal\_review\_flag\
- ny\_cybersecurity\_filing\_status\
- ny\_wc\_edi\_acknowledgment\
\
\#\# Typical AI Actions\
- Block launch when a required New York filing lacks acceptable
evidence, remains unresolved, or is routed incorrectly.\
- Route matters to legal or compliance review when circular letters,
objection language, or product-interpretation questions create
ambiguity.\
- Flag likely noncompliance when New York cybersecurity filing
obligations or supporting evidence are missing, stale, or incomplete.\
- Escalate workers' compensation reporting failures when EDI evidence is
missing or error conditions persist.\
- Require named ownership for resolution of any unresolved DFS filing,
guidance, or cybersecurity issue.\
\
\#\# Common Exception Areas\
- New York often requires stronger line-by-line interpretation than many
other states, especially when department guidance is more specific than
the baseline statutory text.\
- Cybersecurity requirements and notifications may operate through
dedicated DFS processes outside the ordinary product-filing workflow.\
- Filing treatment may vary significantly by line, filing type, and
whether the issue is substantive, procedural, or objection-driven.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability or objection language\
- Conflicts between statutes, regulations, circular letters, and
department guidance\
- Missing evidence for required filing, cybersecurity certification, or
workers' compensation reporting\
- Any unresolved legal or interpretive question affecting implementation
timing\
\
\#\# Recommended AI Posture\
Use New York as the lead state for interpretation-sensitive controls. If
the AI can combine filing evidence, circular-letter precedence,
cybersecurity compliance, and workers' compensation EDI into one
coherent control model, it will be much better prepared for the most
legally nuanced multi-state environments.

**NY\_compliance\_rules.yaml**

state\_code: NY\
state\_name: New York\
jurisdiction\_type: state\
regulator:\
  name: New York Department of Financial Services\
  category: insurance\_regulator\
last\_reviewed: 2026-06-08\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primary\_filing\_platform: SERFF\
  secondary\_platform: DFS cybersecurity and regulatory reporting
portals\
  compact\_status: non\_member\
  sbs\_status: no\
  apcd\_status: no\
\
principles:\
  - id: NY-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: NY-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: NY-P-003\
    text: Treat New York circular letters, guidance, and objection
language as enforceable operating constraints when newer or more
specific.\
  - id: NY-P-004\
    text: Monitor cybersecurity and workers compensation reporting
obligations continuously where applicable.\
  - id: NY-P-005\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: bulletin\_reference\
    type: string\
  - name: circular\_letter\_reference\
    type: string\
  - name: objection\_status\
    type: enum\
    values: \[none, open, pending\_response, resolved, unknown\]\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
  - name: ny\_cybersecurity\_filing\_status\
    type: enum\
    values: \[not\_applicable, pending, submitted, accepted, late,
incomplete, unknown\]\
  - name: ny\_wc\_edi\_acknowledgment\
    type: string\
\
rules:\
  - id: NY-FILING-001\
    category: filing\_channel\
    description: Standard New York product filings should use SERFF
unless a more specific New York instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: NY\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: SERFF\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: NY-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
New York filing evidence is missing or unresolved objection status
remains open.\
    if:\
      any:\
        - all:\
          - field: state\
            operator: equals\
            value: NY\
          - field: filing\_receipt\_id\
            operator: is\_missing\
        - all:\
          - field: state\
            operator: equals\
            value: NY\
          - field: objection\_status\
            operator: in\
            value: \[open, pending\_response, unknown\]\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
route\_to\_human\_review, escalate\_compliance\]\
\
  - id: NY-GUIDANCE-001\
    category: circular\_letter\_and\_guidance\_management\
    description: New York circular letters, guidance, and filing
objections override generic operating assumptions when present or
unresolved.\
    if:\
      any:\
        - field: circular\_letter\_reference\
          operator: is\_present\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: objection\_status\
          operator: in\
          value: \[open, pending\_response, unknown\]\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close, require\_named\_owner\]\
\
  - id: NY-CYBER-001\
    category: cybersecurity\_reporting\
    description: Applicable New York cybersecurity certifications,
notices, and related filings must have current evidence of submission
and status.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: NY\
    then:\
      require:\
        evidence\_fields: \[ny\_cybersecurity\_filing\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: NY-CYBER-002\
    category: cybersecurity\_status\_control\
    description: Late, incomplete, or unknown New York cybersecurity
filing status requires escalation and named remediation ownership.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: NY\
        - field: ny\_cybersecurity\_filing\_status\
          operator: in\
          value: \[pending, late, incomplete, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: NY-WC-001\
    category: workers\_compensation\_reporting\
    description: New York workers compensation reportable claim events
must have acknowledgment evidence when EDI reporting applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: NY\
        - field: line\_of\_business\
          operator: equals\
          value: workers\_compensation\
    then:\
      require:\
        evidence\_fields: \[ny\_wc\_edi\_acknowledgment\]\
      actions\_if\_missing: \[escalate\_claims\_compliance,
open\_remediation\_ticket, require\_manual\_review\]\
\
  - id: NY-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard product
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
        - field: objection\_status\
          operator: in\
          value: \[open, pending\_response, unknown\]\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - conflicting\_state\_guidance\
  - unresolved\_circular\_letter\_or\_objection\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_cybersecurity\_filing\_gap\
  - unresolved\_workers\_comp\_edi\_failure

**MA\_compliance\_profile.md**

\# State Compliance Profile: Massachusetts\
\
\#\# Metadata\
- state\_code: MA\
- state\_name: Massachusetts\
- regulator\_name: Massachusetts Division of Insurance\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, rate and form review, auto market structure oversight,
regulatory data calls, bulletins and decision letters\
- primary\_filing\_platforms:\
- SERFF\
- Massachusetts-specific data-call and reporting channels where
applicable\
- important\_adjacent\_systems:\
- Commonwealth Automobile Reinsurers (CAR) operating environment and
related auto workflows\
- Massachusetts all-payer claims database reporting ecosystem for
applicable health carriers\
- Department of Industrial Accidents workers' compensation reporting
workflows with limited or non-EDI operating pattern\
- compact\_status: member of the Insurance Compact\
- sbs\_status: not an SBS state\
- apcd\_status: yes\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Massachusetts should be treated as a high-exception-content state in a
multi-state AI compliance architecture. On the surface, it looks
straightforward because it uses SERFF for standard insurance product
filings and participates in the Insurance Compact. But operationally,
Massachusetts is more complex than many states because several important
obligations do not follow the clean national default pattern. In
particular, Massachusetts combines mainstream filing mechanics with a
specialized private-passenger auto operating structure, query-based or
limited insurance verification behavior, an all-payer claims database
obligation for applicable health carriers, and a workers' compensation
reporting model that is less cleanly standardized on mature national EDI
than many other states. It also relies meaningfully on bulletins,
decision letters, and practical implementation guidance that AI should
treat as active operating constraints.\
\
For executive decision-making, Massachusetts should be governed through
four connected control layers: filing discipline, market-structure
discipline, data-reporting discipline, and exception discipline. Filing
discipline ensures the right submission channel and auditable evidence.
Market-structure discipline ensures that private-passenger auto
workflows and CAR-adjacent operating requirements are not flattened into
generic personal-auto logic. Data-reporting discipline ensures that APCD
and other required state submissions are monitored continuously.
Exception discipline ensures that decision letters, bulletins, and
state-specific instructions override generic multi-state assumptions
when more specific or newer. Massachusetts is therefore one of the best
states to use when testing whether an AI model can handle workflow
awkwardness rather than just legal text retrieval.\
\
\#\# Regulatory Principles\
1. Required Massachusetts product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. Massachusetts private-passenger auto obligations must be treated
through a specialized operating model rather than generic national auto
assumptions.\
3. Applicable health-claims and related reporting obligations, including
APCD submissions, must be monitored continuously with evidence of
transmission and completeness.\
4. Workers' compensation reporting obligations must be managed according
to Massachusetts-specific processes, even where the state does not
follow the cleanest national EDI pattern.\
5. Massachusetts bulletins, decision letters, and implementation
guidance must be treated as binding operating constraints when newer,
more specific, or explicitly directive.\
6. Ambiguity, unusual products, or unresolved state-specific exceptions
must be escalated to compliance or legal review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard Massachusetts rate, rule, and form filings
should route through SERFF unless a more specific Massachusetts
instruction or specialized process applies.\
- Compact treatment: Massachusetts is a member of the Insurance Compact,
so eligible life and annuity products may follow a compact path where
appropriate, but Massachusetts-specific requirements or interpretations
should still be checked before assuming full path reuse.\
- Auto verification: Massachusetts is not modeled here as a broad
always-on insurer-operated verification state; instead, it should be
treated as limited, query-based, and operationally influenced by CAR and
related market-structure requirements.\
- Workers' compensation: Massachusetts workers' compensation reporting
is operationally important but not treated here as a clean fully mature
EDI state; insurers should expect portal, form, email, or limited-pilot
electronic submission patterns depending on the obligation.\
- APCD or health data reporting: Massachusetts has material APCD and
related health-reporting obligations for applicable carriers, making
health-claims extraction and data-quality controls especially
important.\
- Licensing and regulatory workflow pattern: Massachusetts uses NIPR for
producer-related connectivity but is not an SBS-led operating model;
several obligations remain state-directed or portal-based.\
- Bulletin / directive posture: Bulletins, decision letters, and
implementation instructions are particularly important in Massachusetts
and should be treated as first-class AI inputs when they alter
operational expectations.\
\
\#\# Core Operating Rules\
- Use SERFF for standard Massachusetts rate, rule, and form filings
unless a more specific Massachusetts instruction governs the submission
path.\
- Do not treat a Massachusetts filing as implementation-ready when
required evidence is missing, filing status is unresolved, or relevant
decision-letter conditions remain open.\
- Treat private-passenger auto obligations as specialized Massachusetts
workflows, not generic personal-auto rules, especially when CAR-adjacent
requirements or state queries are involved.\
- For applicable health business, maintain current evidence of APCD and
related required data submissions, including completeness and timing
controls.\
- For workers' compensation, maintain evidence of compliant
Massachusetts reporting through the state's required process even when
the mechanism is non-EDI or only partially electronic.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- decision\_letter\_reference\
- exception\_flag\
- legal\_review\_flag\
- ma\_auto\_query\_response\_status\
- ma\_car\_workflow\_flag\
- ma\_apcd\_submission\_status\
- ma\_wc\_reporting\_status\
\
\#\# Typical AI Actions\
- Block launch when a required Massachusetts filing lacks acceptable
evidence or remains subject to unresolved conditions.\
- Route private-passenger auto issues to Massachusetts-specialized
workflows instead of applying generic personal-auto logic.\
- Flag likely noncompliance when APCD submissions or related
health-reporting evidence are missing, late, incomplete, or in error
status.\
- Escalate workers' compensation reporting gaps when the required
Massachusetts process has not been completed or cannot be evidenced.\
- Require human review when bulletins, decision letters, CAR-related
obligations, or state-specific instructions create ambiguity the AI
cannot resolve confidently.\
\
\#\# Common Exception Areas\
- Massachusetts private-passenger auto obligations often require more
specialized handling than ordinary state personal-auto workflows.\
- Decision letters and practical implementation guidance may materially
affect how a filing or product change should be operationalized.\
- Workers' compensation reporting may vary by obligation and operational
channel rather than fitting a single national EDI template.\
- APCD and other health-data obligations create additional
data-governance and transmission controls outside ordinary product
filing logic.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability or unresolved decision-letter
conditions\
- Conflicts between statutes, regulations, bulletins, and implementation
instructions\
- Missing evidence for required filing, APCD submission, or workers'
compensation reporting\
- Any Massachusetts auto-market-structure question that cannot be
resolved confidently by rule logic\
\
\#\# Recommended AI Posture\
Use Massachusetts as the leading workflow-exception state. If the AI can
combine SERFF filing controls, CAR-aware auto logic, APCD monitoring,
non-standard workers' compensation reporting, and
bulletin/decision-letter precedence into one coherent model, it will be
much more resilient in handling the structurally awkward states that do
not fit a simple national template.

**MA\_compliance\_rules.yaml**

state\_code: MA\
state\_name: Massachusetts\
jurisdiction\_type: state\
regulator:\
  name: Massachusetts Division of Insurance\
  category: insurance\_regulator\
last\_reviewed: 2026-06-08\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primary\_filing\_platform: SERFF\
  secondary\_platform: Massachusetts data-call and reporting workflows\
  compact\_status: member\
  sbs\_status: no\
  apcd\_status: yes\
\
principles:\
  - id: MA-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: MA-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: MA-P-003\
    text: Treat Massachusetts auto-market obligations as specialized
workflows rather than generic personal-auto rules.\
  - id: MA-P-004\
    text: Monitor Massachusetts APCD and other recurring state reporting
obligations continuously where applicable.\
  - id: MA-P-005\
    text: Treat Massachusetts bulletins, decision letters, and
implementation guidance as enforceable operating constraints when newer
or more specific.\
  - id: MA-P-006\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: bulletin\_reference\
    type: string\
  - name: decision\_letter\_reference\
    type: string\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
  - name: ma\_auto\_query\_response\_status\
    type: enum\
    values: \[not\_applicable, active, pending, error, unknown\]\
  - name: ma\_car\_workflow\_flag\
    type: boolean\
  - name: ma\_apcd\_submission\_status\
    type: enum\
    values: \[not\_applicable, pending, submitted, accepted, late,
incomplete, error, unknown\]\
  - name: ma\_wc\_reporting\_status\
    type: enum\
    values: \[not\_applicable, submitted, acknowledged, pending, late,
incomplete, error, unknown\]\
\
rules:\
  - id: MA-FILING-001\
    category: filing\_channel\
    description: Standard Massachusetts product filings should use SERFF
unless a more specific Massachusetts instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MA\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: SERFF\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: MA-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
Massachusetts filing evidence is missing or related decision-letter
conditions remain unresolved.\
    if:\
      any:\
        - all:\
          - field: state\
            operator: equals\
            value: MA\
          - field: filing\_receipt\_id\
            operator: is\_missing\
        - all:\
          - field: state\
            operator: equals\
            value: MA\
          - field: decision\_letter\_reference\
            operator: is\_present\
          - field: filing\_status\
            operator: in\
            value: \[objection, draft, rejected, withdrawn\]\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
route\_to\_human\_review, escalate\_compliance\]\
\
  - id: MA-AUTO-001\
    category: auto\_market\_structure\
    description: Massachusetts private passenger auto work should be
routed through specialized state logic when CAR-adjacent workflows or
query-based verification obligations apply.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MA\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
    then:\
      require:\
        evidence\_fields: \[ma\_auto\_query\_response\_status,
ma\_car\_workflow\_flag\]\
      actions\_if\_missing: \[route\_to\_specialized\_auto\_workflow,
flag\_operational\_noncompliance, escalate\_compliance\]\
\
  - id: MA-AUTO-002\
    category: auto\_market\_structure\_health\
    description: Massachusetts auto query-response and CAR-related
workflow signals should be active or explicitly not applicable for
personal auto operations.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MA\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
        - field: ma\_auto\_query\_response\_status\
          operator: in\
          value: \[pending, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
route\_to\_specialized\_auto\_workflow, require\_named\_owner\]\
\
  - id: MA-APCD-001\
    category: health\_data\_reporting\
    description: Applicable Massachusetts APCD and related health-data
submissions must have current evidence of transmission and acceptable
status.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MA\
        - field: line\_of\_business\
          operator: in\
          value: \[health, accident\_and\_health, dental, vision\]\
    then:\
      require:\
        evidence\_fields: \[ma\_apcd\_submission\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: MA-APCD-002\
    category: health\_data\_status\_control\
    description: Late, incomplete, error, or unknown Massachusetts APCD
submission status requires escalation and named remediation ownership.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MA\
        - field: ma\_apcd\_submission\_status\
          operator: in\
          value: \[pending, late, incomplete, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: MA-WC-001\
    category: workers\_compensation\_reporting\
    description: Massachusetts workers compensation reporting
obligations must have current evidence of completion through the
required state process, even where the mechanism is non-EDI or only
partially electronic.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MA\
        - field: line\_of\_business\
          operator: equals\
          value: workers\_compensation\
    then:\
      require:\
        evidence\_fields: \[ma\_wc\_reporting\_status\]\
      actions\_if\_missing: \[escalate\_claims\_compliance,
open\_remediation\_ticket, require\_manual\_review\]\
\
  - id: MA-BULLETIN-001\
    category: bulletin\_and\_decision\_letter\_management\
    description: Massachusetts bulletins, decision letters, and
implementation guidance override generic operating assumptions when
present or unresolved.\
    if:\
      any:\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: decision\_letter\_reference\
          operator: is\_present\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close, require\_named\_owner\]\
\
  - id: MA-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard product
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
        - field: decision\_letter\_reference\
          operator: is\_present\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - unresolved\_decision\_letter\_condition\
  - conflicting\_state\_guidance\
  - unresolved\_auto\_market\_structure\_issue\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_apcd\_submission\_gap\
  - unresolved\_workers\_comp\_reporting\_gap

**CA\_compliance\_profile.md**

\# State Compliance Profile: California\
\
\#\# Metadata\
- statecode: CA\
- statename: California\
- regulatorname: California Department of Insurance\
- regulatortype: state insurance regulator\
- primaryregulatoryscope: insurance product filings, rate and form
review, market oversight, Proposition 103 public-rate-review processes,
regulatory reporting, bulletins and notices\
- primaryfilingplatforms:\
- SERFF\
- California Department of Insurance public filing search and
state-specific reporting channels where applicable\
- importantadjacentsystems:\
- Proposition 103 public rate-review environment for applicable personal
lines\
- California Workers' Compensation Information System (WCIS) EDI
environment\
- California FAIR Plan and California Earthquake Authority data and
reporting adjacencies where applicable\
- compactstatus: non-member of the Insurance Compact\
- sbsstatus: not an SBS state\
- apcdstatus: no broad APCD obligation reflected in this operating
pattern\
- lastreviewed: 2026-06-08\
- intendeduse: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
California should be treated as one of the highest-materiality and
highest-scrutiny states in a multi-state AI compliance architecture.
Although California uses SERFF for many filing workflows, it is not a
simple mainstream state. What makes California distinctive is the
combination of standard electronic filing mechanics with unusually
visible public-rate-review dynamics, especially under Proposition 103
for personal auto, homeowners, and other personal lines. California also
combines mainstream filing logic with specialized public-search access,
high consumer and advocacy sensitivity, meaningful catastrophe-related
reporting expectations, workers' compensation EDI through a separate
state environment, and line-specific market mechanisms such as FAIR Plan
and earthquake-adjacent reporting. AI therefore cannot treat California
as just another SERFF state; it must also reason about public-objection
risk, filing sensitivity, and implementation constraints beyond the
filing receipt alone.\
\
For executive decision-making, California should be governed through
four connected control layers: filing discipline, public-rate-review
discipline, operational reporting discipline, and exception discipline.
Filing discipline ensures that the right submission path and evidence of
filing are preserved. Public-rate-review discipline ensures that
personal-lines rate activity subject to Proposition 103 sensitivity is
governed more carefully than generic filing logic. Operational reporting
discipline ensures that workers' compensation EDI and specialized
California reporting obligations are monitored continuously. Exception
discipline ensures that notices, bulletins, objections, hearing risk,
and catastrophe-related directives override generic multi-state
assumptions when more specific or newer. California is also a non-member
of the Insurance Compact, so eligible life and annuity products require
direct California treatment rather than compact routing.\
\
\#\# Regulatory Principles\
1. Required California product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. California public-rate-review obligations and Proposition 103
sensitivity must be treated as core operating constraints rather than
optional context.\
3. Workers' compensation reporting and other recurring California
operational obligations must be monitored continuously with evidence of
transmission, acknowledgment, and remediation where applicable.\
4. California notices, bulletins, objections, hearing-related
developments, and implementation guidance must override generic
enterprise assumptions when newer or more specific.\
5. Ambiguity, public-objection risk, catastrophe-related exceptions, or
unresolved filing conditions must be escalated to compliance or legal
review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard California rate, rule, and form filings
generally route through SERFF unless a more specific California process
or department instruction governs the submission path.\
- Compact treatment: California is not a member of the Insurance
Compact, so eligible life and annuity products require direct California
treatment and should not be routed through compact logic.\
- Auto verification: California is not modeled here as a continuous
insurer-operated verification state in the same pattern as Texas or
Georgia, but personal auto filings and operations still require
heightened scrutiny because of public-rate-review sensitivity.\
- Workers' compensation: California workers' compensation reporting is
highly material and requires EDI-based reporting through WCIS and
related state workers' compensation processes rather than ordinary CDI
filing logic.\
- APCD or health data reporting: California is not modeled here as a
broad APCD state in this operating pattern, but health and specialty
lines may still have line-specific reporting and market-conduct
requirements.\
- Licensing and regulatory workflow pattern: California uses NIPR
connectivity for producer-facing processes but is not an SBS-led
operating model; several obligations remain department-specific or
program-specific.\
- Bulletin / directive posture: Notices, bulletins, public hearing
dynamics, and objection language are especially important in California
and should be treated as first-class decision inputs for AI, especially
where personal-lines rates, catastrophe exposure, FAIR Plan, or market
availability issues are involved.\
\
\#\# Core Operating Rules\
- Use SERFF for standard California rate, rule, and form filings unless
a more specific California instruction governs the submission path.\
- Do not treat a California filing as implementation-ready when required
evidence is missing, objection status remains unresolved, or Proposition
103-sensitive conditions remain open.\
- Treat personal-lines rate activity with public-review sensitivity as a
specialized California workflow, not generic SERFF processing.\
- For workers' compensation, maintain compliant WCIS reporting
capability with evidence of submission, acknowledgment, and issue
remediation for reportable events.\
- Treat California notices, catastrophe reporting requests, FAIR Plan or
CEA-adjacent obligations, and public-objection risk signals as
state-specific control triggers that can override standard operating
assumptions.\
\
\#\# Key Signals AI Should Monitor\
- state\
- lineofbusiness\
- filingtype\
- filingchannel\
- filingreceiptid\
- filingstatus\
- filingsubmissiondate\
- producteffectivedate\
- bulletinreference\
- objectionstatus\
- publicreviewflag\
- exceptionflag\
- legalreviewflag\
- cawcisacknowledgment\
- caprop103sensitivityflag\
- cafairplanceaadjacencyflag\
\
\#\# Typical AI Actions\
- Block launch when a required California filing lacks acceptable
evidence, remains unresolved, or is routed incorrectly.\
- Route personal-lines rate activity to California-specialized workflows
when Proposition 103 sensitivity or public-review exposure is present.\
- Flag likely operational noncompliance when California workers'
compensation reporting evidence is missing, stale, or in error status.\
- Escalate likely hearing, objection, or catastrophe-reporting risk when
public-review or state-specific exception signals are active.\
- Require human review when California notices, objections, FAIR Plan or
earthquake-related obligations, or implementation instructions create
ambiguity the AI cannot resolve confidently.\
\
\#\# Common Exception Areas\
- Personal auto and homeowners rate activity may trigger heightened
California public-review and objection sensitivity that changes the
effective operating timeline.\
- FAIR Plan, CEA, catastrophe, and market-availability obligations may
create reporting or implementation requirements outside the ordinary
product-filing path.\
- Workers' compensation obligations are operationally adjacent but
governed through separate state reporting structures from ordinary CDI
filing logic.\
- Filing treatment can vary materially by line, filing type, and whether
the issue is rate-sensitive, form-specific, hearing-sensitive, or
catastrophe-driven.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability or unresolved objection conditions\
- Conflicts between statutes, regulations, notices, and implementation
instructions\
- Missing evidence for required filing, workers' compensation reporting,
or public-review controls\
- Any California public-rate-review, FAIR Plan, earthquake, or
catastrophe-related issue that cannot be resolved confidently by rule
logic\
\
\#\# Recommended AI Posture\
Use California as the lead state for public-scrutiny-sensitive controls.
If the AI can combine SERFF filing logic, Proposition 103-aware
handling, workers' compensation EDI monitoring, and stronger objection
and exception governance into one coherent model, it will be much better
prepared for states where regulatory risk is shaped not only by legal
text but also by public process and market sensitivity.

**CA\_compliance\_rules.yaml**

statecode: CA\
statename: California\
jurisdictiontype: state\
regulator:\
  name: California Department of Insurance\
  category: insuranceregulator\
lastreviewed: 2026-06-08\
intendeduse: aicompliancecontrols\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primaryfilingplatform: SERFF\
  secondaryplatform: California public filing search and state-specific
reporting workflows\
  compactstatus: nonmember\
  sbsstatus: no\
  apcdstatus: no\
\
principles:\
  - id: CA-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: CA-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: CA-P-003\
    text: Treat California public-rate-review and Proposition 103
sensitivity as enforceable operating constraints where applicable.\
  - id: CA-P-004\
    text: Monitor California workers compensation and other recurring
state operational reporting obligations continuously where applicable.\
  - id: CA-P-005\
    text: Treat California notices, objections, and implementation
guidance as enforceable operating constraints when newer or more
specific.\
  - id: CA-P-006\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: lineofbusiness\
    type: string\
  - name: filingtype\
    type: string\
  - name: filingchannel\
    type: string\
  - name: filingreceiptid\
    type: string\
  - name: filingstatus\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filingsubmissiondate\
    type: date\
  - name: producteffectivedate\
    type: date\
  - name: bulletinreference\
    type: string\
  - name: objectionstatus\
    type: enum\
    values: \[none, open, pendingresponse, resolved, unknown\]\
  - name: publicreviewflag\
    type: boolean\
  - name: exceptionflag\
    type: boolean\
  - name: legalreviewflag\
    type: boolean\
  - name: cawcisacknowledgment\
    type: string\
  - name: caprop103sensitivityflag\
    type: boolean\
  - name: cafairplanceaadjacencyflag\
    type: boolean\
\
rules:\
  - id: CA-FILING-001\
    category: filingchannel\
    description: Standard California product filings should use SERFF
unless a more specific California instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CA\
        - field: filingtype\
          operator: in\
          value: \[newproduct, productchange, ratechange, formchange,
rulechange\]\
    then:\
      require:\
        filingchannel: SERFF\
        evidencefields: \[filingreceiptid, filingstatus,
filingsubmissiondate\]\
      actionsifmissing: \[blockrelease, routetoregulatoryfiling,
escalatecompliance\]\
\
  - id: CA-FILING-002\
    category: filingstatuscontrol\
    description: Product implementation should not proceed when required
California filing evidence is missing or unresolved objection conditions
remain open.\
    if:\
      any:\
        - all:\
          - field: state\
            operator: equals\
            value: CA\
          - field: filingreceiptid\
            operator: ismissing\
        - all:\
          - field: state\
            operator: equals\
            value: CA\
          - field: objectionstatus\
            operator: in\
            value: \[open, pendingresponse, unknown\]\
    then:\
      actionsiftrue: \[blockrelease, requestmissingevidence,
routetohumanreview, escalatecompliance\]\
\
  - id: CA-PROP103-001\
    category: publicrate\_review\
    description: California personal-lines rate activity with
Proposition 103 sensitivity must be routed through specialized
public-review-aware workflow controls.\
    if:\
      any:\
        - field: caprop103sensitivityflag\
          operator: equals\
          value: true\
        - field: publicreviewflag\
          operator: equals\
          value: true\
    then:\
      actionsiftrue: \[routetospecializedrateworkflow,
require\_named\_owner, routetohumanreview, preventautoclose\]\
\
  - id: CA-PROP103-002\
    category: publicrate\_timeline\_control\
    description: California public-review-sensitive filings should not
be treated as implementation-ready while objection or hearing exposure
remains unresolved.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CA\
        - field: publicreviewflag\
          operator: equals\
          value: true\
        - field: objectionstatus\
          operator: in\
          value: \[open, pendingresponse, unknown\]\
    then:\
      actionsiftrue: \[blockrelease, routetohumanreview,
escalatecompliance\]\
\
  - id: CA-WC-001\
    category: workerscompensationreporting\
    description: California workers compensation reportable claim events
must have WCIS acknowledgment evidence when EDI reporting applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CA\
        - field: lineofbusiness\
          operator: equals\
          value: workerscompensation\
    then:\
      require:\
        evidencefields: \[cawcisacknowledgment\]\
      actionsifmissing: \[escalateclaimscompliance,
openremediationticket, requiremanualreview\]\
\
  - id: CA-EXCEPTION-001\
    category: fairplan\_and\_earthquake\_adjacency\
    description: California FAIR Plan, earthquake, catastrophe, or
market-availability adjacency requires specialized routing and exception
handling.\
    if:\
      any:\
        - field: cafairplanceaadjacencyflag\
          operator: equals\
          value: true\
        - field: exceptionflag\
          operator: equals\
          value: true\
    then:\
      actionsiftrue: \[routetohumanreview, attachstateguidance,
require\_named\_owner, preventautoclose\]\
\
  - id: CA-BULLETIN-001\
    category: bulletin\_and\_objection\_management\
    description: California notices, objections, and implementation
guidance override generic operating assumptions when present or
unresolved.\
    if:\
      any:\
        - field: bulletinreference\
          operator: ispresent\
        - field: objectionstatus\
          operator: in\
          value: \[open, pendingresponse, unknown\]\
        - field: exceptionflag\
          operator: equals\
          value: true\
    then:\
      actionsiftrue: \[routetohumanreview, attachstateguidance,
preventautoclose, requirenamedowner\]\
\
  - id: CA-LEGAL-001\
    category: legalreview\
    description: Uncertainty, ambiguity, or non-standard California
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legalreviewflag\
          operator: equals\
          value: true\
        - field: exceptionflag\
          operator: equals\
          value: true\
        - field: objectionstatus\
          operator: in\
          value: \[open, pendingresponse, unknown\]\
        - field: caprop103sensitivityflag\
          operator: equals\
          value: true\
    then:\
      actionsiftrue: \[routetolegalreview, blockautomationonlydecision,
requirenamedowner\]\
\
defaultactions:\
  - preserveaudittrail\
  - logruleevaluation\
  - recorddecisionowner\
\
humanreviewtriggers:\
  - ambiguousfilingobligation\
  - unusualproductstructure\
  - unresolvedpublicreviewcondition\
  - conflictingstateguidance\
  - unresolvedfairplan\_or\_earthquake\_issue\
  - missingevidenceforrequiredsubmission\
  - unresolvedworkerscompwcisfailure

**NCcomplianceprofile.md**

\# State Compliance Profile: North Carolina\
\
\#\# Metadata\
- statecode: NC\
- statename: North Carolina\
- regulatorname: North Carolina Department of Insurance\
- regulatortype: state insurance regulator\
- primaryregulatoryscope: insurance product filings, market oversight,
rate and form review, licensing, regulatory bulletins and directives\
- primaryfilingplatforms:\
- SERFF\
- NAIC-linked licensing and reporting systems\
- importantadjacentsystems:\
- North Carolina Online Liability Insurance Verification (OLIV) / DMV
cancellation-notification workflow\
- North Carolina Industrial Commission workers' compensation EDI
environment\
- SBS and NIPR-enabled licensing workflows\
- compactstatus: member of the Insurance Compact\
- sbsstatus: yes\
- apcdstatus: no broad APCD obligation reflected in this operating
pattern\
- lastreviewed: 2026-06-08\
- intendeduse: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
North Carolina should be treated as one of the best baseline states for
a multi-state AI compliance architecture because it follows the
mainstream national operating pattern while still requiring meaningful
operational controls beyond product filing. The state uses SERFF for
standard rate, rule, and form submissions, participates in the Insurance
Compact for eligible life and annuity products, uses SBS-aligned
licensing patterns, and imposes recurring operational obligations in
both personal auto and workers' compensation. That makes North Carolina
valuable not because it is a major exception state, but because it is
the closest thing to a reusable reference model for a large portion of
the country.\
\
For executive decision-making, North Carolina should be governed through
three connected control layers: filing discipline, operational reporting
discipline, and state-guidance discipline. Filing discipline ensures
that the correct filing path is used and that evidence of submission and
status is preserved. Operational reporting discipline ensures that auto
insurance termination notifications and workers' compensation EDI
obligations remain healthy and current. State-guidance discipline
ensures that North Carolina bulletins, directives, and implementation
notes override generic assumptions when they are newer or more specific.
Because North Carolina is relatively clean structurally, it is an ideal
state to use as the default pattern for scaling the next 20--30
jurisdictions, with only targeted modifications for exceptions.\
\
\#\# Regulatory Principles\
1. Required North Carolina product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. Recurring North Carolina operational reporting obligations,
especially auto insurance status notifications and workers' compensation
EDI, must be monitored continuously rather than treated as one-time
legal requirements.\
3. Licensing and regulatory workflow evidence should align with SBS and
NIPR-enabled operating patterns where applicable.\
4. North Carolina bulletins, directives, and implementation guidance
must override generic enterprise assumptions when newer or more
specific.\
5. Ambiguity, missing evidence, or state-specific exceptions must be
escalated to compliance or legal review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard North Carolina rate, rule, and form filings
should route through SERFF unless a more specific North Carolina
instruction or specialized process governs the submission path.\
- Compact treatment: North Carolina is a member of the Insurance
Compact, so eligible life and annuity products may follow a compact path
where appropriate, subject to product and line applicability.\
- Auto verification: North Carolina requires insurer participation in a
liability insurance status workflow tied to DMV notification and
policy-termination reporting, so policy-administration systems must
preserve reliable evidence of cancellation or status-notification
processing.\
- Workers' compensation: North Carolina workers' compensation reporting
requires EDI-based claim-event reporting through the Industrial
Commission's required framework.\
- APCD or health data reporting: North Carolina is not modeled here as a
broad APCD state, but insurers should still expect line-specific data
submissions and reporting obligations in selected health and
market-conduct contexts.\
- Licensing and regulatory workflow pattern: North Carolina is an
SBS-aligned state and uses NIPR connectivity, making it a strong model
for standardized licensing and regulatory workflow integration.\
- Bulletin / directive posture: North Carolina bulletins and directives
are important, but the overall state pattern is structurally cleaner and
more repeatable than high-exception states like Florida, Massachusetts,
or California.\
\
\#\# Core Operating Rules\
- Use SERFF for standard North Carolina rate, rule, and form filings
unless a more specific North Carolina instruction governs the submission
path.\
- Do not treat a North Carolina filing as implementation-ready when
required evidence is missing, filing status is unresolved, or supporting
materials are incomplete for the obligation type.\
- For personal auto business, maintain evidence that required DMV-facing
insurance-status or policy-termination notifications are being produced
correctly and on time.\
- For workers' compensation, maintain compliant EDI reporting capability
with evidence of transmission, acknowledgment, and issue remediation for
reportable events.\
- Treat North Carolina bulletins and implementation guidance as
state-specific control inputs even though the state otherwise follows a
baseline national pattern.\
\
\#\# Key Signals AI Should Monitor\
- state\
- lineofbusiness\
- filingtype\
- filingchannel\
- filingreceiptid\
- filingstatus\
- filingsubmissiondate\
- producteffectivedate\
- bulletinreference\
- exceptionflag\
- legalreviewflag\
- ncolivnotificationstatus\
- ncwcediacknowledgment\
- ncsbsworkflowstatus\
\
\#\# Typical AI Actions\
- Block launch when a required North Carolina filing lacks acceptable
evidence or is routed incorrectly.\
- Flag likely operational noncompliance when auto-notification or
workers' compensation reporting evidence is missing, stale, or in error
status.\
- Route licensing or regulatory workflow issues through SBS-aligned
handling when state and process conditions match the standardized
model.\
- Escalate to compliance or legal review when North Carolina guidance or
line-specific exceptions create ambiguity that the AI cannot resolve
confidently.\
- Use North Carolina as the default state archetype when generating or
testing reusable multi-state AI controls.\
\
\#\# Common Exception Areas\
- Filing treatment may still vary by line, product structure, and
whether the obligation is prior approval, file-and-use, informational,
exempt, or processed through a specialized program.\
- Auto insurance termination and DMV-facing workflows may differ
operationally from always-on real-time verification states such as Texas
or Florida.\
- Workers' compensation is governed through a separate reporting
environment from ordinary product filing logic.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, regulations, and newer bulletins or
directives\
- Missing evidence for required filing, auto-notification activity, or
workers' compensation reporting\
- Any line-specific North Carolina exception that cannot be resolved
confidently by rule logic\
\
\#\# Recommended AI Posture\
Use North Carolina as the baseline reference implementation for a
reusable national compliance pattern. If the AI can reliably handle
SERFF, compact logic, SBS-aligned workflows, auto-status notifications,
and workers' compensation EDI here, the resulting model will scale
efficiently across many other states with only targeted adjustments for
exceptions.

**NCcompliancerules.yaml**

**WI\_compliance\_profile.md**

\# State Compliance Profile: Wisconsin\
\
\#\# Metadata\
- statecode: WI\
- statename: Wisconsin\
- regulatorname: Wisconsin Office of the Commissioner of Insurance\
- regulatortype: state insurance regulator\
- primaryregulatoryscope: insurance product filings, market oversight,
rate and form review, licensing, bulletins and directives\
- primaryfilingplatforms:\
- SERFF\
- NAIC-linked licensing and reporting systems\
- importantadjacentsystems:\
- Wisconsin workers' compensation EDI environment\
- state-specific data calls and bulletins where applicable\
- producer licensing through NIPR connectivity\
- compactstatus: member of the Insurance Compact\
- sbsstatus: not an SBS state\
- apcdstatus: no broad APCD obligation reflected in this operating
pattern\
- lastreviewed: 2026-06-08\
- intendeduse: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Wisconsin should be treated as a lower-variance standard state in a
multi-state AI compliance architecture. The state follows the mainstream
national pattern for product filing by using SERFF, participates in the
Insurance Compact for eligible life and annuity products, and generally
does not introduce the same level of structural exception handling seen
in Florida, Massachusetts, or California. What makes Wisconsin still
important for AI control design is that it preserves the need for
auditable filing discipline, bulletin-aware exception handling, and
recurring operational reporting in workers' compensation. That makes
Wisconsin a useful validation state for proving that the baseline
architecture can operate cleanly in a more standard environment without
relying on heavy exception logic.\
\
For executive decision-making, Wisconsin should be governed through
three connected control layers: filing discipline, operational reporting
discipline, and bulletin-aware exception discipline. Filing discipline
ensures that required product submissions are routed correctly with
acceptable evidence. Operational reporting discipline ensures that
workers' compensation and any other required recurring state submissions
remain current and evidenced. Bulletin-aware exception discipline
ensures that Wisconsin directives and implementation guidance still
override generic enterprise assumptions when newer or more specific.
Because Wisconsin is comparatively stable structurally, it is a good
state for testing whether a reusable multi-state AI control model can
handle the standard case efficiently.\
\
\#\# Regulatory Principles\
1. Required Wisconsin product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. Regulatory activity must be auditable, with evidence of submission,
acknowledgment, status, and effective date preserved in retrievable
form.\
3. Wisconsin workers' compensation reporting obligations and other
recurring state reporting duties must be monitored continuously where
applicable.\
4. Wisconsin bulletins, directives, and implementation guidance must
override generic enterprise assumptions when newer or more specific.\
5. Ambiguity, unusual products, evidence gaps, or state-specific
exceptions must be escalated to compliance or legal review before
implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard Wisconsin rate, rule, and form filings should
route through SERFF unless a more specific Wisconsin instruction or
specialized process governs the submission path.\
- Compact treatment: Wisconsin is a member of the Insurance Compact, so
eligible life and annuity products may follow a compact path where
appropriate, subject to product and line applicability.\
- Auto verification: Wisconsin is not modeled here as a continuous
insurer-operated motor vehicle insurance verification state;
policyholders typically satisfy proof-of-insurance requirements through
traditional evidence rather than a standing insurer feed.\
- Workers' compensation: Wisconsin workers' compensation reporting is
material and should be treated as EDI-based or electronically reportable
through the state's required framework for applicable claim events.\
- APCD or health data reporting: Wisconsin is not modeled here as a
broad APCD state, though insurers should still expect line-specific data
submissions or market-conduct reporting obligations when requested.\
- Licensing and regulatory workflow pattern: Wisconsin uses NIPR
connectivity and NAIC-linked systems for many regulatory workflows, but
it is not an SBS-led operating model.\
- Bulletin / directive posture: Wisconsin bulletins and directives are
important but typically operate within a cleaner and more standard
filing environment than the high-exception states.\
\
\#\# Core Operating Rules\
- Use SERFF for standard Wisconsin rate, rule, and form filings unless a
more specific Wisconsin instruction governs the submission path.\
- Do not treat a Wisconsin filing as implementation-ready when required
evidence is missing, filing status is unresolved, or supporting
materials are incomplete for the obligation type.\
- For workers' compensation, maintain compliant electronic reporting
capability with evidence of transmission, acknowledgment, and issue
remediation for reportable events.\
- Preserve references to Wisconsin bulletins, directives, and filing
notes so AI can distinguish standard rules from state-specific
exceptions.\
- Treat Wisconsin as a baseline standard-state validation case rather
than an architecture-breaking exception state.\
\
\#\# Key Signals AI Should Monitor\
- state\
- lineofbusiness\
- filingtype\
- filingchannel\
- filingreceiptid\
- filingstatus\
- filingsubmissiondate\
- producteffectivedate\
- bulletinreference\
- exceptionflag\
- legalreviewflag\
- wiwcediacknowledgment\
- winiprworkflowstatus\
- wistatereportingstatus\
\
\#\# Typical AI Actions\
- Block launch when a required Wisconsin filing lacks acceptable
evidence or is routed incorrectly.\
- Flag likely operational noncompliance when workers' compensation
reporting evidence is missing, stale, or in error status.\
- Route licensing or workflow issues through NIPR-aware handling when
the process depends on producer or appointment workflows.\
- Escalate to compliance or legal review when Wisconsin guidance or
line-specific exceptions create ambiguity that the AI cannot resolve
confidently.\
- Use Wisconsin as a standard-state quality check for the broader
reusable control architecture.\
\
\#\# Common Exception Areas\
- Filing treatment may still vary by line, product structure, and
whether the obligation is prior approval, file-and-use, informational,
exempt, or managed through a specialized program.\
- Workers' compensation operates through a separate reporting
environment from ordinary product filing logic.\
- Bulletin language or line-specific instructions may change operational
expectations even in an otherwise stable regulatory pattern.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, regulations, and newer bulletins or
directives\
- Missing evidence for required filing or workers' compensation
reporting\
- Any line-specific Wisconsin exception that cannot be resolved
confidently by rule logic\
\
\#\# Recommended AI Posture\
Use Wisconsin as the standard-state validation case. If the AI can
reliably handle SERFF, compact logic, workers' compensation reporting,
and bulletin-aware controls here without unnecessary exception
complexity, it will improve confidence that the reusable national
architecture works cleanly in lower-variance jurisdictions.

**WI\_compliance\_rules.yaml**

**WIcompliancerules.yaml**

statecode: WI\
statename: Wisconsin\
jurisdictiontype: state\
regulator:\
  name: Wisconsin Office of the Commissioner of Insurance\
  category: insuranceregulator\
lastreviewed: 2026-06-08\
intendeduse: aicompliancecontrols\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primaryfilingplatform: SERFF\
  secondaryplatform: NAIC-linked licensing and reporting systems\
  compactstatus: member\
  sbsstatus: no\
  apcdstatus: no\
\
principles:\
  - id: WI-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: WI-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: WI-P-003\
    text: Monitor Wisconsin workers compensation and other recurring
state reporting obligations continuously where applicable.\
  - id: WI-P-004\
    text: Treat Wisconsin bulletins, directives, and implementation
guidance as enforceable operating constraints when newer or more
specific.\
  - id: WI-P-005\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: lineofbusiness\
    type: string\
  - name: filingtype\
    type: string\
  - name: filingchannel\
    type: string\
  - name: filingreceiptid\
    type: string\
  - name: filingstatus\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filingsubmissiondate\
    type: date\
  - name: producteffectivedate\
    type: date\
  - name: bulletinreference\
    type: string\
  - name: exceptionflag\
    type: boolean\
  - name: legalreviewflag\
    type: boolean\
  - name: wiwcediacknowledgment\
    type: string\
  - name: winiprworkflowstatus\
    type: enum\
    values: \[active, pending, complete, error, unknown\]\
  - name: wistatereportingstatus\
    type: enum\
    values: \[notapplicable, pending, submitted, accepted, late, error,
unknown\]\
\
rules:\
  - id: WI-FILING-001\
    category: filingchannel\
    description: Standard Wisconsin product filings should use SERFF
unless a more specific Wisconsin instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: WI\
        - field: filingtype\
          operator: in\
          value: \[newproduct, productchange, ratechange, formchange,
rulechange\]\
    then:\
      require:\
        filingchannel: SERFF\
        evidencefields: \[filingreceiptid, filingstatus,
filingsubmissiondate\]\
      actionsifmissing: \[blockrelease, routetoregulatoryfiling,
escalatecompliance\]\
\
  - id: WI-FILING-002\
    category: filingstatuscontrol\
    description: Product implementation should not proceed when required
Wisconsin filing evidence is missing or not in the acceptable
state-defined status.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: WI\
        - field: filingreceiptid\
          operator: ismissing\
    then:\
      actionsiftrue: \[blockrelease, requestmissingevidence,
escalatecompliance\]\
\
  - id: WI-WC-001\
    category: workerscompensationreporting\
    description: Wisconsin workers compensation reportable claim events
must have acknowledgment evidence when electronic reporting applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: WI\
        - field: lineofbusiness\
          operator: equals\
          value: workerscompensation\
    then:\
      require:\
        evidencefields: \[wiwcediacknowledgment\]\
      actionsifmissing: \[escalateclaimscompliance,
openremediationticket, requiremanualreview\]\
\
  - id: WI-NIPR-001\
    category: licensingworkflowintegration\
    description: Wisconsin licensing and producer-related workflows
should have current evidence of completion or active processing where
NIPR connectivity applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: WI\
    then:\
      require:\
        evidencefields: \[winiprworkflowstatus\]\
      actionsifmissing: \[openremediationticket, notifybusinessowner,
escalatecompliance\]\
\
  - id: WI-REPORT-001\
    category: statereporting\
    description: Wisconsin recurring state reporting obligations should
have current evidence of submission and acceptable status when
applicable.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: WI\
    then:\
      require:\
        evidencefields: \[wistatereportingstatus\]\
      actionsifmissing: \[flagoperationalnoncompliance,
openremediationticket, notifybusinessowner\]\
\
  - id: WI-BULLETIN-001\
    category: bulletinexceptionmanagement\
    description: Wisconsin bulletins, directives, and implementation
guidance override generic operating assumptions when newer or more
specific.\
    if:\
      any:\
        - field: bulletinreference\
          operator: ispresent\
        - field: exceptionflag\
          operator: equals\
          value: true\
    then:\
      actionsiftrue: \[routetohumanreview, attachstateguidance,
preventautoclose\]\
\
  - id: WI-LEGAL-001\
    category: legalreview\
    description: Uncertainty, ambiguity, or non-standard Wisconsin
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legalreviewflag\
          operator: equals\
          value: true\
        - field: exceptionflag\
          operator: equals\
          value: true\
    then:\
      actionsiftrue: \[routetolegalreview, blockautomationonlydecision,
requirenamedowner\]\
\
defaultactions:\
  - preserveaudittrail\
  - logruleevaluation\
  - recorddecisionowner\
\
humanreviewtriggers:\
  - ambiguousfilingobligation\
  - unusualproductstructure\
  - conflictingstateguidance\
  - missingevidenceforrequiredsubmission\
  - unresolvedworkerscompreportingfailure\
  - unresolvedlicensingworkflowfailure\
  - unresolvedstatereportingfailure

**MI\_compliance\_profile.md**

\# State Compliance Profile: Michigan\
\
\#\# Metadata\
- state\_code: MI\
- state\_name: Michigan\
- regulator\_name: Michigan Department of Insurance and Financial
Services\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, rate and form review, no-fault auto reporting, regulatory
bulletins, licensing, and selected data calls\
- primary\_filing\_platforms:\
- SERFF\
- Michigan-specific reporting channels for no-fault and
auto-verification obligations where applicable\
- important\_adjacent\_systems:\
- Michigan Electronic Insurance Verification System (EIVS)\
- Michigan no-fault / PIP reporting workflows and annual data
submissions\
- Workers' compensation reporting through state portal or approved
electronic workflow\
- SBS and NIPR-enabled licensing workflows\
- compact\_status: member of the Insurance Compact\
- sbs\_status: yes\
- apcd\_status: no broad APCD obligation reflected in this operating
pattern\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Michigan should be treated as one of the next priority
operational-complexity states in a multi-state AI compliance
architecture. On the surface, it follows a largely mainstream filing
pattern because it uses SERFF for standard product submissions and
participates in the Insurance Compact. What makes Michigan materially
more complex is the combination of auto-insurance verification, no-fault
and PIP-related reporting requirements, and a workers' compensation
reporting environment that is less cleanly standardized on mature
national EDI than many states. Michigan therefore cannot be modeled as
just another standard SERFF state. AI must monitor not only filing
evidence, but also policy, claim, and auto-reporting signals that sit
outside the core filing workflow.\
\
For executive decision-making, Michigan should be governed through four
connected control layers: filing discipline, auto-operating-model
discipline, reporting discipline, and exception discipline. Filing
discipline ensures the correct filing path and auditable evidence.
Auto-operating-model discipline ensures the organization can support
Michigan's EIVS and no-fault/PIP reporting obligations. Reporting
discipline ensures recurring state submissions and workers' compensation
activity are current and evidenced. Exception discipline ensures that
bulletins, orders, and implementation guidance override generic
multi-state assumptions when more specific or newer. Michigan is also a
member of the Insurance Compact, so eligible life and annuity products
may follow a compact path where applicable.\
\
\#\# Regulatory Principles\
1. Required Michigan product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. Michigan auto-insurance operations must be treated as a specialized
workflow because no-fault and PIP reporting materially affect compliance
obligations beyond ordinary personal-auto logic.\
3. Electronic insurance-verification obligations must be monitored
continuously with evidence that required policy-status data is current
and complete.\
4. Workers' compensation reporting obligations must be managed according
to the Michigan-specific process even where the state does not follow
the cleanest national EDI pattern.\
5. Michigan bulletins, orders, and implementation guidance must be
treated as binding operating constraints when newer, more specific, or
explicitly directive.\
6. Ambiguity, unusual products, or unresolved state-specific exceptions
must be escalated to compliance or legal review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard Michigan rate, rule, and form filings should
route through SERFF unless a more specific Michigan instruction or
specialized process applies.\
- Compact treatment: Michigan is a member of the Insurance Compact, so
eligible life and annuity products may follow a compact path where
appropriate, subject to product and line applicability.\
- Auto verification: Michigan requires insurer participation in an
electronic insurance-verification model tied to the Secretary of State,
so policy-administration systems must preserve reliable evidence of
active and canceled policy reporting.\
- Auto no-fault / PIP reporting: Michigan no-fault and PIP reporting
obligations create additional recurring state-submission requirements
that should be modeled separately from ordinary product filing
controls.\
- Workers' compensation: Michigan workers' compensation reporting is
operationally important but should be treated as portal-based or
state-process-driven rather than as a clean fully mature national EDI
pattern.\
- APCD or health data reporting: Michigan is not modeled here as a broad
APCD state in this operating pattern, though insurers should still
expect line-specific data submissions when required.\
- Licensing and regulatory workflow pattern: Michigan is an SBS-aligned
state and uses NIPR connectivity, making it a strong example of
standardized licensing integration paired with more complex operating
obligations in auto and claims.\
- Bulletin / directive posture: Michigan bulletins, orders, and
reform-driven guidance are especially important in the no-fault and
personal-auto context and should be treated as first-class AI inputs.\
\
\#\# Core Operating Rules\
- Use SERFF for standard Michigan rate, rule, and form filings unless a
more specific Michigan instruction governs the submission path.\
- Do not treat a Michigan filing as implementation-ready when required
evidence is missing, filing status is unresolved, or product conditions
remain open.\
- Treat personal auto business as a specialized Michigan workflow when
no-fault, PIP, or EIVS obligations are implicated.\
- Maintain current evidence that required Michigan EIVS and related
policy-status reporting obligations are being satisfied.\
- Maintain evidence of timely and complete Michigan no-fault / PIP
reporting and workers' compensation reporting through the required state
processes.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- exception\_flag\
- legal\_review\_flag\
- mi\_eivs\_feed\_status\
- mi\_no\_fault\_reporting\_status\
- mi\_wc\_reporting\_status\
- mi\_sbs\_workflow\_status\
\
\#\# Typical AI Actions\
- Block launch when a required Michigan filing lacks acceptable evidence
or is routed incorrectly.\
- Route personal-auto work to Michigan-specialized workflow handling
when no-fault, PIP, or EIVS signals are present.\
- Flag likely operational noncompliance when Michigan verification,
no-fault reporting, or workers' compensation reporting evidence is
missing, late, incomplete, or in error status.\
- Route licensing or regulatory workflow issues through SBS-aligned
handling when state and process conditions match the standardized
model.\
- Require human review when Michigan bulletins, reform guidance, or
state-specific instructions create ambiguity that the AI cannot resolve
confidently.\
\
\#\# Common Exception Areas\
- Michigan no-fault and PIP reporting obligations can materially change
operating expectations for personal-auto business.\
- Filing treatment may still vary by line, product structure, and
whether the obligation is prior approval, file-and-use, informational,
exempt, or handled through a specialized process.\
- Workers' compensation reporting may vary by obligation and operational
channel rather than fitting a single national EDI template.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, regulations, and newer bulletins or reform
guidance\
- Missing evidence for required filing, EIVS activity, no-fault
reporting, or workers' compensation reporting\
- Any Michigan auto-operating-model issue that cannot be resolved
confidently by rule logic\
\
\#\# Recommended AI Posture\
Use Michigan as the lead state for auto-operating-model complexity after
Texas. If the AI can combine SERFF filing controls, EIVS monitoring,
no-fault/PIP reporting, workers' compensation process controls, and
SBS-aligned workflow logic into one coherent model, it will be much
better prepared for the next wave of operationally demanding states.

**MI\_compliance\_rules.yaml**

state\_code: MI\
state\_name: Michigan\
jurisdiction\_type: state\
regulator:\
  name: Michigan Department of Insurance and Financial Services\
  category: insurance\_regulator\
last\_reviewed: 2026-06-08\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primary\_filing\_platform: SERFF\
  secondary\_platform: Michigan-specific auto and no-fault reporting
workflows\
  compact\_status: member\
  sbs\_status: yes\
  apcd\_status: no\
\
principles:\
  - id: MI-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: MI-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: MI-P-003\
    text: Treat Michigan auto-insurance operations as specialized
workflows where no-fault, PIP, or verification obligations apply.\
  - id: MI-P-004\
    text: Monitor Michigan recurring auto, workers compensation, and
related state reporting obligations continuously.\
  - id: MI-P-005\
    text: Treat Michigan bulletins, orders, and implementation guidance
as enforceable operating constraints when newer or more specific.\
  - id: MI-P-006\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: bulletin\_reference\
    type: string\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
  - name: mi\_eivs\_feed\_status\
    type: enum\
    values: \[active, pending, error, unknown\]\
  - name: mi\_no\_fault\_reporting\_status\
    type: enum\
    values: \[not\_applicable, pending, submitted, accepted, late,
incomplete, error, unknown\]\
  - name: mi\_wc\_reporting\_status\
    type: enum\
    values: \[not\_applicable, submitted, acknowledged, pending, late,
incomplete, error, unknown\]\
  - name: mi\_sbs\_workflow\_status\
    type: enum\
    values: \[active, pending, complete, error, unknown\]\
\
rules:\
  - id: MI-FILING-001\
    category: filing\_channel\
    description: Standard Michigan product filings should use SERFF
unless a more specific Michigan instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MI\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: SERFF\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: MI-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
Michigan filing evidence is missing or unresolved.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MI\
        - field: filing\_receipt\_id\
          operator: is\_missing\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
escalate\_compliance\]\
\
  - id: MI-AUTO-001\
    category: auto\_verification\
    description: Michigan personal auto operations must maintain
evidence of compliant EIVS reporting capability.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MI\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
    then:\
      require:\
        evidence\_fields: \[mi\_eivs\_feed\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: MI-AUTO-002\
    category: no\_fault\_reporting\
    description: Michigan no-fault and PIP reporting obligations must
have current evidence of submission and acceptable status for applicable
personal auto business.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MI\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
    then:\
      require:\
        evidence\_fields: \[mi\_no\_fault\_reporting\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, require\_named\_owner\]\
\
  - id: MI-AUTO-003\
    category: auto\_reporting\_status\_control\
    description: Pending, late, incomplete, error, or unknown Michigan
auto-verification or no-fault reporting status requires remediation and
escalation.\
    if:\
      any:\
        - field: mi\_eivs\_feed\_status\
          operator: in\
          value: \[pending, error, unknown\]\
        - field: mi\_no\_fault\_reporting\_status\
          operator: in\
          value: \[pending, late, incomplete, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: MI-WC-001\
    category: workers\_compensation\_reporting\
    description: Michigan workers compensation reporting obligations
must have current evidence of completion through the required state
process.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MI\
        - field: line\_of\_business\
          operator: equals\
          value: workers\_compensation\
    then:\
      require:\
        evidence\_fields: \[mi\_wc\_reporting\_status\]\
      actions\_if\_missing: \[escalate\_claims\_compliance,
open\_remediation\_ticket, require\_manual\_review\]\
\
  - id: MI-SBS-001\
    category: licensing\_and\_workflow\_integration\
    description: Michigan SBS-aligned workflows should have current
evidence of completion or active processing where licensing or
regulatory workflow integration applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MI\
    then:\
      require:\
        evidence\_fields: \[mi\_sbs\_workflow\_status\]\
      actions\_if\_missing: \[open\_remediation\_ticket,
notify\_business\_owner, escalate\_compliance\]\
\
  - id: MI-BULLETIN-001\
    category: bulletin\_exception\_management\
    description: Michigan bulletins, orders, and implementation guidance
override generic operating assumptions when newer or more specific.\
    if:\
      any:\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close\]\
\
  - id: MI-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard Michigan
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - conflicting\_state\_guidance\
  - unresolved\_no\_fault\_or\_pip\_condition\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_eivs\_failure\
  - unresolved\_workers\_comp\_reporting\_gap\
  - unresolved\_sbs\_workflow\_failure

**CT\_compliance\_profile.md**

\# State Compliance Profile: Connecticut\
\
\#\# Metadata\
- state\_code: CT\
- state\_name: Connecticut\
- regulator\_name: Connecticut Insurance Department\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, rate and form review, auto verification, health data
reporting, regulatory bulletins, licensing, and selected data calls\
- primary\_filing\_platforms:\
- SERFF\
- Connecticut-specific reporting channels for APCD and
uninsured-motorist verification obligations where applicable\
- important\_adjacent\_systems:\
- Connecticut Uninsured Motorist Identification Database (UMID) /
policy-data submission workflow\
- Connecticut all-payer claims database reporting ecosystem for
applicable health carriers\
- Workers' compensation reporting through commission-led electronic or
mixed submission processes\
- SBS and NIPR-enabled licensing workflows\
- compact\_status: member of the Insurance Compact\
- sbs\_status: yes\
- apcd\_status: yes\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Connecticut should be treated as a next-wave operational-complexity
state in a multi-state AI compliance architecture because it combines a
clean mainstream filing path with multiple recurring operational
obligations that sit outside ordinary product filing. Connecticut uses
SERFF for standard insurance filings and participates in the Insurance
Compact, which makes it look structurally simple. But the state also
requires insurer participation in an uninsured-motorist identification
database, imposes all-payer claims database reporting on applicable
health carriers, and operates a workers' compensation reporting model
that is less cleanly standardized on mature national EDI than some
neighboring states. Connecticut therefore cannot be modeled as just
another standard SERFF state. AI must monitor filing evidence,
policy-status reporting, health-data submissions, and mixed workers'
compensation reporting signals together.\
\
For executive decision-making, Connecticut should be governed through
four connected control layers: filing discipline, auto-verification
discipline, health-data discipline, and exception discipline. Filing
discipline ensures the correct filing path and auditable evidence.
Auto-verification discipline ensures the organization can support
Connecticut's uninsured-motorist policy-data reporting requirements.
Health-data discipline ensures APCD and other recurring health
submissions are current, complete, and evidenced. Exception discipline
ensures that bulletins, notices, and state instructions override generic
multi-state assumptions when more specific or newer. Connecticut is also
a member of the Insurance Compact, so eligible life and annuity products
may follow a compact path where applicable.\
\
\#\# Regulatory Principles\
1. Required Connecticut product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. Connecticut auto-insurance operations must be treated as a
specialized workflow where uninsured-motorist database reporting
obligations apply.\
3. Applicable Connecticut APCD and related health-data submissions must
be monitored continuously with evidence of transmission, completeness,
and remediation when needed.\
4. Workers' compensation reporting obligations must be managed according
to Connecticut-specific commission processes even where the state does
not follow the cleanest national EDI pattern.\
5. Connecticut bulletins, notices, and implementation guidance must be
treated as binding operating constraints when newer, more specific, or
explicitly directive.\
6. Ambiguity, unusual products, or unresolved state-specific exceptions
must be escalated to compliance or legal review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard Connecticut rate, rule, and form filings should
route through SERFF unless a more specific Connecticut instruction or
specialized process applies.\
- Compact treatment: Connecticut is a member of the Insurance Compact,
so eligible life and annuity products may follow a compact path where
appropriate, subject to product and line applicability.\
- Auto verification: Connecticut requires insurer participation in an
uninsured-motorist identification database or equivalent policy-data
submission model, so policy-administration systems must preserve
reliable evidence of active and canceled policy reporting.\
- APCD or health data reporting: Connecticut has material APCD and
related health-data submission obligations for applicable carriers,
making health-claims extraction and data-quality controls especially
important.\
- Workers' compensation: Connecticut workers' compensation reporting is
operationally important but should be treated as mixed, commission-led,
or partially electronic rather than as a clean fully mature national EDI
pattern.\
- Licensing and regulatory workflow pattern: Connecticut is an
SBS-aligned state and uses NIPR connectivity, making it a strong example
of standardized licensing integration paired with more complex operating
obligations in auto and health data.\
- Bulletin / directive posture: Connecticut bulletins, notices, and
guidance are especially important in health-data and auto-reporting
contexts and should be treated as first-class AI inputs.\
\
\#\# Core Operating Rules\
- Use SERFF for standard Connecticut rate, rule, and form filings unless
a more specific Connecticut instruction governs the submission path.\
- Do not treat a Connecticut filing as implementation-ready when
required evidence is missing, filing status is unresolved, or product
conditions remain open.\
- Treat personal auto business as a specialized Connecticut workflow
when uninsured-motorist database or policy-status reporting obligations
are implicated.\
- Maintain current evidence that required Connecticut UMID and related
policy-status reporting obligations are being satisfied.\
- Maintain evidence of timely and complete Connecticut APCD submissions
and workers' compensation reporting through the required state
processes.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- exception\_flag\
- legal\_review\_flag\
- ct\_umid\_feed\_status\
- ct\_apcd\_submission\_status\
- ct\_wc\_reporting\_status\
- ct\_sbs\_workflow\_status\
\
\#\# Typical AI Actions\
- Block launch when a required Connecticut filing lacks acceptable
evidence or is routed incorrectly.\
- Route personal-auto work to Connecticut-specialized workflow handling
when uninsured-motorist database signals are present.\
- Flag likely operational noncompliance when Connecticut UMID, APCD, or
workers' compensation reporting evidence is missing, late, incomplete,
or in error status.\
- Route licensing or regulatory workflow issues through SBS-aligned
handling when state and process conditions match the standardized
model.\
- Require human review when Connecticut bulletins, health-data guidance,
or state-specific instructions create ambiguity that the AI cannot
resolve confidently.\
\
\#\# Common Exception Areas\
- Connecticut APCD obligations can materially change operating
expectations for health carriers and related claims-data workflows.\
- Filing treatment may still vary by line, product structure, and
whether the obligation is prior approval, file-and-use, informational,
exempt, or handled through a specialized process.\
- Workers' compensation reporting may vary by obligation and operational
channel rather than fitting a single national EDI template.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, regulations, and newer bulletins or
guidance\
- Missing evidence for required filing, UMID activity, APCD submission,
or workers' compensation reporting\
- Any Connecticut auto- or health-data-operating-model issue that cannot
be resolved confidently by rule logic\
\
\#\# Recommended AI Posture\
Use Connecticut as the lead state for combined auto-verification and
APCD complexity. If the AI can combine SERFF filing controls, UMID
monitoring, APCD submissions, mixed workers' compensation process
controls, and SBS-aligned workflow logic into one coherent model, it
will be much better prepared for the next wave of operationally
demanding states.

**CT\_compliance\_rules.yaml**

state\_code: CT\
state\_name: Connecticut\
jurisdiction\_type: state\
regulator:\
  name: Connecticut Insurance Department\
  category: insurance\_regulator\
last\_reviewed: 2026-06-08\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primary\_filing\_platform: SERFF\
  secondary\_platform: Connecticut-specific auto and APCD reporting
workflows\
  compact\_status: member\
  sbs\_status: yes\
  apcd\_status: yes\
\
principles:\
  - id: CT-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: CT-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: CT-P-003\
    text: Treat Connecticut auto-insurance operations as specialized
workflows where uninsured-motorist database obligations apply.\
  - id: CT-P-004\
    text: Monitor Connecticut recurring APCD, workers compensation, and
related state reporting obligations continuously.\
  - id: CT-P-005\
    text: Treat Connecticut bulletins, notices, and implementation
guidance as enforceable operating constraints when newer or more
specific.\
  - id: CT-P-006\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: bulletin\_reference\
    type: string\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
  - name: ct\_umid\_feed\_status\
    type: enum\
    values: \[active, pending, error, unknown\]\
  - name: ct\_apcd\_submission\_status\
    type: enum\
    values: \[not\_applicable, pending, submitted, accepted, late,
incomplete, error, unknown\]\
  - name: ct\_wc\_reporting\_status\
    type: enum\
    values: \[not\_applicable, submitted, acknowledged, pending, late,
incomplete, error, unknown\]\
  - name: ct\_sbs\_workflow\_status\
    type: enum\
    values: \[active, pending, complete, error, unknown\]\
\
rules:\
  - id: CT-FILING-001\
    category: filing\_channel\
    description: Standard Connecticut product filings should use SERFF
unless a more specific Connecticut instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CT\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: SERFF\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: CT-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
Connecticut filing evidence is missing or unresolved.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CT\
        - field: filing\_receipt\_id\
          operator: is\_missing\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
escalate\_compliance\]\
\
  - id: CT-AUTO-001\
    category: auto\_verification\
    description: Connecticut personal auto operations must maintain
evidence of compliant UMID policy-data reporting capability.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CT\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
    then:\
      require:\
        evidence\_fields: \[ct\_umid\_feed\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: CT-AUTO-002\
    category: auto\_reporting\_status\_control\
    description: Pending, error, or unknown Connecticut UMID status
requires remediation and escalation.\
    if:\
      all:\
        - field: ct\_umid\_feed\_status\
          operator: in\
          value: \[pending, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: CT-APCD-001\
    category: health\_data\_reporting\
    description: Applicable Connecticut APCD and related health-data
submissions must have current evidence of transmission and acceptable
status.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CT\
        - field: line\_of\_business\
          operator: in\
          value: \[health, accident\_and\_health, dental, vision\]\
    then:\
      require:\
        evidence\_fields: \[ct\_apcd\_submission\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: CT-APCD-002\
    category: health\_data\_status\_control\
    description: Pending, late, incomplete, error, or unknown
Connecticut APCD submission status requires escalation and named
remediation ownership.\
    if:\
      all:\
        - field: ct\_apcd\_submission\_status\
          operator: in\
          value: \[pending, late, incomplete, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: CT-WC-001\
    category: workers\_compensation\_reporting\
    description: Connecticut workers compensation reporting obligations
must have current evidence of completion through the required commission
process.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CT\
        - field: line\_of\_business\
          operator: equals\
          value: workers\_compensation\
    then:\
      require:\
        evidence\_fields: \[ct\_wc\_reporting\_status\]\
      actions\_if\_missing: \[escalate\_claims\_compliance,
open\_remediation\_ticket, require\_manual\_review\]\
\
  - id: CT-SBS-001\
    category: licensing\_and\_workflow\_integration\
    description: Connecticut SBS-aligned workflows should have current
evidence of completion or active processing where licensing or
regulatory workflow integration applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: CT\
    then:\
      require:\
        evidence\_fields: \[ct\_sbs\_workflow\_status\]\
      actions\_if\_missing: \[open\_remediation\_ticket,
notify\_business\_owner, escalate\_compliance\]\
\
  - id: CT-BULLETIN-001\
    category: bulletin\_exception\_management\
    description: Connecticut bulletins, notices, and implementation
guidance override generic operating assumptions when newer or more
specific.\
    if:\
      any:\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close\]\
\
  - id: CT-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard Connecticut
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - conflicting\_state\_guidance\
  - unresolved\_umid\_condition\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_apcd\_submission\_gap\
  - unresolved\_workers\_comp\_reporting\_gap\
  - unresolved\_sbs\_workflow\_failure

**MD\_compliance\_profile.md**

\# State Compliance Profile: Maryland\
\
\#\# Metadata\
- state\_code: MD\
- state\_name: Maryland\
- regulator\_name: Maryland Insurance Administration\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, rate and form review, auto insurance notification, health
data reporting, regulatory bulletins, licensing, and selected data
calls\
- primary\_filing\_platforms:\
- SERFF\
- Maryland-specific reporting channels for APCD and motor vehicle
notification obligations where applicable\
- important\_adjacent\_systems:\
- Maryland Automated Compulsory Auto Insurance System (ACAIS) / MVA
policy-notification workflow\
- Maryland all-payer claims database reporting ecosystem for applicable
health carriers\
- Workers' compensation reporting through commission-led electronic or
mixed submission processes\
- SBS and NIPR-enabled licensing workflows\
- compact\_status: member of the Insurance Compact\
- sbs\_status: yes\
- apcd\_status: yes\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Maryland should be treated as a next-wave operational-complexity state
in a multi-state AI compliance architecture because it combines a clean
mainstream filing path with recurring operational obligations that
extend well beyond ordinary product filing. Maryland uses SERFF for
standard insurance filings and participates in the Insurance Compact,
which makes it look structurally simple. But the state also requires
insurer participation in an automated compulsory auto insurance
notification model tied to the Motor Vehicle Administration, imposes
all-payer claims database reporting on applicable health carriers, and
maintains a workers' compensation reporting pattern that is mixed or
only partially electronic compared with mature EDI states. Maryland
therefore should not be modeled as just another standard SERFF state. AI
must monitor filing evidence, policy-notification status, health-data
submissions, and workers' compensation reporting signals together.\
\
For executive decision-making, Maryland should be governed through four
connected control layers: filing discipline, auto-notification
discipline, health-data discipline, and exception discipline. Filing
discipline ensures the correct filing path and auditable evidence.
Auto-notification discipline ensures the organization can support
Maryland's MVA-facing policy issuance and cancellation notification
duties. Health-data discipline ensures APCD and other recurring health
submissions are current, complete, and evidenced. Exception discipline
ensures that bulletins, notices, and state instructions override generic
multi-state assumptions when more specific or newer. Maryland is also a
member of the Insurance Compact, so eligible life and annuity products
may follow a compact path where applicable.\
\
\#\# Regulatory Principles\
1. Required Maryland product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. Maryland auto-insurance operations must be treated as a specialized
workflow where MVA notification obligations apply.\
3. Applicable Maryland APCD and related health-data submissions must be
monitored continuously with evidence of transmission, completeness, and
remediation when needed.\
4. Workers' compensation reporting obligations must be managed according
to Maryland-specific commission processes even where the state does not
follow the cleanest national EDI pattern.\
5. Maryland bulletins, notices, and implementation guidance must be
treated as binding operating constraints when newer, more specific, or
explicitly directive.\
6. Ambiguity, unusual products, or unresolved state-specific exceptions
must be escalated to compliance or legal review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard Maryland rate, rule, and form filings should
route through SERFF unless a more specific Maryland instruction or
specialized process applies.\
- Compact treatment: Maryland is a member of the Insurance Compact, so
eligible life and annuity products may follow a compact path where
appropriate, subject to product and line applicability.\
- Auto verification / notification: Maryland requires insurer
participation in an automated compulsory auto insurance notification
model tied to the Motor Vehicle Administration, so policy-administration
systems must preserve reliable evidence of active-policy reporting and
cancellation notification.\
- APCD or health data reporting: Maryland has material APCD and related
health-data submission obligations for applicable carriers, making
health-claims extraction and data-quality controls especially
important.\
- Workers' compensation: Maryland workers' compensation reporting is
operationally important but should be treated as mixed, commission-led,
or partially electronic rather than as a clean fully mature national EDI
pattern.\
- Licensing and regulatory workflow pattern: Maryland is an SBS-aligned
state and uses NIPR connectivity, making it a strong example of
standardized licensing integration paired with more complex operating
obligations in auto and health data.\
- Bulletin / directive posture: Maryland bulletins, notices, and
guidance are especially important in health-data and auto-notification
contexts and should be treated as first-class AI inputs.\
\
\#\# Core Operating Rules\
- Use SERFF for standard Maryland rate, rule, and form filings unless a
more specific Maryland instruction governs the submission path.\
- Do not treat a Maryland filing as implementation-ready when required
evidence is missing, filing status is unresolved, or product conditions
remain open.\
- Treat personal auto business as a specialized Maryland workflow when
MVA notification or policy-status reporting obligations are implicated.\
- Maintain current evidence that required Maryland ACAIS and related
policy-notification obligations are being satisfied.\
- Maintain evidence of timely and complete Maryland APCD submissions and
workers' compensation reporting through the required state processes.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- exception\_flag\
- legal\_review\_flag\
- md\_acais\_notification\_status\
- md\_apcd\_submission\_status\
- md\_wc\_reporting\_status\
- md\_sbs\_workflow\_status\
\
\#\# Typical AI Actions\
- Block launch when a required Maryland filing lacks acceptable evidence
or is routed incorrectly.\
- Route personal-auto work to Maryland-specialized workflow handling
when MVA notification signals are present.\
- Flag likely operational noncompliance when Maryland ACAIS, APCD, or
workers' compensation reporting evidence is missing, late, incomplete,
or in error status.\
- Route licensing or regulatory workflow issues through SBS-aligned
handling when state and process conditions match the standardized
model.\
- Require human review when Maryland bulletins, health-data guidance, or
state-specific instructions create ambiguity that the AI cannot resolve
confidently.\
\
\#\# Common Exception Areas\
- Maryland APCD obligations can materially change operating expectations
for health carriers and related claims-data workflows.\
- Filing treatment may still vary by line, product structure, and
whether the obligation is prior approval, file-and-use, informational,
exempt, or handled through a specialized process.\
- Workers' compensation reporting may vary by obligation and operational
channel rather than fitting a single national EDI template.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, regulations, and newer bulletins or
guidance\
- Missing evidence for required filing, ACAIS activity, APCD submission,
or workers' compensation reporting\
- Any Maryland auto- or health-data-operating-model issue that cannot be
resolved confidently by rule logic\
\
\#\# Recommended AI Posture\
Use Maryland as the lead state for combined auto-notification and APCD
complexity with a neighboring East Coast operating pattern. If the AI
can combine SERFF filing controls, ACAIS monitoring, APCD submissions,
mixed workers' compensation process controls, and SBS-aligned workflow
logic into one coherent model, it will be much better prepared for the
next wave of operationally demanding states.

**MD\_compliance\_rules.yaml**

state\_code: MD\
state\_name: Maryland\
jurisdiction\_type: state\
regulator:\
  name: Maryland Insurance Administration\
  category: insurance\_regulator\
last\_reviewed: 2026-06-08\
intended\_use: ai\_compliance\_controls\
disclaimer: Operational compliance aid only; not legal advice.\
\
metadata:\
  primary\_filing\_platform: SERFF\
  secondary\_platform: Maryland-specific auto and APCD reporting
workflows\
  compact\_status: member\
  sbs\_status: yes\
  apcd\_status: yes\
\
principles:\
  - id: MD-P-001\
    text: Use approved regulatory channels for required product
submissions.\
  - id: MD-P-002\
    text: Preserve auditable evidence for all filing and reporting
obligations.\
  - id: MD-P-003\
    text: Treat Maryland auto-insurance operations as specialized
workflows where motor-vehicle notification obligations apply.\
  - id: MD-P-004\
    text: Monitor Maryland recurring APCD, workers compensation, and
related state reporting obligations continuously.\
  - id: MD-P-005\
    text: Treat Maryland bulletins, notices, and implementation guidance
as enforceable operating constraints when newer or more specific.\
  - id: MD-P-006\
    text: Escalate ambiguity, exceptions, and non-standard cases for
human review.\
\
signals:\
  - name: state\
    type: string\
  - name: line\_of\_business\
    type: string\
  - name: filing\_type\
    type: string\
  - name: filing\_channel\
    type: string\
  - name: filing\_receipt\_id\
    type: string\
  - name: filing\_status\
    type: enum\
    values: \[draft, submitted, accepted, objection, approved, closed,
rejected, withdrawn\]\
  - name: filing\_submission\_date\
    type: date\
  - name: product\_effective\_date\
    type: date\
  - name: bulletin\_reference\
    type: string\
  - name: exception\_flag\
    type: boolean\
  - name: legal\_review\_flag\
    type: boolean\
  - name: md\_acais\_notification\_status\
    type: enum\
    values: \[active, pending, error, unknown\]\
  - name: md\_apcd\_submission\_status\
    type: enum\
    values: \[not\_applicable, pending, submitted, accepted, late,
incomplete, error, unknown\]\
  - name: md\_wc\_reporting\_status\
    type: enum\
    values: \[not\_applicable, submitted, acknowledged, pending, late,
incomplete, error, unknown\]\
  - name: md\_sbs\_workflow\_status\
    type: enum\
    values: \[active, pending, complete, error, unknown\]\
\
rules:\
  - id: MD-FILING-001\
    category: filing\_channel\
    description: Standard Maryland product filings should use SERFF
unless a more specific Maryland instruction applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MD\
        - field: filing\_type\
          operator: in\
          value: \[new\_product, product\_change, rate\_change,
form\_change, rule\_change\]\
    then:\
      require:\
        filing\_channel: SERFF\
        evidence\_fields: \[filing\_receipt\_id, filing\_status,
filing\_submission\_date\]\
      actions\_if\_missing: \[block\_release,
route\_to\_regulatory\_filing, escalate\_compliance\]\
\
  - id: MD-FILING-002\
    category: filing\_status\_control\
    description: Product implementation should not proceed when required
Maryland filing evidence is missing or unresolved.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MD\
        - field: filing\_receipt\_id\
          operator: is\_missing\
    then:\
      actions\_if\_true: \[block\_release, request\_missing\_evidence,
escalate\_compliance\]\
\
  - id: MD-AUTO-001\
    category: auto\_notification\
    description: Maryland personal auto operations must maintain
evidence of compliant ACAIS or MVA-facing policy-notification
capability.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MD\
        - field: line\_of\_business\
          operator: equals\
          value: personal\_auto\
    then:\
      require:\
        evidence\_fields: \[md\_acais\_notification\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: MD-AUTO-002\
    category: auto\_notification\_status\_control\
    description: Pending, error, or unknown Maryland ACAIS status
requires remediation and escalation.\
    if:\
      all:\
        - field: md\_acais\_notification\_status\
          operator: in\
          value: \[pending, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: MD-APCD-001\
    category: health\_data\_reporting\
    description: Applicable Maryland APCD and related health-data
submissions must have current evidence of transmission and acceptable
status.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MD\
        - field: line\_of\_business\
          operator: in\
          value: \[health, accident\_and\_health, dental, vision\]\
    then:\
      require:\
        evidence\_fields: \[md\_apcd\_submission\_status\]\
      actions\_if\_missing: \[flag\_operational\_noncompliance,
open\_remediation\_ticket, escalate\_compliance\]\
\
  - id: MD-APCD-002\
    category: health\_data\_status\_control\
    description: Pending, late, incomplete, error, or unknown Maryland
APCD submission status requires escalation and named remediation
ownership.\
    if:\
      all:\
        - field: md\_apcd\_submission\_status\
          operator: in\
          value: \[pending, late, incomplete, error, unknown\]\
    then:\
      actions\_if\_true: \[open\_remediation\_ticket,
require\_named\_owner, escalate\_compliance\]\
\
  - id: MD-WC-001\
    category: workers\_compensation\_reporting\
    description: Maryland workers compensation reporting obligations
must have current evidence of completion through the required commission
process.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MD\
        - field: line\_of\_business\
          operator: equals\
          value: workers\_compensation\
    then:\
      require:\
        evidence\_fields: \[md\_wc\_reporting\_status\]\
      actions\_if\_missing: \[escalate\_claims\_compliance,
open\_remediation\_ticket, require\_manual\_review\]\
\
  - id: MD-SBS-001\
    category: licensing\_and\_workflow\_integration\
    description: Maryland SBS-aligned workflows should have current
evidence of completion or active processing where licensing or
regulatory workflow integration applies.\
    if:\
      all:\
        - field: state\
          operator: equals\
          value: MD\
    then:\
      require:\
        evidence\_fields: \[md\_sbs\_workflow\_status\]\
      actions\_if\_missing: \[open\_remediation\_ticket,
notify\_business\_owner, escalate\_compliance\]\
\
  - id: MD-BULLETIN-001\
    category: bulletin\_exception\_management\
    description: Maryland bulletins, notices, and implementation
guidance override generic operating assumptions when newer or more
specific.\
    if:\
      any:\
        - field: bulletin\_reference\
          operator: is\_present\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_human\_review,
attach\_state\_guidance, prevent\_auto\_close\]\
\
  - id: MD-LEGAL-001\
    category: legal\_review\
    description: Uncertainty, ambiguity, or non-standard Maryland
conditions require legal or regulatory review before implementation.\
    if:\
      any:\
        - field: legal\_review\_flag\
          operator: equals\
          value: true\
        - field: exception\_flag\
          operator: equals\
          value: true\
    then:\
      actions\_if\_true: \[route\_to\_legal\_review,
block\_automation\_only\_decision, require\_named\_owner\]\
\
default\_actions:\
  - preserve\_audit\_trail\
  - log\_rule\_evaluation\
  - record\_decision\_owner\
\
human\_review\_triggers:\
  - ambiguous\_filing\_obligation\
  - unusual\_product\_structure\
  - conflicting\_state\_guidance\
  - unresolved\_acais\_condition\
  - missing\_evidence\_for\_required\_submission\
  - unresolved\_apcd\_submission\_gap\
  - unresolved\_workers\_comp\_reporting\_gap\
  - unresolved\_sbs\_workflow\_failure

**CO\_compliance\_profile.md**

\# State Compliance Profile: Colorado\
\
\#\# Metadata\
- state\_code: CO\
- state\_name: Colorado\
- regulator\_name: Colorado Division of Insurance\
- regulator\_type: state insurance regulator\
- primary\_regulatory\_scope: insurance product filings, market
oversight, rate and form review, auto-verification reporting, APCD and
health-data reporting, regulatory bulletins, licensing, and selected
data calls\
- primary\_filing\_platforms:\
- SERFF\
- Colorado-specific reporting channels for APCD and vehicle insurance
reporting where applicable\
- important\_adjacent\_systems:\
- Colorado DMV vehicle insurance reporting workflow\
- Colorado all-payer claims database reporting ecosystem for applicable
health carriers\
- Colorado Division of Workers' Compensation EDI environment\
- SBS and NIPR-enabled licensing workflows\
- compact\_status: member of the Insurance Compact\
- sbs\_status: yes\
- apcd\_status: yes\
- last\_reviewed: 2026-06-08\
- intended\_use: AI-assisted compliance guidance and workflow
orchestration\
- disclaimer: This file is an operational compliance aid and not legal
advice.\
\
\#\# Executive Summary\
Colorado should be treated as one of the strongest next-wave baseline
states in a multi-state AI compliance architecture because it combines a
clean mainstream filing path with several recurring operational
obligations that materially affect compliance execution. Colorado uses
SERFF for standard insurance filings, participates in the Insurance
Compact, and is deeply aligned to NAIC operating patterns through SBS.
At the same time, the state requires insurer participation in
motor-vehicle insurance reporting, imposes all-payer claims database
reporting on applicable health carriers, and maintains a mature workers'
compensation EDI model. Colorado is therefore an important proving
ground for an AI architecture that must handle both the clean national
template and meaningful operational complexity without relying on heavy
exception logic.\
\
For executive decision-making, Colorado should be governed through four
connected control layers: filing discipline, auto-reporting discipline,
health-data discipline, and operational reporting discipline. Filing
discipline ensures the correct filing path and auditable evidence.
Auto-reporting discipline ensures the organization can satisfy Colorado
DMV-facing vehicle insurance reporting duties. Health-data discipline
ensures APCD and related recurring health submissions are current,
complete, and evidenced. Operational reporting discipline ensures
workers' compensation EDI and other recurring state reporting remain
healthy and current. Colorado is also a member of the Insurance Compact,
so eligible life and annuity products may follow a compact path where
applicable.\
\
\#\# Regulatory Principles\
1. Required Colorado product filings must use the approved filing
channel with complete and auditable evidence of submission and status.\
2. Colorado auto-insurance operations must be treated as a specialized
workflow where DMV-facing vehicle insurance reporting obligations
apply.\
3. Applicable Colorado APCD and related health-data submissions must be
monitored continuously with evidence of transmission, completeness, and
remediation when needed.\
4. Colorado workers' compensation reporting obligations must be
monitored continuously with evidence of transmission, acknowledgment,
and issue remediation where applicable.\
5. Colorado bulletins, notices, and implementation guidance must be
treated as binding operating constraints when newer, more specific, or
explicitly directive.\
6. Ambiguity, unusual products, or unresolved state-specific exceptions
must be escalated to compliance or legal review before implementation.\
\
\#\# State-Specific Operating Model\
- Filing path: Standard Colorado rate, rule, and form filings should
route through SERFF unless a more specific Colorado instruction or
specialized process applies.\
- Compact treatment: Colorado is a member of the Insurance Compact, so
eligible life and annuity products may follow a compact path where
appropriate, subject to product and line applicability.\
- Auto verification / reporting: Colorado requires insurer participation
in a vehicle-insurance reporting workflow tied to DMV or authorized
vendor processes, so policy-administration systems must preserve
reliable evidence of active-policy and cancellation reporting.\
- APCD or health data reporting: Colorado has material APCD and related
health-data submission obligations for applicable carriers, making
health-claims extraction and data-quality controls especially
important.\
- Workers' compensation: Colorado workers' compensation reporting
follows a mature EDI operating model through the Division of Workers'
Compensation and should be treated as a continuously monitored
operational obligation.\
- Licensing and regulatory workflow pattern: Colorado is an SBS-aligned
state and uses NIPR connectivity, making it a strong example of
standardized licensing integration paired with recurring operational
reporting obligations.\
- Bulletin / directive posture: Colorado bulletins, notices, and
implementation guidance are important in health-data, filing, and
operational reporting contexts, but the overall state pattern is cleaner
and more repeatable than many exception states.\
\
\#\# Core Operating Rules\
- Use SERFF for standard Colorado rate, rule, and form filings unless a
more specific Colorado instruction governs the submission path.\
- Do not treat a Colorado filing as implementation-ready when required
evidence is missing, filing status is unresolved, or product conditions
remain open.\
- Treat personal auto business as a specialized Colorado workflow when
DMV-facing policy reporting obligations are implicated.\
- Maintain current evidence that required Colorado vehicle-insurance
reporting obligations are being satisfied.\
- Maintain evidence of timely and complete Colorado APCD submissions and
workers' compensation EDI reporting through the required state
processes.\
\
\#\# Key Signals AI Should Monitor\
- state\
- line\_of\_business\
- filing\_type\
- filing\_channel\
- filing\_receipt\_id\
- filing\_status\
- filing\_submission\_date\
- product\_effective\_date\
- bulletin\_reference\
- exception\_flag\
- legal\_review\_flag\
- co\_vehicle\_insurance\_reporting\_status\
- co\_apcd\_submission\_status\
- co\_wc\_edi\_acknowledgment\
- co\_sbs\_workflow\_status\
\
\#\# Typical AI Actions\
- Block launch when a required Colorado filing lacks acceptable evidence
or is routed incorrectly.\
- Route personal-auto work to Colorado-specialized workflow handling
when vehicle-insurance reporting signals are present.\
- Flag likely operational noncompliance when Colorado vehicle reporting,
APCD, or workers' compensation EDI evidence is missing, late,
incomplete, or in error status.\
- Route licensing or regulatory workflow issues through SBS-aligned
handling when state and process conditions match the standardized
model.\
- Require human review when Colorado bulletins, health-data guidance, or
state-specific instructions create ambiguity that the AI cannot resolve
confidently.\
\
\#\# Common Exception Areas\
- Colorado APCD obligations can materially change operating expectations
for health carriers and related claims-data workflows.\
- Filing treatment may still vary by line, product structure, and
whether the obligation is prior approval, file-and-use, informational,
exempt, or handled through a specialized process.\
- Vehicle-insurance reporting and workers' compensation reporting
operate through adjacent state processes rather than ordinary product
filing logic.\
\
\#\# Human Review Required\
- Novel or unusual products\
- Ambiguous filing applicability\
- Conflicts between statutes, regulations, and newer bulletins or
guidance\
- Missing evidence for required filing, vehicle-insurance reporting,
APCD submission, or workers' compensation reporting\
- Any Colorado auto- or health-data-operating-model issue that cannot be
resolved confidently by rule logic\
\
\#\# Recommended AI Posture\
Use Colorado as the clean western baseline state with meaningful
operational reporting complexity. If the AI can combine SERFF filing
controls, DMV-facing vehicle reporting, APCD submissions, workers'
compensation EDI, and SBS-aligned workflow logic into one coherent
model, it will be much better prepared to scale across the broader set
of standardized yet operationally demanding states.

**CO\_compliance\_rules.yaml**

**Hawaii**

**Regulator:** **Hawaii Insurance Division** (Dept. of Commerce and
Consumer Affairs) -- Official website:
[**https://cca.hawaii.gov/ins**](https://cca.hawaii.gov/ins).

**Statutes & Regulations:** Hawaii's **Insurance Code** is in **Hawaii
Revised Statutes (HRS) Chapter 431** (and related chapters 432, 432D for
HMOs, etc.). **Insurance administrative rules** fall under **Hawaii
Administrative Rules (HAR) Title 16, Chapter 171-**. The Insurance
Division's site provides links to **HRS statutes and HAR rules**, and
posts **Insurance Commissioner's Memoranda and Bulletins** relevant to
insurers (for example, guidance on climate risk disclosures, the use of
credit in underwriting, etc.).

**Integration & Electronic Systems:** **Hawaii accepts SERFF** for
filing of insurance forms and rates (all lines of business are supported
via SERFF). Insurers are encouraged (and in practice required for most
lines) to submit filings through **NAIC's SERFF**, which the Division
uses to process approvals. This means insurer systems should be prepared
to generate SERFF-compliant filings, and can integrate using SERFF's web
service for automated transmissions. Hawaii is part of the **Insurance
Compact** for life/annuity products, so those can be filed via the
Compact's SERFF interface.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Hawaii uses **NAIC's national systems** extensively given its relatively
small size: financial filings, RBC, and market conduct data are all
collected via NAIC data calls to which Hawaii subscribes. **Producer
licensing** is done through **NIPR** (Hawaii's division provides links
to NIPR's application and renewal processes).

Hawaii does not have any unique state-run API or real-time integration
with insurers' policy systems outside these national frameworks.
**Workers' compensation** is handled by a separate division (Dept. of
Labor in Hawaii) and does not currently mandate EDI (reports are filed
on forms or via PDF). **Auto insurance verification** in Hawaii is done
post-insurance by requiring insured drivers to carry proof; there isn't
a central database requiring integration as in some states.

**Idaho**

**Regulator:** **Idaho Department of Insurance** -- Official website:
[**https://doi.idaho.gov**](https://doi.idaho.gov/).

**Statutes & Regulations:** **Idaho Insurance Code** is in **Idaho Code
Title 41**. The Department's site offers direct access to **laws and
rules** (with references to Idaho Statutes and **IDAPA Administrative
Rules** for insurance), and an archive of **Bulletins** issued by the
Director (e.g., bulletins addressing new laws, guidelines for rate
filings, or clarifications on compliance issues).

**Integration & Electronic Systems:** **Idaho requires electronic filing
via SERFF** for virtually all form, rate, and rule submissions in most
lines of insurance. SERFF covers P&C, life, health, and other regulated
lines, and the Department uses it to manage filings and approvals.
Insurers can integrate internal product development and compliance
workflow with SERFF to ease multi-state filings. Idaho is a member of
the **Interstate Insurance Product Regulation Compact**, simplifying
multi-state life and annuity filings for insurers through the
SERFF-based Compact process.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Additionally, Idaho leverages **NAIC's central systems**:

-   **Company Licensing**: Accepts **UCAA** digital filings and required
    attachments.

-   **Producer Licensing**: Participates in **NIPR** for agent licensing
    and appointments.

-   **Financial Reporting & Data Calls**: Insurers file statutory
    financial statements and participate in NAIC-run data calls for
    Idaho.

**Claims and Policy Data Integrations:** Idaho's insurance regulator
does not provide distinct system-to-system integration for insurer
claims or policy admin systems beyond standard channels. However, there
are specialized requirements: **Idaho's workers' compensation** is
handled by the **Idaho Industrial Commission**, which expects first and
subsequent reports of injury to be submitted electronically (Idaho
adopted **IAIABC EDI Claims Release 3** standards in 2017, requiring
integration with insurer claims systems for automated reporting). Idaho
also requires insurers to submit **auto insurance data** for vehicle
insurance verification; insurers either upload periodic policy databases
or respond to state queries via a secure service to confirm coverage.
These are not interactive APIs for general use but rather structured
data reporting obligations that require *some integration or automated
data extract capabilities* from insurer systems.

**Illinois**

**Regulator:** **Illinois Department of Insurance (IDOI)** -- Official
website: [**https://idoi.illinois.gov**](https://idoi.illinois.gov/).

**Statutes & Regulations:** Illinois's **Insurance Code** is in **215
ILCS 5** (Illinois Compiled Statutes), and additional related acts
(e.g., 215 ILCS 90 for specific lines like HMOs) apply. The Department's
website provides references to the Illinois Compiled Statutes and
**Illinois Administrative Code (Title 50)** for regulatory rules.
**Company Bulletins** are published on IDOI's site, often as **Company
Bulletins** or **Producer Bulletins** (e.g., addressing topics from
electronic transactions to regulatory compliance deadlines).

**Integration & Electronic Systems:** **Illinois accepts and strongly
encourages SERFF for rate, rule, and form filings**, as part of its
modernized filing process. The state is moving toward requiring **all
commercial filings** to go through SERFF, which means integrators should
ensure their systems can produce SERFF-ready filings. The Department
also participates in NAIC's **SERFF Filing Access** for public viewing
of certain filed documents, adding transparency for market participants.
Illinois is also a **member of the Interstate Compact**, meaning
life/annuity filers can leverage SERFF by using the IIPRC's unified
process for multi-state filings.

Beyond SERFF, **Illinois** uses various technologies to streamline
compliance:

-   **Producer licensing** is managed through **NIPR** (Illinois's
    licensing processes are integrated with NIPR's systems).

-   **Financial filings** and **market conduct data** are submitted via
    NAIC's systems (with which insurer finance/regulatory teams are
    often integrated).

-   **Examinations & Company Licensing**: The state uses the NAIC's
    **Examination Tracking System (ETS)** and **UCAA** processes,
    meaning no separate integration needed beyond those common tools.

**Claims Data & Other Integrations:** **Illinois** has specific
electronic reporting mandates for certain claim events:

-   **Workers' compensation** (administered by the **Illinois Workers'
    Compensation Commission** independently from IDOI) requires
    employers or their insurers to send accident reports to the
    commission for injuries involving more than 3 lost work days --
    historically via paper *Form IC45*, but modernization efforts
    encourage or are transitioning to **electronic submission**.

-   **Auto insurance:** Illinois does not maintain a real-time insurance
    verification system with direct insurer integration as some states
    do; drivers provide proof of insurance or are subject to random
    verification programs (not a continuous data feed from insurer
    systems in the same way as, say, Texas or Georgia).

-   However, IDOI may issue **ad hoc data calls or require electronic
    submission of claims data** for analyses (especially in P&C for
    market conduct; e.g., a data call on auto and property claims
    handling after disasters, usually via spreadsheets or templates
    emailed to the department).

Insurers operating in Illinois should focus on **SERFF integration** for
products and ensure they can handle periodic **electronic data
submissions** (claims or exposure data) in required formats when
requested by the regulator.

**Indiana**

**Regulator:** **Indiana Department of Insurance (IDOI)** -- Official
website: [**https://www.in.gov/idoi**](https://www.in.gov/idoi).

**Statutes & Regulations:** Indiana's **Insurance Code** is in **Title
27 of the Indiana Code**. **Insurance regulations** appear in **760 IAC
(Indiana Administrative Code)**. The IDOI site links to **Insurance Laws
& Regulations** and maintains a list of **Bulletins** (for example,
"Bulletin 263 -- Use of Credit Information" or bulletins on technology
and cybersecurity requirements). Indiana also has **Regulatory Notices
and Orders** that can be found on its site or the state's administrative
record portal.

**Integration & Electronic Systems:** **Indiana uses SERFF** for
virtually all **rate and form filings** -- the Department has integrated
SERFF into its operations for speed-to-market. Insurers must file P&C
and L&H product changes via SERFF and pay associated fees electronically
(Indiana accepts **NAIC EFT** for payment in SERFF). Indiana is a member
of the **NAIC Insurance Compact** for multi-state life/annuity product
filings using the SERFF-based compact system.

**Electronic integration** for other regulatory interactions includes:

-   **Financial & Statistical Filings:** Indiana collects
    annual/quarterly financial statements through the NAIC's data
    repository (which insurer accounting systems produce and send via
    NAIC's specs).

-   **Producer Licensing:** via **NIPR** (Indiana is an **SBS state** as
    of 2021, meaning its licensing, enforcement, and FRA database is on
    NAIC's platform).

-   **Company licensing/corporate changes:** via **UCAA** (the state
    allows or requires companies to apply for certificates of authority
    and corporate amendments electronically through NAIC's UCAA).

**Claims data & others:** Indiana does not have unique state-run claims
integration platforms. **Workers' comp claim reporting** is done via
**EDI** to the Indiana Workers' Compensation Board (which uses IAIABC
EDI Release 3 for FROI/SROI). Some lines, such as **auto insurance**, do
not require continuous data feeds to the regulator or DMV (Indiana uses
periodic verification by insurance ID card enforcement rather than
real-time data exchange). Nonetheless, **providers of motor vehicle
insurances** must be prepared for potential **random verification**
requests electronically.

In summary, Indiana leverages **common NAIC-based systems** for
integration, with SERFF as the key portal for product filings and **no
separate state-specific API for policy or claims integration** beyond
standard EDI and data call processes.

**Iowa**

**Regulator:** **Iowa Insurance Division** (part of the Iowa Department
of Commerce) -- Official website:
[**https://iid.iowa.gov**](https://iid.iowa.gov/).

**Statutes & Regulations:** **Iowa Insurance Code** is found in **Iowa
Code Title XIII (Chapters 505-523I)**. **Administrative rules** are in
**Iowa Administrative Code \[191\]**. The Insurance Division's website
directs users to **Iowa's insurance statutes and regulations**, and
houses **Bulletins** issued by the Commissioner (e.g., bulletins on
topics like usage of consumer credit data or licensing requirements).
Iowa also publishes **Regulatory Plans and Orders** on open dockets.

**Integration & Electronic Systems:** **Iowa mandates electronic
submission of insurance rate and form filings via SERFF** for property &
casualty, life, health, and other applicable lines. The state is known
to strongly support the **SERFF** platform to streamline product
filings. Insurers should have their **policy admin or product lifecycle
platforms integrated** to produce SERFF filing packets for Iowa. The
**IIPRC Insurance Compact** includes Iowa as a member; hence, life
insurance and annuity products can be filed through the interstate
compact SERFF platform covering Iowa.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

The Iowa Insurance Division uses **NAIC's financial and statistical data
reporting** infrastructure -- requiring insurers to file financial
statements and RBC reports via NAIC. **Producer licensing** is handled
through **NIPR** (Iowa is also an **SBS** state -- it adopted NAIC's
State Based Systems for regulatory processes, meaning much of its
licensing, enforcement, and consumer complaint tracking is on that
standardized platform).

On the **claim and policy data integration** front:

-   **Workers' Compensation** claims in Iowa are overseen by Iowa
    Workforce Development (Division of Workers' Compensation), which
    currently uses **EDI for claim reporting** (with an emphasis on
    encouraging EDI but may still accept paper forms in certain
    circumstances). Insurers should plan for integrated EDI processes
    for FROI (first report) and SROI for compliance.

-   **Auto insurance** also has an **insurance verification mandate**;
    Iowa has engaged in efforts to create a system enabling law
    enforcement to verify insurance. Insurers may be required to provide
    policy data through a vendor (the program is often based on the
    model of **sending regular data files** or maintaining a **web
    service** that the state's system can query to confirm coverage).
    This means insurers' policy systems may need to produce **regular
    electronic outputs of active auto policies** (with VIN and coverage
    status) for Iowa's verification program.

**Kansas**

**Regulator:** **Kansas Insurance Department (KID)** -- Official
website:
[**https://insurance.kansas.gov**](https://insurance.kansas.gov/).

**Statutes & Regulations:** Kansas's **Insurance Code** is primarily in
**Chapter 40 of the Kansas Statutes Annotated (K.S.A.)**.
**Regulations** are in the **Kansas Administrative Regulations
(K.A.R.)** under insurance. KID's site provides **links to statutes and
regulations**, in addition to an index of **Bulletins** (by year; often
clarifying legislative changes, e.g., bulletins on cybersecurity
requirements, or procedures for cancelation notices).

**Integration & Electronic Systems:** **Kansas requires insurers to
submit rate and form filings via SERFF** as part of its streamlined
regulatory process. KID was an early adopter of SERFF; all major lines
can be filed using SERFF's product coding (with KID accepting SERFF
filings for all lines except those not subject to regulation such as
certain marine or surplus lines coverage). The Department is integrated
with NAIC's SERFF for internal review, so insurers should incorporate
SERFF into their compliance workflow. Kansas also supports **electronic
fee payments** through NAIC's system (SERFF **EFT** acceptance) for
filing fees. Kansas is a **Compact member** as well, simplifying life
and annuity product filings via the IIPRC SERFF portal.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)
[\[serff.com\]](https://www.serff.com/serff_participation_massachusetts.htm)
[\[serff.com\]](https://www.serff.com/serff_participation_alabama.htm)

**National systems** widely support Kansas's regulatory programs:
**UCAA** is accepted for company licensing and corporate changes,
**NIPR** handles producer licensing (Kansas is also an **SBS** state,
having transitioned to NAIC's State Based Systems platform for
regulatory IT functions).

**Claim & Data Integration:**

-   **Workers' Comp** in Kansas is under the **Kansas Department of
    Labor's Division of Workers Compensation**, which requires
    electronic submission of initial injury reports. Kansas implemented
    the **IAIABC Claims EDI Release 3.1** standard -- insurers must
    register with the state's EDI vendor and integrate their claim
    systems to transmit FROI/SROI data accordingly.

-   **Auto**: Kansas does not maintain a continuous insurance
    verification program requiring insurer integration (drivers are
    required to show proof of insurance upon request).

-   **Other data calls**: Kansas may occasionally require insurers to
    submit data electronically for special inquiries (for example, via
    spreadsheets or a secure portal email to KID). No general real-time
    API integration from insurer policy systems to KID exists; **the
    main integration points are SERFF and NAIC's data portals**.

**Kentucky**

**Regulator:** **Kentucky Department of Insurance (KY DOI)** -- Official
website: [**https://insurance.ky.gov**](https://insurance.ky.gov/).

**Statutes & Regulations:** Kentucky's **Insurance Code** is in
**Kentucky Revised Statutes (KRS) Chapter 304**. **Regulations** are in
**Kentucky Administrative Regulations (806 KAR)**. KY DOI's website
provides access to **laws and regulations**, and houses **Advisory
Opinions**, **Bulletins** (e.g., "Bulletin 2025-1" on updated
requirements), and **Orders** issued by the Commissioner.

**Integration & Electronic Systems:** **Kentucky accepts SERFF filings
across all applicable lines** (SERFF serves as the primary portal for
property & casualty, life, health, etc., filings in Kentucky).
Electronic integration via SERFF is strongly supported for insurers.
Kentucky uses **SERFF Filing Access** to provide the public with certain
filing information, indicating widespread SERFF usage for public
records. Kentucky is a member of the **Insurance Compact (IIPRC)**,
aligning with a multistate e-filing approach for life and annuities.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Kentucky's regulator has invested in technology to interface with NAIC
systems. It was one of the first states to implement NAIC's **State
Based Systems (SBS)** platform; however, Kentucky **transitioned off
SBS** in 2021 (the state now manages its own system again for licensing
& enforcement but still uses NAIC's NIPR for producer licensing
applications). **UCAA** is available for electronic certificate of
authority applications to Kentucky.

On the **claims integration** side:

-   **Kentucky's Department of Workers' Claims** (Public Protection
    Cabinet) uses **EDI (IAIABC Standard)** for the electronic reporting
    of workplace injury and illness claims by insurers -- requiring
    integration for automated submission of FROI and SROI data.

-   **PIP (No-Fault) claims**: Kentucky's no-fault auto insurance law
    requires insurers to report certain information on PIP claims and
    payments to the **Kentucky Department of Insurance**, which can
    involve electronic submission of data to a **no-fault database** or
    via data calls when requested.

-   **Auto insurance verification**: Kentucky is implementing the
    **Kentucky Insurance Identification Program (KIIP)** for electronic
    verification of auto insurance -- insurers will provide data or
    maintain web services for policy verification (this program has been
    under development and may not yet require continuous integration
    from all carriers).

No broad API or real-time interface is provided by KY DOI for
integration with insurer policy systems. Insurers primarily interact
through SERFF and occasional data submissions in digital form as
mandated.

**Louisiana**

**Regulator:** **Louisiana Department of Insurance (LDI)** -- Official
website: [**https://ldi.la.gov**](https://ldi.la.gov/).

**Statutes & Regulations:** Louisiana's **Insurance Code** is in
**Louisiana Revised Statutes (RS) Title 22**. **Insurance regulations**
are in **Louisiana Administrative Code (LAC) Title 37, Insurance**. The
LDI website offers direct access to **laws and regulations** and an
extensive list of **Directives, Advisory Letters, and Regulations
(Rules)** the Department issues. **Directives and Advisory Letters** to
insurers and producers cover topics such as required coverages,
compliance with state law changes, and more.

**Integration & Electronic Systems:** **Louisiana requires electronic
filings via SERFF** for rate, rule, and form submissions (with limited
exceptions) across property/casualty, life, and health lines. LDI uses
SERFF for intake and tracking of filings and supports **electronic fee
payments** (via NAIC's integrated EFT). With the volume of filings after
major events (like hurricanes affecting the insurance market), Louisiana
often emphasizes timely SERFF submissions and uses SERFF to expedite
product approvals. Louisiana is a member of the **Interstate Insurance
Compact** as well.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Louisiana insurance regulatory processes are partially integrated with
NAIC:

-   **UCAA** for company licensing (the Department accepts online UCAA
    submissions for new companies or expansions).

-   **Producer licensing** uses **NIPR** and Louisiana is an **SBS**
    state (adopted NAIC's State Based Systems), meaning licensing
    processes, continuing education tracking, and regulatory actions are
    integrated into that national system.

-   **Market and financial data**: Insurers handle NAIC's **financial
    filings and MCAS** for Louisiana, meaning their internal systems
    should produce and deliver data per NAIC's specifications, which LDI
    then accesses.

**Claims and data integration:**

-   **Catastrophe claims reporting**: After events like hurricanes, LDI
    frequently mandates insurers to report claims and losses via
    **online data call surveys or templates** (e.g., how many claims
    filed, paid, etc.). Insurers must prepare to gather and submit such
    data electronically on short notice.

-   **Workers' compensation**: Regulated by the Louisiana Workforce
    Commission, insurers (or self-insured employers) must report
    injuries through forms or an **online portal** (**Form LWC-WC-IA-1**
    can be submitted electronically). Louisiana is in the process of
    adopting **EDI for work comp** (likely IAIABC standards) as many
    other states have done, which will require direct systems
    integration once mandated.

-   **Auto insurance**: Louisiana does not have a continuous insurer
    integration for verifying insurance (the law uses random selection
    of vehicles for insurance verification rather than requiring
    insurers to feed data into a central system continuously).

In summary, Louisiana leverages **SERFF and NAIC's affiliated electronic
systems** for most interactions with insurers' back-end processes, and
while it doesn't provide a general API for policy systems, it expects
insurers to **electronically participate** in specialized reporting
(like catastrophe claim data calls) and upcoming EDI programs.

**Maine**

**Regulator:** **Maine Bureau of Insurance** (part of Dept. of
Professional & Financial Regulation) -- Official website:
[**https://www.maine.gov/pfr/insurance**](https://www.maine.gov/pfr/insurance).

**Statutes & Regulations:** Maine's **Insurance Code** is in **Title
24-A of the Maine Revised Statutes**. **Regulations** (state rules) are
in sections of the **Code of Maine Rules (02-031 CMR)**. The Bureau's
site hosts **Insurance Laws & Rules** links and archives of
**Bulletins** (important communications from the Superintendent, often
numbered by year). For example, Maine's bulletins can cover changes like
new mental health parity requirements, data reporting obligations, or
interpretations of legislation.

**Integration & Electronic Systems:** **Maine requires insurers to use
SERFF** for rate, form, and rule filings for all lines under its
jurisdiction. The **Bureau of Insurance** processes insurer filings
through SERFF and also allows public access to some filings via the
SERFF Filing Access system for transparency (e.g., recent rate filings
in health insurance are accessible that way, reflecting Maine's policy
of open rate review). Maine is a **member of the Insurance Compact**,
which can simplify multi-state filings for life & annuity products
through SERFF.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Maine utilizes **NAIC's national integration points**:

-   It accepts **UCAA electronic filings** for new insurer licensing.

-   **Producer licensing** is managed through **NIPR**, with Maine being
    an **SBS** state (Maine moved to SBS in 2019). This provides
    integrated licensing processing.

-   **Financial & statistical filings**: Insurers licensed in Maine must
    file with NAIC; Maine then obtains that data via NAIC's systems
    (including RBC, annual statements, etc.).

**Claims data and policy system integration:**

-   **Workers' compensation** claims reporting in Maine is overseen by
    the **Maine Workers' Compensation Board** and has fully implemented
    **EDI** (IAIABC Release 3) for FROI and SROI. Insurers or their
    claims administrators must file those reports electronically, often
    via a third-party EDI service or direct integration if the insurer's
    claim system supports it.

-   **Other regulatory reporting** in Maine includes a **monthly
    electronic submission of certain health insurance data** (Maine has
    a unique **All-Payer Claims Database (APCD)** collecting claim-level
    health data from insurers for public policy analysis). Insurers
    offering health coverage must integrate their claims systems to
    provide data extracts (usually in APCD-specific file formats like
    X12 or pipe-delimited text) on a regular schedule to the state's
    health data organization.

-   Maine does not currently have a continuous auto insurance
    verification feed requirement; instead, law enforcement checks for
    proof of insurance at traffic stops or accidents.

In conclusion, Maine emphasizes **electronic submissions** -- primarily
via **SERFF for product filings** and **structured data files for
specific reporting mandates** -- but typically not through interactive
APIs. Integration efforts in Maine should focus on aligning insurer
systems with SERFF's data requirements and relevant EDI or data call
formats.

**Maryland**

**Regulator:** **Maryland Insurance Administration (MIA)** -- Official
website:
[**https://insurance.maryland.gov**](https://insurance.maryland.gov/).

**Statutes & Regulations:** Maryland's **Insurance Article** is in
**Maryland Code, Insurance (Division I and II)**. **Regulations** are
compiled in **Code of Maryland Regulations (COMAR) Title 31**. MIA
provides direct links to the **Insurance Statutes** online and COMAR
rules. The Administration issues **Bulletins** to insurers (e.g.,
"Property & Casualty Bulletins" and "Life and Health Bulletins") for
guidance on law changes or expectations. For instance, MIA might publish
bulletins on filing requirements for new mandated benefits or changes in
premium finance regulations.

**Integration & Electronic Systems:** **Maryland requires SERFF for most
insurance product filings** (particularly in the Property & Casualty and
Life/Health realms, all standard lines are accepted via SERFF). MIA's
internal systems are integrated with SERFF for receiving and reviewing
filings. Insurers should ensure SERFF integration for their product
development compliance process; SERFF's web interface or web services
can be used. **Maryland is a member of the Interstate Insurance Product
Regulation Compact** -- enabling one-stop SERFF filings for life and
annuity forms for multiple states including MD.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

**Maryland's integration environment** also includes:

-   **Company & Producer Licensing:** utilizes **NAIC UCAA** for insurer
    certificates of authority (Maryland's application can be done online
    through NAIC's portal), and as an **SBS state**, it uses the NAIC's
    SBS/NIPR for processing agent licensing, renewal, and appointments
    electronically.

-   **Financial filings**: done via NAIC's system by insurers, and MIA
    retrieves and reviews them through NAIC's iSite+ or similar.

For **claims and policy data integration**:

-   **Workers' Comp** in Maryland is regulated by the **Maryland
    Workers' Compensation Commission**, which currently (as of
    mid-2020s) encourages but does not enforce mandatory **EDI** for
    FROI/SROI -- they have eClaims registration and allow electronic
    data submission for those who prefer it. An insurer's claim system
    can integrate to report injuries and claim status electronically.

-   **Automobile Insurance**: Maryland instituted an **Automated
    Compulsory Auto Insurance System (ACAIS)** requiring insurers to
    electronically notify the MVA of new policies and cancellations for
    motor vehicle liability insurance. This means *insurers must
    integrate their policy admin systems with the MVA's system* either
    by direct data transfers or by uploading monthly *electronic data
    files (usually in a fixed-width or CSV format) via an SFTP server or
    web portal.* These processes ensure that uninsured motorist coverage
    compliance is tracked by the state.

Maryland is also known for being a leader in technology; for example, it
was one of the first states to accept **electronic proof of insurance**
through mobile devices, though that doesn't require an insurer
integration, just policyholder mobile access. In sum, Maryland's key
integration points for insurers revolve around **SERFF** for filings,
**NAIC national systems** for licensing and financial reporting, and
**data exchange with other agencies** (like MVA or WCC) for policy and
claim compliance.

**Massachusetts**

**Regulator:** **Massachusetts Division of Insurance (DOI)** -- Official
website:
[**https://www.mass.gov/orgs/division-of-insurance**](https://www.mass.gov/orgs/division-of-insurance).

**Statutes & Regulations:** Massachusetts's **Insurance laws** are in
**Massachusetts General Laws (M.G.L.) Chapters 174 to 176** (and related
chapters for specific entities). The **Division of Insurance** provides
accessible links for **Massachusetts insurance statutes** and **Division
of Insurance regulations (211 CMR)**. Also, Massachusetts issues
**Bulletins** and **Decision Letters** to companies (Mass DOI bulletins
often clarify new requirements or provide instructions; e.g., bulletins
on coverage mandates or data reporting). An online **Bulletins library**
by year is available on their site.

**Integration & Electronic Systems:** **Massachusetts mandates SERFF for
rate, rule, and form filings**, and was among the first to require it as
of January 1, 2009 for P&C lines. All major lines are accepted via
SERFF, making it a key integration target for insurers' compliance
systems. The state's own site emphasizes that companies should use
NAIC's **SERFF** and provides **"Policy Form and Rate Filing" guidance**
acknowledging SERFF utilization. Massachusetts also uses SERFF's public
access for completed filings, reinforcing that insurer filings go
through that system. The Commonwealth is part of the **Interstate
Insurance Compact** and thus participates in multi-state filing
processes.

**Massachusetts uses some additional integration systems:**

-   It is a participant in **NAIC's Uniform Certificate of Authority
    Application (UCAA)** for insurer licensing and corporate changes
    (with some state-specific requirements as outlined on NAIC's UCAA
    page).

-   **Producer licensing** is handled via **NIPR** (MA uses its own
    state system for licensing but interconnects with NIPR for
    submission of license applications and renewals).

-   **Financial and market data** are collected through NAIC (with
    Massachusetts retrieving company financial filings and MCAS through
    NAIC's databases).

**Claim and data reporting integration:**

-   **Massachusetts workers' compensation** is administered by the
    **Massachusetts Department of Industrial Accidents**, which *does
    not currently mandate EDI for claims* except for a pilot program
    (insurers file injury reports via the DIA's **online system or by
    email** in forms).

-   **Automobile insurance** integration in MA is notable: Massachusetts
    historically required insurers to follow assigned risk plan
    procedures via **Commonwealth Automobile Reinsurers (CAR)** systems.
    For insurance verification, Massachusetts participates in the
    national database for **commercial vehicle insurance** and has a
    system for insurers to verify private passenger auto insurance
    electronically upon queries.

-   **Special Data Calls**: Massachusetts often coordinates with NAIC or
    uses Google Forms/Excel templates for data calls (e.g., for flood
    insurance, COVID-related claim reporting) -- these require insurers
    to gather data from claims/policy systems and submit electronically
    via the specified channel.

No general-purpose API exists for direct insurer system queries to the
Massachusetts DOI, but the SERFF and data reporting systems cover the
needed integrations for policy/claims compliance.

**Michigan**

**Regulator:** **Michigan Department of Insurance and Financial Services
(DIFS)** -- Official website:
[**https://www.michigan.gov/difs**](https://www.michigan.gov/difs).

**Statutes & Regulations:** Michigan's **Insurance Code** is
encapsulated in **Michigan Compiled Laws (MCL) Chapter 500**.
**Insurance regulations** are implemented in **Michigan Administrative
Code (e.g., R.500)**. The DIFS site includes links to **Laws and
Rules**, and issues **DIFS Bulletins** and **Orders** for insurance
companies (for instance, bulletins on rate filing moratoriums or
guidance on new "no-fault" auto insurance reforms).

**Integration & Electronic Systems:** **Michigan requires the use of
SERFF** for **all state-required filings of insurance forms, rates, and
rules** for licensed insurers. The state has integrated SERFF into its
review process; insurers making filings in Michigan must prepare SERFF
filings (which can be done manually via SERFF's interface or integrated
programmatically). Michigan is a **member of the Interstate Insurance
Compact** (the state's acceptance of life/annuity products is
streamlined through the NAIC Compact SERFF process). Michigan also
accepts **SERFF Plan Management** for health plan rate filings
(especially after ACA changes).
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Michigan extensively uses **NAIC systems**: it is an **SBS state**
(using NAIC's State Based Systems platform for internal operations), and
therefore relies on **NIPR** for producer licensing and appointment
processes (insurers' agency management systems can use NIPR's Gateway
for bulk appointment processing). Michigan also was early in requiring
**electronic financial filings**; insurers deliver their statutory
financial statements through NAIC, and **DIFS's analysts use NAIC's
iSite+** to review them.

**Claims integration and data calls:**

-   **Auto Insurance No-Fault Data**: Michigan underwent a major
    no-fault auto insurance reform (2019) requiring insurers to file
    detailed **claims and loss data with DIFS annually** to monitor the
    impact of the reforms. Insurers must integrate their claims data
    (particularly PIP claims and medical payments data) into the format
    specified by DIFS for those annual reports, often via secure file
    upload on DIFS's portal or via email with encrypted spreadsheets.

-   **Insurance Verification**: Michigan has a **law enforcement
    insurance verification system**. Insurers writing auto policies are
    required to **submit policy data** (active and canceled policies) to
    the Michigan Secretary of State's **Electronic Insurance
    Verification System (EIVS)**. This is done via **batch data transfer
    (daily)**, requiring integration from insurer policy admin systems
    to generate those data files in accordance with AAMVA guidelines.

-   **Workers' Compensation**: The **Michigan Workers' Disability
    Compensation Agency** requires insurers to **electronically file
    first reports of injury** via their online portal (or acceptable
    alternatives). Michigan currently uses its own system, but is
    considering adoption of IAIABC EDI in the future -- in any case,
    insurers must integrate to produce required reports either via an
    online system or as data files.

In short, Michigan emphasizes **SERFF electronic filings** and certain
specialized data submissions (especially due to auto no-fault reforms)
that call for robust data extraction from insurer systems but largely
uses common national integration points for everyday regulatory
interactions.

**Minnesota**

**Regulator:** **Minnesota Department of Commerce (Insurance Division)**
-- Official website:
[**https://mn.gov/commerce/industries/insurance**](https://mn.gov/commerce/industries/insurance)
(the Insurance Division is part of the Department of Commerce).

**Statutes & Regulations:** Minnesota's **Insurance Laws** are found in
**Minnesota Statutes Chapters 59A -- 79A** (various chapters for
different insurance topics). **Rules** are in **Minnesota Rules, Chapter
2700-2790** (Commerce Dept -- Insurance). The Department of Commerce's
site provides links to **laws/regulations** and issues **Administrative
Bulletins** (numerical sequence per year) and
**Regulatory/Commissioner's Orders** relevant to insurers.

**Integration & Electronic Systems:** **Minnesota requires insurers to
file via SERFF** for most product filings (life, health,
property/casualty). The state's integration with NAIC's SERFF allows
both carriers and regulators to manage filings and track statuses
digitally. **SERFF's adoption is full-spectrum** across lines (with the
possible exception of any lines exempt from filing entirely). Minnesota
is a **member of the Insurance Compact**, which simplifies multi-state
filings for life/annuity through SERFF.

Minnesota also engages with **NAIC's other tools**:

-   It supports **electronic filings for financial/actuarial
    submissions** through NAIC's systems (companies file annual
    statements to NAIC).

-   **Producer licensing** is coordinated through **NIPR** (with
    Minnesota being a user of the **SBS** system since 2017, thereby
    benefiting from integrated licensing and regulatory data
    management).

-   **NAIC's Market Conduct Annual Statement (MCAS)** data is required
    in certain lines from carriers and reported to NAIC for Minnesota.

**Claim and policy data integration**:

-   **Auto Insurance Verification**: **Minnesota's no-fault auto
    insurance law** mandates a random sampling program rather than a
    continuous database. Insurers have to **respond electronically to
    random verification requests** from DPS when asked, or provide data
    via batch if required.

-   **Workers' Compensation**: Minnesota's **Department of Labor &
    Industry (DLI)** fully implemented **IAIABC EDI** for workers' comp,
    requiring insurers to integrate their claims systems for FROI/SROI
    transmissions (the **EDI requirement** in Minnesota replaced older
    paper forms, and as of about 2020, all FROI/SROI must go through
    EDI). DLI uses a vendor portal for EDI trading partner management
    and communications.

-   **Catastrophe & Special Data Calls**: Minnesota can issue data calls
    (such as for catastrophic storm claims, or market conditions in
    certain lines). The method is often distribution of templates for
    insurers to fill and return electronically.

Minnesota does not offer an insurer-facing API for general day-to-day
data exchange. Compliance largely runs through **SERFF and standardized
data submissions** as described above.

**Mississippi**

**Regulator:** **Mississippi Insurance Department (MID)** -- Official
website: [**https://www.mid.ms.gov**](https://www.mid.ms.gov/).

**Statutes & Regulations:** Mississippi's **Insurance Code** is in
**Mississippi Code Title 83**. **Regulations** are implemented via the
**Mississippi Administrative Code (Part 1, Title 19 for Insurance)**.
MID's site gives access to **Mississippi insurance laws and rules** and
contains **Bulletins** and **Regulations** as PDFs. Commissioner's
**Bulletins** (often labeled by year and number, e.g., Bulletin 2022-5)
provide guidance on topics like adjusting claims after hurricanes,
regulatory filing fee changes, etc.

**Integration & Electronic Systems:** **Mississippi uses SERFF
extensively** for insurance product filings (all lines accepted via
SERFF). The state encourages digital submission---SERFF integration into
insurers' processes helps expedite the review. Mississippi's SERFF
adoption includes **electronic fee payments (EFT)** as needed.
Mississippi is also part of the **Interstate Insurance Compact**, so
multi-state life/annuity filings can go through SERFF's IIPRC platform
including Mississippi.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Mississippi leverages **NAIC's integration** for many regulatory tasks:

-   **Optins** is offered for premium tax payments (Mississippi uses
    OPTins as an option for electronic tax filing by insurers).

-   **NIPR** is used for agent licensing applications and renewals, with
    Mississippi having joined the **SBS platform**.

-   **UCAA** is accepted for certificate of authority and expansions
    (with Mississippi requiring additional state-specific items via
    NAIC's portal list).

-   **Financial and market conduct data** for Mississippi are collected
    through NAIC's standard calls (annual statements, etc.), requiring
    insurers to integrate with those submission processes.

**Claims data integration**:

-   **Workers' Comp**: Mississippi's **Workers' Compensation
    Commission** **does not currently mandate EDI** for claims (as of
    mid-2020s, they still largely rely on paper forms or PDF
    submissions). However, they may accept electronic reports via email.
    Insurers writing work comp should be prepared for EDI in the future
    if Mississippi aligns with national trends.

-   **Catastrophe Claims Reporting**: Mississippi often issues emergency
    bulletins requiring insurers to report claim volumes and losses
    after disasters (like hurricanes). Insurers must quickly compile
    these data from claims systems and submit them to MID, typically via
    *email spreadsheets or through an online survey form provided by
    MID.*

-   **Auto Insurance**: Mississippi does not have a real-time insurer
    integration system for verifying auto insurance; proof of insurance
    is usually checked at registration or traffic incidents.

In summary, insurers doing business in Mississippi should focus
technical integration on **SERFF for product filings** and be ready to
handle state requests for policy/claim data through flexible data
extraction methods (though these are infrequent outside events like
catastrophes).

**Missouri**

**Regulator:** **Missouri Department of Commerce & Insurance (DCI)** --
Official website:
[**https://insurance.mo.gov**](https://insurance.mo.gov/) (the
department was known as Dept. of Insurance, Financial Institutions &
Professional Registration, but in 2019 reorganized under the Dept. of
Commerce and Insurance).

**Statutes & Regulations:** Missouri's **Insurance laws** are primarily
in **Missouri Revised Statutes (RSMo) Title XXIV, Chapters 374-385**.
**Insurance regulations** are compiled in **Missouri Code of State
Regulations (CSR) Title 20, Division 700**. The DCI website provides an
**"Insurance Laws & Regulations"** section and includes **Bulletins**
and **Regulations** (agent licensing bulletins, coverage mandates,
etc.).

**Integration & Electronic Systems:** **Missouri accepts SERFF for
virtually all insurance filings** (all lines that require filing are
supported via SERFF). Use of SERFF is strongly recommended for speed and
transparency, and is effectively required in practice for P&C and
life/health filings. The department leverages SERFF to manage filings
and uses NAIC's integrated payment systems (Missouri has historically
had no filing fees for many P&C filings, but when fees apply SERFF's EFT
is accepted). Missouri is a **member of the Insurance Compact**, so
life/annuity products can be filed through the IIPRC SERFF system
covering Missouri.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Missouri's regulatory tech environment includes:

-   **Producer licensing & company licensing**: Missouri's systems are
    connected to **NIPR** for agent licensing. It's not on the SBS
    system, meaning Missouri still runs independent databases for
    licensing but uses NIPR to interface with industry.

-   **Financial filings & NAIC**: insurers file via NAIC and Missouri
    uses those data (for RBC, etc.). The department encourages
    electronic filings via NAIC for *all company licensing updates (like
    when foreign insurers file their annual renewal statements, or
    corporate amendments, often using UCAA via NAIC's site)*.

**Claims and policy data integration**:

-   **Missouri ACORD EDI**: For example, **Missouri's Second Injury
    Fund** requires carriers to **electronically file certain claim
    reimbursement requests** (via an online portal), demanding
    integration from insurers that handle those claims.

-   **Workers' Comp EDI**: The **Missouri Division of Workers'
    Compensation** is implementing **EDI (IAIABC standard)** for claim
    reporting. Insurers must set up FROI/SROI data transmissions for
    work-related injuries to meet state regulations.

-   **Auto Insurance**: Missouri doesn't yet have a continuous insurance
    verification program requiring insurer data feeds. After dropping an
    earlier program, it uses an **auto insurance database** mostly
    populated by licensing information, and it is exploring updated tech
    -- insurers may eventually need to integrate if a new program is
    launched, but currently compliance is monitored via random checks.

In general, Missouri, like most states, expects insurers to integrate
with **SERFF and other NAIC-based processes**. Other direct system
integration demands are limited to specific needs (like the work comp or
Second Injury Fund reporting or state-specific data calls).

**Montana**

**Regulator:** **Montana Commissioner of Securities and Insurance
(CSI)** -- Official website: [**https://csimt.gov**](https://csimt.gov/)
(the Commissioner's office handles both insurance and securities
regulation).

**Statutes & Regulations:** Montana's **Insurance Code** is in **Montana
Code Annotated (MCA) Title 33**. **Administrative rules** are in the
**Administrative Rules of Montana (ARM) Title 6, Chapter 6**. The CSI
website gives direct references to **Montana Insurance Laws and Rules**,
and it publishes **Advisory Memoranda** or **Bulletins** to insurers
(e.g., an advisory memorandum on wildfire claims handling).

**Integration & Electronic Systems:** **Montana accepts SERFF for
insurance filings**, covering all standard lines of insurance (SERFF
integration is widely used by CSI to handle rate/form reviews). Insurers
should prepare SERFF-based filings, which can be managed through the
NAIC interface or integrated with their own systems. Montana emphasizes
electronic submissions and is an **active Insurance Compact member**, so
multi-state life & annuity filings via the IIPRC apply here.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Montana coordinates with national infrastructure:

-   **UCAA**: Accepts electronic company licensing applications via
    NAIC.

-   **Producer Licensing**: Through **NIPR** (Montana uses its own
    licensing management system but ties into NIPR for industry
    connectivity).

-   **Financial filings**: Insurers deliver to NAIC, and Montana uses
    NAIC's access tools to retrieve/assess them.

**Claim and data integration:**

-   **Workers' Compensation**: Administered by the **Montana Department
    of Labor & Industry**, which *does not mandate EDI for work comp
    claims* at this time, although insurers can send EDI if they choose.
    Instead, an insurer typically reports accidents via paper or digital
    form submission through the DLI's system. If EDI is adopted in the
    future, integration with claim systems will be needed.

-   **Auto insurance**: Montana has a relatively traditional approach:
    law enforcement can verify insurance via a state system if necessary
    (the Motor Vehicle Division is authorized to set up an online
    verification system, but as of now, enforcement relies on proof of
    insurance and periodic checks; any future integration might use a
    service like the national **Insurance Verification System**).

-   **Data Calls**: If Montana issues a targeted data call (for
    instance, information on a particular line's claims or exposures),
    they might use NAIC's tools or direct communications requiring
    insurers to send data in Excel/CSV form.

Montana's integration needs for insurers revolve around **SERFF adoption
and standard NAIC processes**, requiring minimal custom development
beyond normal compliance software enhancements.

**Nebraska**

**Regulator:** **Nebraska Department of Insurance** -- Official website:
[**https://doi.nebraska.gov**](https://doi.nebraska.gov/).

**Statutes & Regulations:** Nebraska's **Insurance Statutes** are found
in **Nebraska Revised Statutes Chapter 44**, with additional relevant
statutes in other chapters (like captive insurance in Ch. 77).
**Nebraska Administrative Code Title 210** covers the Department's
regulations. The Department of Insurance site provides resources on
**Nebraska's statutes and rules** and catalogs **Director's Orders &
Bulletins** (e.g., bulletins on topics like electronic delivery of
policies or adjusting for catastrophes).

**Integration & Electronic Systems:** **Nebraska mandates SERFF** for
most insurance product filings (P&C, life, and health are submitted and
reviewed via SERFF). Insurers should integrate or use SERFF to manage
Nebraska filings. The Department supports **electronic payments** for
any necessary fees via **NAIC's EFT** system, ensuring end-to-end
digital filing capabilities. Nebraska is a **member of the Interstate
Insurance Compact**, so it accepts compact-approved life and annuity
filings.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Nebraska has adopted NAIC's **State Based Systems (SBS)** as of 2024,
meaning it will leverage NAIC technology for licensing, enforcement, and
consumer complaint processes. **Producer licensing** is integrated with
**NIPR**. **Company licensing** uses NAIC's **UCAA** for domestic and
foreign insurer certifications. Nebraska also requires insurers to
participate in NAIC's **MCAS** and similar data programs for uniform
market conduct information.

**Claims & data integration:**

-   **Workers' Comp**: Administered by the **Nebraska Workers'
    Compensation Court**, which currently may have EDI (the Court has
    considered adopting IAIABC EDI standards; if implemented, insurers
    will need their claims systems integrated accordingly).

-   **Auto insurance**: Nebraska uses a **system for electronic
    insurance verification**. Insurers are required to report all new
    auto policies and cancellations to the DMV via electronic means
    (commonly *batch transmissions through a secure channel or a vendor
    solution*). This requires insurers' policy administration systems to
    generate those data submissions regularly.

-   **Other**: Nebraska sometimes joins multi-state data calls via NAIC
    or requests specific information (like flood insurance take-up rates
    or named storm claims) through electronic survey instruments. The
    insurer's compliance team should be prepared to extract such data.

In summary, Nebraska's emphasis is on **SERFF and NAIC-facilitated
electronic regulation**, with insurer integration tasks mainly around
hooking into SERFF and accommodating any state-specific reporting
mandates, like auto insurance data feeds to the DMV.

**Nevada**

**Regulator:** **Nevada Division of Insurance** (Dept. of Business &
Industry) -- Official website:
[**https://doi.nv.gov**](https://doi.nv.gov/).

**Statutes & Regulations:** Nevada's **Insurance laws** are in **Nevada
Revised Statutes (NRS) Title 57**. **Regulations** are in **Nevada
Administrative Code (NAC) Chapter 686A-693A (Insurance)**. The
Division's site includes **Insurance Statutes & Regulations** links and
an archive of **Bulletins** and **Notices** (Nevada issues **Insurance
Bulletins** with year-number classification, addressing topics like
insurer data security, network adequacy guidelines, etc.).

**Integration & Electronic Systems:** **Nevada requires insurers to
submit filings via SERFF** as part of its efforts to streamline
regulatory processes. SERFF is accepted for all standard lines of
insurance requiring regulatory filing. The Division's participation in
SERFF includes use of the SERFF public access for some filings,
particularly health rate filings. Nevada's membership in the
**Interstate Insurance Compact** allows qualified life/annuity filings
through the SERFF-based compact portal.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Nevada has embraced various **electronic integration** features:

-   It uses **NAIC's electronic processes** for **insurer licensing**
    (UCAA for certificate of authority apps).

-   It has historically used a state-specific system for some functions
    but is transitioning to more NAIC alignment. **Producer licensing**
    is through **NIPR** (Nevada is expected to join **SBS** soon, but as
    of 2026, it still operates an independent database).

-   The Division collects **financial statements via NAIC** and partakes
    in NAIC's aggregated data calls.

**Claims and related data integration**:

-   **Workers' Compensation** in Nevada is overseen by the **Nevada
    Division of Industrial Relations (DIR)**. Historically, Nevada
    required insurers to *mail or email first reports of injury*;
    however, they are moving toward an **online portal** for submissions
    and may consider EDI adoption (some large insurers preemptively use
    IAIABC EDI format for their own recordkeeping to ease multi-state
    compliance).

-   **Auto Insurance**: Nevada has implemented an **Electronic Insurance
    Verification** program for mandatory auto liability coverage --
    insurers must either *provide a method (web service) for real-time
    verification or regularly upload policy data to the state's DMV
    database*. Most large insurers use a **real-time web service**
    integration following the **IICMVA (Insurance Industry Committee on
    Motor Vehicle Administration)** model guidelines, enabling their
    policy systems to automatically respond to queries from the Nevada
    DMV about coverage status. This is a direct and **real-time system
    integration** relevant to insurer policy admin systems for auto
    lines.

The main message for Nevada is to **integrate with SERFF** for all
filings, use **NAIC's standardized pipelines** where possible, and be
aware of the **auto insurance verification integration** which is an
ongoing, operational data exchange.

**New Hampshire**

**Regulator:** **New Hampshire Insurance Department (NHID)** -- Official
website:
[**https://www.nh.gov/insurance**](https://www.nh.gov/insurance).

**Statutes & Regulations:** New Hampshire's **Insurance Statutes** are
in **Revised Statutes Annotated (RSA) Title XXXVII**. **Administrative
rules** are compiled in the **New Hampshire Code of Administrative
Rules, Ins 100-** series. NHID's website has a section for **Laws and
Rules** and provides **Bulletins** and **Notices** (NH bulletins often
focus on new laws, e.g., health insurance mandates or adjustments for
catastrophes, labeled by year and number).

**Integration & Electronic Systems:** **New Hampshire uses SERFF
exclusively for rate and form filings** (across P&C, life, health,
etc.), requiring insurers to submit electronically via the NAIC's
platform (the Department's guidelines confirm SERFF's mandatory use for
nearly all product filings). Public SERFF access is also enabled for New
Hampshire, specifically for some lines and after certain dates, aligning
with the state\'s commitment to transparency. New Hampshire is a
**member of the Interstate Insurance Compact**, so insurers have a
one-stop SERFF filing option for those lines in multiple states.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

The NH Insurance Department relies on **national integration**:

-   **Company Licensing** via **UCAA** (digital certificate of authority
    applications accepted).

-   **Producer licensing** through **NIPR** (NH uses a combination of
    state-specific systems and NIPR connectivity; it has not fully
    adopted SBS but still integrates at the licensing application
    level).

-   **Financial/Market Data Reporting** by carriers to NAIC (adhering to
    NAIC formats and transmissions, subsequently used by NH regulators).

**Claims and data integration**:

-   **Workers' Compensation**: In New Hampshire, the **Department of
    Labor** requires that insurers report injury claims (within 5 days
    of knowledge) using form and also has an **electronic reporting**
    application (the state's site references the ability to email forms;
    not yet full EDI adoption, though the region's trend suggests
    possible future adoption of IAIABC EDI -- for example, neighbors
    like Vermont have EDI for WC). System integrators should monitor for
    any introduction of an automated EDI requirement in NH.

-   **Auto Insurance**: New Hampshire uniquely does not mandate auto
    insurance for drivers (except in certain circumstances), so it
    doesn't operate an insurance verification system. Instead, insurers
    in NH mainly respond to state requests if needing to verify coverage
    (a rare scenario given the state's *"no mandatory insurance"*
    stance).

-   **Data Calls**: NH participates in multi-state data calls and may
    issue state-specific calls (for instance, to gather information on
    coverage availability in coastal regions). Insurers respond by
    submitting data via spreadsheets or through NAIC's special data call
    mechanism.

New Hampshire's straightforward approach means insurers should ensure
robust **SERFF integration** for regulatory filings, with additional
readiness to handle occasional data reporting in mandated formats, but
otherwise no complex custom IT integrations.

**New Jersey**

**Regulator:** **New Jersey Department of Banking & Insurance (DOBI)**
-- Official website:
[**https://www.nj.gov/dobi/insurance**](https://www.nj.gov/dobi/insurance).

**Statutes & Regulations:** New Jersey's **Insurance statutes** are in
**N.J. Statutes Title 17B (Life & Health) and Title 17 (Property &
Casualty, etc.)**. **Regulations** appear in **N.J. Administrative Code
(N.J.A.C.) Title 11**. DOBI's site provides direct access to **Laws and
Regulations** and maintains **Bulletins** (NJ uses "**Bulletins**" for
both banking and insurance -- insurance bulletins are often labeled
"Insurance Bulletin \*\*year-\*\*number" or by subject). For instance,
NJ bulletins cover issues like electronic transactions in insurance or
guidance on new mandated benefits.

**Integration & Electronic Systems:** **New Jersey requires SERFF** for
**property/casualty and life/health form & rate filings**. As of the
2010s, NJ dramatically increased its reliance on SERFF to improve
speed-to-market. Insurers should use SERFF for nearly all filings in NJ
(SERFF is integrated for life/annuity, health, P&C -- including flood
rate filings, title insurance, etc.). New Jersey is a **member of the
Interstate Insurance Compact**, enabling SERFF-based multi-state filings
for certain life and annuity products.

In addition to SERFF, **New Jersey** has some unique integration
aspects:

-   **Electronic Rate/Rule Manuals:** For auto insurance, a legacy
    system called **"Filing Disclosure System"** is used to publicly
    display components of rate filings (since NJ had a "public
    availability" requirement distinct from SERFF, though now SERFF SFA
    can serve that function).

-   **State Health Filing System:** For health insurance, **as part of
    ACA, New Jersey had a separate portal** (the "Health Filing Form"
    system) for QHP before fully using SERFF's plan management; by Plan
    Year 2023, all health plan filings shifted to SERFF.

**National Systems:**

-   **Producer licensing** is processed via **NIPR** (NJ uses NIPR/other
    connectivity but not SBS).

-   **Company licensing**: via **NAIC's electronic UCAA** (and also
    integrated with NJ's "Docket" system for tracking approvals).

-   **Financial and statistical filings**: done via NAIC (insurers
    integrate to produce RBC, annual statements, and e-mail the RBC
    diskette or now send it electronically to NAIC, which NJ accesses).

-   **Market Conduct**: NJ participates in NAIC's MCAS.

**Claims integration & data reporting**:

-   **Auto Insurance**: New Jersey's regulatory environment for auto is
    very involved (due to personal injury protection (PIP) benefits).
    While there isn't a continuous coverage verification feed as in some
    states (NJ uses proof of insurance and random audits), insurers must
    electronically file things like **PIP medical cost containment
    data** to DOBI via designated **Excel or text file templates** on a
    periodic basis (as part of cost containment reporting).

-   **Workers' Compensation**: Handled by the **NJ Department of
    Labor**, which currently requires insurers to send an **annual
    report of compensation payments** electronically (via an online
    form). New Jersey has not fully adopted IAIABC EDI for routine
    claims (some large insurers voluntarily use EDI to internally track
    NJ claims), but an *EDI requirement may be considered in the
    future*.

Overall, New Jersey depends on **SERFF** for insurer/regulator
integration on filings and uses **various specialized electronic
submissions** for things like PIP data. Insurers should ensure
compliance by integrating with SERFF and having capabilities to produce
the state-specified electronic reports.

**New Mexico**

**Regulator:** **New Mexico Office of Superintendent of Insurance
(OSI)** -- Official website:
[**https://www.osi.state.nm.us**](https://www.osi.state.nm.us/).

**Statutes & Regulations:** New Mexico's **Insurance Code** is in **New
Mexico Statutes Annotated (NMSA) Chapter 59A**. **Insurance
regulations** are in the **New Mexico Administrative Code (NMAC) Title
13**. OSI provides links to these laws and rules and publishes
**Bulletins** and **Superintendent's Notices**. For example, OSI
bulletins may detail procedural changes for filings or clarifications of
new laws (e.g., bulletins on network adequacy or on wildfire-related
moratoriums).

**Integration & Electronic Systems:** **New Mexico accepts and generally
requires SERFF** for filing of rates, forms, and rules in all major
lines. The OSI's adoption of SERFF covers property/casualty and
life/health; insurers should integrate SERFF in their processes for NM
compliance. OSI also uses a public SERFF access link for viewing
non-confidential filings. New Mexico is a **member of the Interstate
Insurance Compact**, so compact filings can cover NM's requirements.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

**National Integration Points:**

-   New Mexico's OSI is an **SBS state** (it adopted NAIC's State Based
    Systems in 2020), meaning that licensing, company appointments,
    complaints, etc., are managed via the NAIC platform. **Producer
    licensing** is handled through **NIPR** with SBS integration
    (insurers can leverage NIPR for agent licensing feeds).

-   **Company licensing** tasks are done through NAIC's UCAA.

-   **Financial/market filings** are done via NAIC's systems. For
    instance, New Mexico requires electronic annual statement filings
    (via NAIC) and uses NAIC's IRIS ratios and other tools for analysis.

**Claims data reporting integration**:

-   **Workers' Comp**: New Mexico's **Workers' Compensation
    Administration** requires **electronic submission of FROI/SROI**
    using IAIABC EDI standards (the WCA has an EDI portal for
    insurers/TPAs to register and upload or transmit data). Insurers
    writing WC must integrate their claims systems to generate these
    data flows to New Mexico's EDI vendor.

-   **Health Data**: The OSI runs an **external health claims dataset**
    (for cost transparency). Certain health insurers must submit claims
    data to the **New Mexico All-Payer Claims Database** -- this might
    require system integration to output aggregated claim info in a
    standard format.

-   **Catastrophe & Special Reports**: Occasionally, OSI might request
    data (like wildfire insurance availability, or health network
    adequacy data), which requires insurers to provide data via
    spreadsheets or OSI's online forms.

New Mexico's approach is largely to use SERFF and NAIC standard
solutions, complemented by targeted data integration (like workers' comp
EDI and possibly APCD data). Insurers should ensure **SERFF readiness**
and be alert to any OSI bulletins that require them to electronically
submit other types of data.

**New York**

**Regulator:** **New York Department of Financial Services (DFS)** --
Official website (Insurance Division):
[**https://www.dfs.ny.gov/industry\_guidance/insurance**](https://www.dfs.ny.gov/industry_guidance/insurance).

**Statutes & Regulations:** New York's **Insurance Law** is consolidated
under **New York Consolidated Laws, Insurance (ISC)**. Additional
relevant laws include **NY Financial Services Law (FSL)** and **NY
Codes, Rules and Regulations (NYCRR), Title 11 (Insurance
Regulations)**. DFS's website includes **"Industry Guidance"** with
**Insurance Circular Letters, Regulations, and Guidance**. **Circular
Letters** are a primary mode of formal guidance in NY (e.g., Circular
Letter 2023-xx on Cybersecurity, etc.). DFS also publishes **Insurance
Regulations (Insurance Regs)** in full text and **Proposed Regulations**
for comment on its site.

**Integration & Electronic Systems:** Historically, New York was unique
in not fully using SERFF for all filings. However, **as of May 25, 2020,
DFS mandated that all rate and form submissions must be made through
NAIC's SERFF**. This marked a significant shift where now **NY fully
accepts SERFF** for P&C rates/forms as well as life/health (accident &
health) forms\*\*\*\*. Today, **SERFF is the standard platform** for
insurer filings in New York, and DFS has provided **specific SERFF
filing guidelines** for various lines (e.g., SERFF filing instructions
for health insurers, SERFF guidelines for life forms under Section
3201). **Public SERFF access** is enabled for New York in certain lines:
DFS's site notes that *accident & health policy forms and P&C filings
disposed on/after 2018 are accessible through SERFF's public portal*.
**New York is not a member of the Interstate Insurance Compact**,
meaning insurers must file life and annuity products directly with DFS
via SERFF rather than through the IIPRC.
[\[dfs.ny.gov\]](https://www.dfs.ny.gov/apps_and_licensing/health_insurers)

New York has several **state-specific integration points**:

-   **Electronic Filing Systems**: Before SERFF adoption, DFS had
    proprietary systems such as the **System for Rate Filings (for
    health insurance rate review)**. With SERFF now mandated, those have
    been largely phased out. However, DFS might still use the **Health
    Bureau Filing System (HBS)** for some health plan internal
    processes, but insurer interface is via SERFF.

-   **Cybersecurity Portal**: New York's **Cybersecurity Regulation (23
    NYCRR 500)** requires insurers to file certifications and breach
    notices via a **secure DFS Web Portal**. Insurers' compliance
    departments may integrate these processes by automated reminders but
    currently *no open API exists*, they log in to submit forms.

-   **Regulatory Reporting**: DFS collects vast data from insurers via
    specialized means:

    -   **Financial Condition Reports**: Although DFS has its own
        analysis, it heavily uses NAIC financial filings (every licensed
        insurer must file annual statements with NAIC that DFS
        accesses). In addition, DFS requires some *direct state-specific
        reports*, e.g., the "PCSR" (Property/Casualty Supplement Annual
        Statement).

    -   **Market data calls**: DFS occasionally mandates insurers to
        submit detailed data for special investigations (e.g., a data
        call on **COVID-19 business interruption claims** in 2020).

**Claims & data integration:**

-   **New York does not have a statewide auto insurance verification
    system** requiring ongoing data exchange. Instead, New York uses
    traditional methods (insurance ID cards, occasional checks).

-   **No-fault (PIP) reporting**: Possibly some internal claims data
    integration: insurers must report some aggregate PIP claims
    statistics to DFS (via *File Transfer or email templates as needed*)
    to monitor the no-fault system.

-   **Workers' Compensation**: **New York's Workers' Compensation Board
    (WCB)** historically used its own electronic claims system
    (**eClaims**), which fully adopted **IAIABC EDI** (Release 3.1) for
    mandatory electronic reporting of FROI and SROI by carriers
    since 2014. Insurers in NY **must integrate their claims systems**
    with WCB's EDI program (often through EDI vendors or in-house EDI
    teams), sending claim event data via secure file transmissions.

In sum, New York has aligned with **SERFF for filings** (recently
achieving parity with other states in that regard) and uses various
specialized portals for things like cybersecurity filings and work comp
claims EDI. Insurers should ensure SERFF integration for product filings
and robust claim system feeds for WCB's EDI obligations.

**North Carolina**

**Regulator:** **North Carolina Department of Insurance (NCDOI)** --
Official website: [**https://ncdoi.gov**](https://ncdoi.gov/).

**Statutes & Regulations:** North Carolina's **Insurance laws** reside
in **N.C. General Statutes Chapter 58**. **Regulations** are in the
**North Carolina Administrative Code (Title 11)**. The NCDOI website
provides resources such as **NC General Statutes links** and
**Administrative Rules**, and lists **Bulletins** (e.g., numbered
bulletins regarding coverage mandates, or technical changes in filings)
issued by the Commissioner.

**Integration & Electronic Systems:** **North Carolina requires
electronic filings via SERFF** for form, rate, and rule submissions in
nearly all lines of insurance. NCDOI was a pioneer in SERFF adoption
(particularly to help implement open competition in certain lines), and
encourages companies to use SERFF exclusively. The Department notably
had separate processes for **Blue Cross health filings** historically,
but now SERFF's uniform platform is used widely. North Carolina is a
**member of the Insurance Compact** -- insurers can leverage the
SERFF-based IIPRC for life/annuity product filings.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

North Carolina's integration with **NAIC's national systems** is deep:

-   **Producer licensing** is through **NIPR** (NC is an **SBS state**
    since mid-2010s, meaning much of its regulatory backend is
    NAIC-provided, including licensing and enforcement data management).

-   **Company licensing**: uses **UCAA** (with some state-specific docs,
    e.g., trusts, as listed on NAIC's site).

-   **Financial & market data**: reported via NAIC.

**Claim and policy data integration**:

-   **Auto insurance**: North Carolina has a **liability insurance
    verification system** focusing on periodic tracking. Insurers must
    **notify the NCDMV electronically when auto policies are
    terminated**; this is done via a secure batch file or direct
    database connection. The program is often referred to as the
    **Online Liability Insurance Verification (OLIV)** in NC. It's not
    real-time, but insurers must integrate policy system outputs to
    generate timely cancellation notifications as required.

-   **Workers' Compensation**: NC's **Industrial Commission** requires
    insurers to **submit claim info electronically**. It adopted **EDI
    Claims Release 3** for FROI/SROI -- carriers file initial injury
    reports via EDI (through a state authorized vendor or internal
    direct file transfers), integrating directly with their claims
    systems.

North Carolina's approach is in line with national standards. Insurers
should integrate with **SERFF** and ensure their systems can provide
required feeds (like those to the DMV for auto insurance status changes
and to the Commission for work comp claims).

**North Dakota**

**Regulator:** **North Dakota Insurance Department** -- Official
website:
[**https://www.insurance.nd.gov**](https://www.insurance.nd.gov/).

**Statutes & Regulations:** North Dakota's **Insurance Code** is in
**North Dakota Century Code Title 26.1**. **Administrative rules** are
in **North Dakota Administrative Code Title 45**. The Insurance
Department website provides links to **ND Laws & Rules** and publishes
**Bulletins** (e.g., bulletins on subjects like health insurance
navigators, licensing updates) and **Administrative Orders**.

**Integration & Electronic Systems:** **North Dakota mandates SERFF**
for submissions of insurance product filings (covering P&C, life,
health, etc.), using NAIC's platform to expedite filings. The
Department's usage of SERFF includes supporting **electronic payments**
(via NAIC's central EFT). ND is a **member of the Interstate Insurance
Compact**, which allows less burdensome multi-state filings for life and
annuities via SERFF.

North Dakota also uses **NAIC's SBS** platform (as of early 2024, North
Dakota announced a transition to SBS for regulatory operations), which
means the state is standardizing on NAIC tools:

-   **Producer licensing** is done through **NIPR** (with SBS handling
    the state's internal side for licensing).

-   **Company licensing** and corporate amendments use NAIC's **UCAA**.

-   **Financial and market data** are collected via NAIC (with insurers
    submitting to NAIC and ND retrieving the info).

**Claims & data integration**:

-   **Workers' Comp**: North Dakota is unique in having a **monopolistic
    state fund** (Workforce Safety & Insurance, WSI, which is the sole
    provider of workers' comp). Thus, private insurers don't handle work
    comp in ND, eliminating that integration need.

-   **Auto**: ND has an **electronic auto insurance verification
    program** (piloted in 2019): insurers must report active policies to
    a central database. ND's system likely uses a **third-party
    service** for daily/weekly batch updates from insurers' policy
    systems or real-time queries. Insurers writing auto in ND will need
    to coordinate with the system (often through a vendor like MV
    Solutions or Insur-Verify who provide an API for insurers to use).

-   **Health Data**: ND collects some health insurance data for rate
    review (carriers provide claims experience in templates, often
    through SERFF or direct email for certain plan rates).

-   **Property data calls**: ND is known to join multi-state catastrophe
    data calls (like to track storm claims) -- insurers deliver that via
    NAIC or direct means electronically (Excel or an online form).

North Dakota's regulatory tech stack is strongly aligned with **NAIC's
integrated systems (SERFF, SBS/NIPR, UCAA, etc.)**, with minimal need
for separate development, aside from fulfilling data calls and the auto
insurance verification feed.

**Ohio**

**Regulator:** **Ohio Department of Insurance (ODI)** -- Official
website: [**https://insurance.ohio.gov**](https://insurance.ohio.gov/).

**Statutes & Regulations:** Ohio's **Insurance Code** is in **Ohio
Revised Code Title 39**. **Administrative rules** are in the **Ohio
Administrative Code (OAC) Agency 3901**. ODI's site has a **Laws &
Rules** section and posts **Bulletins** (e.g., bulletins to insurance
companies, often labeled by year and number, like "2025-1", on topics
such as product filing instructions or claim handling in disasters).

**Integration & Electronic Systems:** **Ohio strongly encourages (and
effectively requires) insurers to use SERFF** for all insurance product
filings. The Department's **"File and Pay"** system for new filings and
associated fees is integrated with **SERFF and an e-payment system**.
Ohio accepts **SERFF filings across all major lines** of insurance;
combined with Ohio's **file-and-use** approach in some lines, SERFF
integration helps expedite time to market. Ohio is a **member of the
Interstate Insurance Compact**, meaning insurers can address Ohio's
life/annuity product approvals via the SERFF-based Compact process.

**National system alignment:**

-   **Producer licensing**: through **NIPR** (Ohio employs NIPR
    services; it does not use SBS but still integrates at the
    industry-facing side).

-   **Company licensing**: via **UCAA** (with particular state forms
    required by Ohio noted on NAIC's site).

-   **Financial/market data**: via NAIC (insurers submit their annual
    statements to NAIC for Ohio, and ODI collects additional data e.g.
    though the NAIC Market Conduct Annual Statement in targeted lines).

**Claims & data integration:**

-   **Workers' Comp**: Ohio is one of the four **monopolistic states for
    workers' compensation** -- all employers obtain coverage exclusively
    from the **Ohio Bureau of Workers' Compensation**, meaning private
    insurers *do not provide standard workers' comp policies in Ohio*.
    Therefore, **no workers' comp claim EDI** integration is needed for
    insurers (except for special cases like self-insurance which is
    admin by BWC).

-   **Auto Insurance**: Ohio does not currently have a mandatory insurer
    reporting system or real-time verification. The state relies on
    proof of insurance and has a random verification program, where
    insurers may be contacted by BMV to verify a particular vehicle's
    coverage (often via fax or email). There's no direct continuous
    integration with insurer systems.

-   **Health & Life**: Ohio has implemented a **health claims data
    reporting law** requiring insurers to submit claims and utilization
    data to a state healthcare database (the Ohio All-Payer Claims
    Database is in development) -- once fully operational, it will
    likely require insurers to integrate by regularly transmitting
    claims data files.

In summary, **integration efforts in Ohio should prioritize SERFF for
product filings** (which covers most insurer-regulator communications),
with an eye towards compliance with any special data calls or planned
data collection programs like the APCD. Standard NAIC processes cover
most other interactions.

**Oklahoma**

**Regulator:** **Oklahoma Insurance Department (OID)** -- Official
website: [**https://www.oid.ok.gov**](https://www.oid.ok.gov/) (recently
updated from oid.ok.gov, formerly ok.gov/oid).

**Statutes & Regulations:** Oklahoma's **Insurance Code** is in **Title
36 of the Oklahoma Statutes**. **Insurance regulations** appear in the
**Oklahoma Administrative Code (OAC) Title 365**. The OID website
provides links to **Statutes & Rules** and maintains **Orders and
Bulletins** (e.g., bulletins on topics like electronic proof of
insurance acceptance or adjustments to continuing education requirements
for producers).

**Integration & Electronic Systems:** **Oklahoma accepts SERFF filings**
for all major lines. The Department in fact embraced NAIC's electronic
systems to modernize compliance. SERFF is used by insurers for form/rate
filings, with **SERFF's EFT** enabling convenient fee payments. Oklahoma
is a **member of the Interstate Insurance Compact**, so it's part of the
unified SERFF filing approach for life & annuity products.

**Oklahoma** was relatively early to adopt NAIC's **State Based Systems
(SBS)**, and as a result:

-   **Producer licensing** and regulatory enforcement are fully on
    **SBS**, with industry interfacing via **NIPR** (meaning carriers
    can integrate by making use of NIPR's Producer Database for license
    checks and appointment synchronization).

-   Notably, OID uses SBS beyond licensing: as of 2025 OID integrated
    its **complaint communication** into SBS, instructing companies to
    use the SBS Company Complaint Portal for managing complaint
    responses, which is a form of integration for insurers to access and
    respond to regulatory complaints electronically.

-   **Financial filings** are through NAIC's standard system (insurers
    send data to NAIC, OID retrieves it).

**Claims & Other data integration:**

-   **Workers' Comp** in Oklahoma is overseen by the **Workers'
    Compensation Commission**, which implemented **Claims EDI R3** for
    reporting. Insurers must integrate with the WCC's EDI vendor for
    automated claim data submission.

-   **Auto insurance**: Oklahoma launched an **Online Verification
    system** -- insurers are required to **provide a web service for
    real-time insurance verification** or upload policies to a central
    database, per state law. Many carriers have integrated their system
    with the national model used for this, supporting web service
    queries from law enforcement and the tag agencies.

-   **Catastrophe claims**: OID will sometimes demand claims data after
    events like tornadoes or hail storms; typical integration method is
    a manual upload of spreadsheets via email or an emergent portal
    mechanism, not a standing integration.

In summary, Oklahoma's regulators provide robust connectivity primarily
via **SERFF and SBS/NIPR**, with specific requirements for insurers to
integrate their systems for complaint handling and auto liability
verification.

**Oregon**

**Regulator:** **Oregon Division of Financial Regulation (DFR)** (in the
Dept. of Consumer & Business Services) -- Official website:
[**https://dfr.oregon.gov/business/insurance**](https://dfr.oregon.gov/business/insurance).

**Statutes & Regulations:** Oregon's **Insurance Statutes** are in
**Oregon Revised Statutes (ORS) Chapters 731-752**. **Regulations** are
in **Oregon Administrative Rules (OAR) Chapter 836**. The DFR site
references these laws/rules and provides **Insurance Bulletins** (which
often interpret legislative changes or set forth expectations on rate
filings, e.g., Bulletin 2024-5 on wildfire risk underwriting).

**Integration & Electronic Systems:** **Oregon requires SERFF** for
submission of insurance rates and forms in most lines (including health,
life, annuities, property & casualty). The DFR integrated SERFF for both
internal processes and provides SERFF public access for some filings.
The DFR has indicated a strong reliance on SERFF moving forward,
especially as it handles complex health rate review tasks. Oregon is a
**Compact member**, enabling multi-state SERFF filings.

Oregon historically used independent systems but is expanding its NAIC
integration:

-   The state announced in 2025 a **special procurement to implement
    NAIC's State Based Systems (SBS)**. Once active, Oregon will use SBS
    for licensing and complaint management. Even before SBS adoption,
    Oregon used **NIPR** for producer licensing (NIPR's online portal is
    used by carriers/agents to manage licensing in Oregon).

-   **Company licensing** partly uses NAIC processes -- Oregon
    participates in UCAA (with some state-specific items).

-   **Financial and statistical data** are provided via NAIC's filings.

**Claim and policy integration**:

-   **Workers' Comp**: Oregon's **Workers' Compensation Division** uses
    an in-house system called **Employer Indexing (EI)** and allows
    electronic data submission for claims (Oregon was a relatively early
    adopter of electronic claim reporting, but *not via IAIABC EDI;
    instead a state-specific format is used*). Some carriers in Oregon
    still file via forms to the WCD; integration is not uniform.

-   **Auto Insurance**: Oregon does not have a real-time insurance
    verification system obligating direct insurer integration;
    enforcement is achieved by citations and random checks on uninsured
    drivers.

-   **Data calls**: Oregon often coordinates with NAIC or West Coast
    states on data calls (for example, wildfire claims and underwriting
    data have been requested across several seasons, usually via an
    Excel template). Insurers must gather and supply data electronically
    but not through a continuous interface.

Oregon stands out for being mid-transition to **NAIC's SBS** system
which will further streamline integration. The primary current
integration for insurers is **SERFF** for filings, and responding to any
special data requirements digitally.

**Pennsylvania**

**Regulator:** **Pennsylvania Insurance Department (PID)** -- Official
website:
[**https://www.insurance.pa.gov**](https://www.insurance.pa.gov/).

**Statutes & Regulations:** Pennsylvania's **Insurance statutes** are
largely in **Pennsylvania Consolidated Statutes Title 40**, with older
statutes in **P.L. (Pamphlet Laws)**. **Insurance regulations** are in
**Pennsylvania Code Title 31**. PID's site provides an **"Industry"**
section with access to **Laws and Regulations** and hosts **Notices,
FAQs, and Bulletins** (for example, some "Notice to all insurers"
letters about licensing or coverage mandates, or technical guidance
documents for filings).

**Integration & Electronic Systems:** **Pennsylvania uses SERFF** for
electronic submissions of insurance product filings across all lines
where filings are needed. PID has integrated SERFF's processes
thoroughly; insurers should indeed plan to file all rates and forms via
SERFF and may integrate their own systems for automatic submission and
tracking. Pennsylvania is a **member of the Interstate Insurance
Compact**, facilitating multi-state SERFF filings for life and annuity
products.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

**National integration and systems:**

-   Pennsylvania leverages NAIC's tools: it has not yet moved to SBS
    (the state has its own systems but uses **NIPR** for license
    applications, demonstrating partial integration).

-   It uses **OPTins** for some payments (like surplus lines tax, if not
    done through stamping offices).

-   It accepts **UCAA** for corporate applications and changes (with
    state-specific instructions on NAIC's website).

-   It collects **financial statements** via NAIC's repository and is
    active in analyzing NAIC's RBC and IRIS metrics.

**Claims and policy data integration**:

-   **Workers' Comp**: Pennsylvania's **Department of Labor & Industry**
    mandates that insurers **report workers' compensation claims via
    EDI** (PA adopted IAIABC EDI Release 3). Insurers must integrate
    their claims systems to generate those EDI transmissions to the
    state's designated EDI vendor. This real-time/batch integration
    ensures regulatory compliance for all FROI and SROI events.

-   **Auto**: Pennsylvania does not have a mandated continuous insurance
    verification system; Pennsylvania relies on **insurance ID cards**
    and enforcement at traffic stops. There's no continuous data feed
    required from insurers for auto.

-   **Other data calls**: Pennsylvania occasionally requires insurers to
    submit data (like a **major medical claim costs to track healthcare
    trends** as mandated by law). Typically, these are done through an
    Excel or an online portal (DAVE -- a data collection system for
    MCAS, etc., which is run through NAIC's tools).

In summary, Pennsylvania's insurance regulation is primarily integrated
via **SERFF** for product filings and **NAIC's standard channels** for
licensing and financial data, with **work comp EDI** being a significant
area of direct claims system integration.

**Rhode Island**

**Regulator:** **Rhode Island Department of Business Regulation,
Insurance Division** -- Official website:
[**https://dbr.ri.gov/insurance**](https://dbr.ri.gov/insurance).

**Statutes & Regulations:** Rhode Island's **Insurance Statutes** are in
**Title 27 of the Rhode Island General Laws**. **Insurance regulations**
are issued as **Rhode Island Code of Regulations (RICR) Title 230,
Chapter 20** etc. The Insurance Division provides access to **laws and
regulations** and publishes **Insurance Bulletins** and **Industry
Alerts** (e.g., bulletins regarding electronic filings, changes to
insurance producer fees, etc.).

**Integration & Electronic Systems:** **Rhode Island requires SERFF**
for insurance product filings (forms, rates, rules) across life, health,
property & casualty lines. The Insurance Division has integrated SERFF
into its workflow and expects carriers to file electronically
(traditional paper filings are no longer accepted in most cases). Rhode
Island is a **member of the Interstate Insurance Compact**, which allows
life/annuity product integration via the SERFF-based compact process.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Rhode Island has moved toward broader NAIC integration:

-   It is an **SBS state** as of the mid-2010s, meaning it uses NAIC's
    technology to handle licensing, enforcement, and consumer services.
    **Producer licensing** is done via **NIPR** with SBS handling
    back-office. Insurers can integrate agent appointments and license
    checks through NIPR.

-   **Company licensing** uses **UCAA** for uniform application
    submission.

-   **Financial reporting** uses NAIC's standard protocol (no separate
    state submission needed beyond what NAIC collects).

**Claim and data integration**:

-   **Workers' Comp**: Rhode Island's **Department of Labor and Training
    (DLT)** requires insurers to file injuries via **First Report of
    Injury** forms, often through DLT's **ELECTRONIC claim filing portal
    or EDI**. RI was exploring IAIABC EDI adoption for claims release
    3.1; integrators should check current DLT guidelines as EDI can be
    optional vs. mandatory.

-   **Auto**: Rhode Island currently does not have an active electronic
    auto insurance verification data feed requirement (the state uses a
    combination of primary enforcement of insurance laws and required
    proof at registration).

-   **Other**: RI participates in New England or NIC data calls if
    needed (for example, RI joined other states in a **COVID-19 business
    interruption insurance claims data survey**; carriers provided data
    electronically to DBR via email).

For Rhode Island, focusing on integration with **SERFF** and NAIC's
standardized processes covers almost all routine regulatory
interactions; additional integration is limited to specific demands like
EDI for work comp if applicable.

**South Carolina**

**Regulator:** **South Carolina Department of Insurance (SCDOI)** --
Official website: [**https://doi.sc.gov**](https://doi.sc.gov/).

**Statutes & Regulations:** South Carolina's **Insurance Laws** are
codified in **Title 38 of the South Carolina Code of Laws**.
**Regulations** are in **Chapter 69 of the South Carolina Code of
Regulations**. The SCDOI website makes available **Laws & Regulations**,
and it publishes **Bulletins** (SCDOI bulletins often provide guidance
on compliance or new laws, e.g., bulletins on storm preparedness
obligations, or on premium tax credits changes, labeled by number-year
combination).

**Integration & Electronic Systems:** **South Carolina encourages and
uses SERFF for all rate and form filings** in P&C, life, and health.
SERFF usage in SC is robust; the Department's "Company Filing" resources
direct insurers to use SERFF and provide checklists via SERFF. SC
participates in **SERFF Filing Access** to allow public inspection of
some filings (e.g., certain health insurer filings). South Carolina is a
**Compact member**, so insurers can file eligible products through
IIPRC's SERFF once for SC and other states.

South Carolina has a comprehensive integration approach:

-   It uses **NAIC's tools** for many tasks. **Producer licensing** is
    done via **NIPR** (SC is an **SBS** state, having improved its
    internal systems by adopting NAIC's SBS platform around 2019-2020).
    Carriers must integrate if they appoint agents en masse or do
    background checks by using NIPR's databases.

-   **Company licensing** accepts **UCAA** uniform apps from NAIC's
    portal.

-   **Financial & market data** collection is through NAIC (MCAS in key
    lines is required by SC).

-   **Premium tax**: SC uses NAIC's **OPTins** portal for premium tax
    and surplus lines tax (except portion administered by the SC Surplus
    Lines Association if any, though SC does not have a stamping office;
    they rely on OPTins for direct surplus lines tax e-filings).

**Claims and policy integration**:

-   **Workers' Compensation**: The **South Carolina Workers'
    Compensation Commission (SCWCC)** has mandated **EDI** for claims
    (Release 3.0 as of 2024). Insurers must register as trading partners
    and send FROI/SROI data as per SCWCC's Implementation Guide.

-   **Auto**: SC implemented the **"SC ALIR" (Automobile Liability
    Insurance Reporting)** system. Insurers must provide **periodic
    electronic updates of insured vehicles** to the SC DMV's database
    (the system uses AAMVA standards where insurers typically furnish
    data via a monthly SFTP batch or through a vendor's web service).
    This ensures compliance with SC's insurance verification law,
    requiring integration with insurer policy admin to produce those
    files.

-   **Hurricane claims**: SC may issue queries for insurers to report
    property claim numbers and losses after hurricanes; these are
    collected via online forms or spreadsheets which are a one-time
    integration per event.

In summary, South Carolina relies on **SERFF** for filings and has
**structured electronic requirements for claims (work comp EDI) and auto
policy data** -- key integration points for insurers doing business in
the state.

**South Dakota**

**Regulator:** **South Dakota Division of Insurance** (Dept. of Labor &
Regulation) -- Official website:
[**https://dlr.sd.gov/insurance**](https://dlr.sd.gov/insurance).

**Statutes & Regulations:** South Dakota's **Insurance Code** is
primarily in **South Dakota Codified Laws (SDCL) Title 58**. **Insurance
regulations** are found in **Administrative Rules of South Dakota (ARSD)
Article 20:06**. The Division of Insurance site provides links to **SDCL
and ARSD** for insurance and publishes **Bulletins** (often numbered by
year, e.g., 21-xx series) on issues such as licensing changes or health
coverage mandates.

**Integration & Electronic Systems:** **South Dakota accepts and largely
requires SERFF** for insurer filings (covering P&C, life, health, etc.).
The Division encourages all companies to use SERFF for speed of review
and has been increasing reliance on electronic processes. Regarding
multi-state products, South Dakota is a **member of the Insurance
Compact**, facilitating use of the SERFF-based IIPRC.
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

**South Dakota's integration** with NAIC tools is strong and growing:

-   As of May 2025, **South Dakota joined NAIC's State Based Systems
    (SBS)** to manage its internal insurance regulatory processes. This
    means licensing, enforcement, and other functions are now on a
    standardized NAIC platform. Insurers will interact largely via
    **NIPR** for licensing tasks in SD following this transition (NIPR
    and SBS are fully interoperable).

-   **Company licensing** is done via **UCAA** for new or foreign
    insurers.

-   **Financial filings**: through NAIC's channels.

**Claims and policy integration**:

-   **Workers' Comp**: Handled by the **SD Department of Labor's
    Division of Labor & Management**; South Dakota requires insurers to
    report FROI and SROI through either EDI or an approved alternative.
    SD has gradually moved to adopt **IAIABC EDI** (like many states) --
    claims system integration via EDI is likely necessary for those
    writing volume in SD.

-   **Auto**: SD is one of the states that does **not have mandatory
    auto insurance** for liability (only for certain vehicles or in case
    of accidents requiring financial responsibility). Therefore, there's
    no continuous auto insurance data exchange required from insurers;
    compliance checks are on an incident basis.

-   **Data calls**: SD participates in NAIC calls and may demand data in
    events (like hail storms affecting the agriculture/hail insurance
    market). Insurers respond through spreadsheets or NAIC's aggregated
    call platform.

The key for South Dakota is adaptation to **SERFF and SBS** -- insurers
should use SERFF for filings and align with NAIC's SBS (via NIPR) for
licensing and other tasks, thus achieving integration primarily via
those channels.

**Tennessee**

**Regulator:** **Tennessee Department of Commerce & Insurance (TDCI),
Insurance Division** -- Official website:
[**https://www.tn.gov/commerce/insurance**](https://www.tn.gov/commerce/insurance).

**Statutes & Regulations:** Tennessee's **Insurance law** is largely in
**Tennessee Code Annotated (TCA) Title 56**. **Insurance regulations**
are in **Tennessee Compilation of Rules and Regulations (Tenn. Comp.
R&R) Chapter 0780**. The TDCI site has links to **Laws & Rules** and
issues **Bulletins** (often named by date or number) and **Policy
Statements** for insurers (e.g., bulletins on insurer data security,
catastrophe claims handling guidelines).

**Integration & Electronic Systems:** **Tennessee requires electronic
filings via SERFF** for product forms and rates across property/casualty
and life/health lines. The TDCI's integration with SERFF includes
enabling **public access to filings** via SERFF for transparency.
Tennessee's a **Compact member** (thus, life and annuity products can be
filed through IIPRC SERFF for multi-state deployment including TN).
[\[serff.com\]](https://www.serff.com/serff_participation_map.htm)

Tennessee's regulatory operations are partly on older systems but
incorporate NAIC services:

-   It uses **NIPR** for licensing (Tennessee had not fully converted to
    SBS as of 2026 but still uses NIPR's interfaces heavily, with plans
    for modernization possibly involving SBS).

-   **UCAA** is accepted for insurer licensing and changes (Tennessee
    often outlines additional items under State-Specific Requirements on
    NAIC's site).

-   **Financial & Statistical reporting** is via NAIC (insurers handle
    those according to NAIC instructions).

**Claims system integration**:

-   **Workers' Comp**: The **Tennessee Bureau of Workers' Compensation**
    requires insurers to report injuries via **EDI** (TN has a dedicated
    EDI portal and references **tnbwcedi.info** for trading partners).
    The Bureau uses **IAIABC EDI Claims Release 3.1** -- insurers must
    integrate claims systems to produce those mandated data streams.

-   **Auto Insurance**: Tennessee established an **Online Insurance
    Verification System** under recent laws; insurers must either
    respond to **real-time verification requests** (via a web service
    integration using the model developed by the national working group)
    or file data for those drivers selected for verification.
    Implementation has been through a vendor with which insurers
    register to provide data.

-   **Other**: TDCI may occasionally require other electronic
    submissions (e.g., life insurance illustration testing data, which
    is often an actuarial submission through email).

Overall, Tennessee's focus is on **SERFF** integration for filings and
meeting specific electronic reporting mandates like their work comp EDI
and auto verification, which require targeted integration efforts from
insurer systems.

**Texas**

**Regulator:** **Texas Department of Insurance (TDI)** -- Official
website: [**tdi.texas.gov**](https://www.tdi.texas.gov/). (Texas also
has a separate **Division of Workers' Compensation**, DWC, under TDI for
work comp.) [\[tdi.texas.gov\]](https://www.tdi.texas.gov/)

**Statutes & Regulations:** Texas's **Insurance statutes** are primarily
in **Texas Insurance Code** (TIC), which is an extensive code covering
all insurance lines. **Regulations** are in the **Texas Administrative
Code (TAC) Title 28**. TDI provides access to **Statutes & Rules**, and
issues **Commissioner's Bulletins** (with sequential numbers; e.g., a
bulletin might announce a data call or a change in enforcement stance)
and **Commissioner's Orders**. TDI's site also provides **Proposed &
Adopted Rules** with details to help insurers comply.
[\[tdi.texas.gov\]](https://www.tdi.texas.gov/)

**Integration & Electronic Systems:** **Texas strongly encourages
electronic filings via SERFF for rates, forms, and rules** across all
lines, with SERFF being the standard for insurers interacting with TDI
for product filings. **SERFF Filing Access** is available for public
search of company filings since April 2014, demonstrating TDI's reliance
on SERFF. TDI does allow *some alternative for corporate filings* (for
example, certain corporate form filings can be emailed as PDFs, as noted
on the TDI site). **Texas is not a member of the Interstate Insurance
Compact**, so insurers must file products like life insurance policies
directly with TDI (the SERFF system is still used, but Texas retains
independent review).

**National Systems:**

-   TDI uses **NIPR** for producer licensing and has integrated to some
    extent with **SBS** in 2022 (Texas began implementing SBS modules,
    for example for continuing education tracking).

-   **UCAA**: accepted for electronic company licensing, especially for
    foreign insurers seeking admission.

-   **Financial & market filings**: Insurers interact with NAIC for
    RBC/annual statements and TDI receives that data electronically.

**Claims & data integration in Texas is extensive**:

-   **Workers' Compensation**: TDI's **Division of Workers' Compensation
    (DWC)** **requires insurers to use EDI** to report injuries and
    claim developments. Texas has updated to **IAIABC EDI Claims Release
    3.1.4** for FROI and SROI as of mid-2023. Insurers must integrate
    their claims systems to produce and send these EDI transactions.
    **Verisk** is the contracted vendor for TX EDI; carriers register on
    **txdwcedi.info** to arrange secure batch or real-time
    transmissions.

-   **Automobile Insurance Verification ("TexasSure")**: Texas operates
    **TexasSure**, a centralized insurance verification database. All
    personal auto insurers must **electronically submit policy data**
    (active and canceled policies) to TexasSure **at least twice a
    week** via secured electronic transfer, or maintain a web service
    that allows the state's system to query by VIN/policy number and
    retrieve coverage status in real-time. Insurers' policy admin
    systems thus need to output in a specific format and schedule for
    TexasSure.

-   **Hail/Wind Deductible filings**: Texas requires insurers to file
    any separate hail/wind deductibles usage data and has an **online
    data collection** portal for that.

-   **Data Calls**: TDI frequently issues **data calls** (with
    deadlines) across various lines -- e.g., calls for property
    insurance direct premium in catastrophe areas, title insurance data
    calls, or health claims payment performance data. The Department
    often provides **reporting guidelines and online submission
    instructions** (e.g., via a portal or by emailing an Excel
    template). Insurers must integrate by extracting needed information
    from their systems and submitting it by the method specified.
    [\[tdi.texas.gov\]](https://www.tdi.texas.gov/webinfo/datacall.html)

In summary, Texas stands out for the breadth of its **electronic
integration requirements** -- beyond **SERFF** for product filings,
carriers must also manage robust **work comp EDI** and **auto insurance
data feed (TexasSure)** integrations, plus be ready to respond to
various **electronic data calls**. For systems integrators, Texas is one
of the most demanding states in terms of connecting regulatory reporting
capabilities to core policy and claims systems.

**Utah**

**Regulator:** **Utah Insurance Department** -- Official website:
[**https://insurance.utah.gov**](https://insurance.utah.gov/).

**Statutes & Regulations:** Utah's **Insurance Code** is in **Utah Code
Title 31A**. **Regulations** are in **Utah Administrative Code R590-**
series. The Insurance Department's website provides access to **laws and
rules** and issues **Bulletins** (Utah's bulletins, e.g., "2026-1-INS"
series, cover topics like license renewals, usage of technology in
insurance, etc).

**Integration & Electronic Systems:** **Utah requires filings via
SERFF** for form/rate review in all regulated lines (it was a relatively
early adopter of SERFF as well, eliminating most paper filings).
Insurers can integrate with SERFF's filing flows to handle Utah's
detailed requirements (Utah often provides state-specific product filing
**checklists** accessible on SERFF or the department website). Utah is a
**member of the Interstate Insurance Compact**, so life and annuity
SERFF filings can cover UT.

**NAIC integration in Utah**:

-   **Producer licensing** is done via **NIPR**; Utah was one of the
    initial states to connect and it remains not on SBS but uses NIPR
    interfacing for applications.

-   **Company licensing**: uses **UCAA** for foreign and domestic
    applications (with state-specific addenda).

-   **Financial statements**: submitted to NAIC by insurers (Utah then
    reviews via NAIC's systems).

-   Utah has also integrated **OPTins** for premium tax payments (the
    department encourages companies to use the OPTins system for tax and
    fees electronically rather than sending checks).

**Claims and policy integration**:

-   **Workers' Comp**: Utah's **Labor Commission** adopted **IAIABC EDI
    Release 3.2** for mandatory reporting of workers' comp claims (with
    an implementation guide for FROI/SROI accessible on the Commission's
    site). Insurers must become EDI trading partners and integrate
    FROI/SROI data from their claims systems to the Commission's EDI
    portal.

-   **Auto**: Utah has an **Uninsured Motorist Identification Database**
    -- insurers writing auto must **submit an electronic file monthly**
    listing all active policies (with VIN, insured name, etc.). The
    state's system is often managed by a contractor, requiring insurers
    to integrate by preparing a specific format (often an ALIR standard
    text file) for upload or SFTP.

-   **Health & others**: Utah requires health insurers to provide
    certain claims data (e.g., to the Utah All Payer Claims Database --
    which collects claims info for analysis; integration means health
    insurers periodically push standardized data files to the APCD
    aggregator).

-   **Catastrophe data**: less common in UT's context, but any such call
    would likely mimic NAIC or manual submissions.

**Conclusion:** Utah's integration demands are manageable by focusing on
**SERFF** for product filings and ensuring claims systems can output
data for **workers' comp EDI** and **auto policy database** needs. Most
other regulatory data flows are via NAIC's national systems.

**Vermont**

**Regulator:** **Vermont Department of Financial Regulation (DFR),
Insurance Division** -- Official website:
[**https://dfr.vermont.gov/insurance**](https://dfr.vermont.gov/insurance).

**Statutes & Regulations:** Vermont's **Insurance statutes** are in
**Title 8 of the Vermont Statutes Annotated (V.S.A.)**. **Regulations**
are in various **DFR Insurance Regulations** (the department's site
provides a compendium). DFR also publishes **Insurance Bulletins** that
are often clarifications or guidelines; e.g., bulletins on mental health
parity, data security expectations, etc.

**Integration & Electronic Systems:** **Vermont requires SERFF
submissions** for insurance product filings (life, health, P&C). DFR
uses SERFF to handle reviews and also provides an **online SERFF public
access** for some filings. *Vermont's historically unique
\"file-and-use\" environment for commercial lines still used SERFF for
records.* Vermont is an **Insurance Compact member**, meaning it relies
on the SERFF-based compact for life/annuity product review.

Vermont uses many **NAIC integration services**:

-   It is an **SBS state** (since 2018). **Producer licensing** is
    integrated via **NIPR/SBS**. Insurers can electronically manage
    agent licensing through those channels.

-   **Financial filings**: done via NAIC.

-   **UCAA**: accepted for certificate of authority processes (with
    needed local filings like trust deposits coordinated with the
    state).

**Claims & Data integration**:

-   **Workers' Comp**: Vermont's **Department of Labor** enforces
    **EDI** for workers' comp claims reporting (actively using **IAIABC
    EDI Release 3.1** for mandatory electronic FROI/SROI). Insurers must
    integrate claim system outputs to send timely electronic reports to
    the state's EDI endpoint, likely maintained by a vendor.

-   **Auto**: Vermont does not currently run a continuous insurance
    verification program requiring insurer data feeds. Trucking
    (commercial) insurance info might be shared via federal systems, but
    not state-run.

-   **Other**: Vermont uses an **All-Payer Claims Database (APCD)**,
    where health insurers must regularly transmit claims data in
    standardized files for health care cost transparency. Integration is
    required for health insurance claim systems to output those data.

-   **Climate/Catastrophe Data Calls**: Being a smaller state, Vermont
    sometimes coordinates with regional efforts or NAIC if a data call
    arises, expecting prompt *electronic submission of data by carriers
    via spreadsheets or secure email*.

In summary, Vermont's approach is **SERFF-centric** for product filings,
supplemented by strong adoption of NAIC's integration solutions (SBS,
NIPR, etc.) and a few specialized data flows (work comp EDI, APCD for
health).

**Virginia**

**Regulator:** **Virginia State Corporation Commission (SCC), Bureau of
Insurance** -- Official website:
[**https://scc.virginia.gov/pages/Insurance**](https://scc.virginia.gov/pages/Insurance).
(The SCC oversees insurance regulation through its Bureau of Insurance.)

**Statutes & Regulations:** Virginia's **Insurance Code** is in **Code
of Virginia Title 38.2**. **Insurance regulations** are in **Virginia
Administrative Code (Title 14, Agency 5)**. The SCC's Bureau of
Insurance provides an **Laws, Rules & Regulations** resource and issues
**Administrative Letters** (commonly the method of formal communication
in Virginia, akin to bulletins, addressing new law implementations,
instructions for company filings, etc.).

**Integration & Electronic Systems:** **Virginia requires electronic
rate/form filings via SERFF** for virtually all lines. The Bureau uses
the SERFF system to manage and speed up filings, and supports electronic
fee payments via NAIC processes. Virginia is a **member of the
Interstate Insurance Compact**, meaning insurers have the SERFF compact
channel as an option for life/annuity filings.

**Integration via national platforms:**

-   Virginia is not an SBS state; however, it utilizes **NIPR** for
    producer licensing (carriers must use NIPR for license checks and
    appointments).

-   **Company licensing** via **UCAA** is accepted (with state-specific
    requirements found on NAIC's lists).

-   **Financial & statistical filings**: through NAIC (insurers file
    with NAIC and Virginia's analysts use the data from NAIC's systems).

**Claims & policy data integration**:

-   **Workers' Comp**: Virginia's **Workers' Compensation Commission**
    requires *electronic claim reporting (EDI)*\* -- specifically,
    Virginia moved to **IAIABC EDI Release 3.1** and mandates all
    carriers to send their FROI/SROI electronically via the Commission's
    dedicated EDI system (which also includes an interactive web portal
    for adjusting submissions and reviewing errors). This requires
    integration from insurers' claims systems to push data to the WCC.

-   **Auto**: As of 2024, Virginia launched an **Insurance Verification
    System** using **web services** for real-time checking. Insurers
    must either regularly submit data on insured vehicles or provide a
    **web service** to the DMV for direct policy status inquiries.
    Integration is typically accomplished by using vendor solutions that
    mediate between insurer systems and the Virginia DMV's queries, or
    by direct development using the AAMVA model.

-   **Health & others**: Virginia collects some health insurance data
    via the **Virginia Health Information (VHI)** data system (an
    APCD-like program where insurers contribute claims data
    periodically). Insurers have to set up processes for these
    submissions, often through secure FTP.

-   **Catastrophe Reporting**: The Bureau might require insurers to
    report on weather event claims through electronic forms as needed,
    though Virginia, unlike some coastal neighbors, historically had
    less frequent mandatory data calls.

Overall, Virginia's insurer-regulator systems integration revolves
around **SERFF for filings**, **web service/EDI for specific compliance
areas** (work comp, auto verification), and national-level data systems
for licensing and financial oversight.

**Washington**

**Regulator:** **Washington State Office of the Insurance Commissioner
(OIC)** -- Official website:
[**https://www.insurance.wa.gov**](https://www.insurance.wa.gov/).

**Statutes & Regulations:** Washington's **Insurance Code** is in
**Revised Code of Washington (RCW) Title 48**. **Regulations** are in
**Washington Administrative Code (WAC) Title 284**. The OIC's site
provides direct references to **laws and rules**, and it issues
**Technical Assistance Advisories** and **Insurance
Advisories/Bulletins** (e.g., addressing health coverage changes or
clarifying regulatory expectations in claims handling).

**Integration & Electronic Systems:** **Washington mandates electronic
filings via SERFF** for product filings (for virtually all carriers and
lines under its jurisdiction). OIC's integration with SERFF enables
quick review cycles and robust records. For public transparency, **SERFF
Filing Access** is used (Washington uses the SERFF public portal to
publish filings -- for example, they offer public search of health
insurance rate filings via SERFF's platform). Washington is a **member
of the Interstate Insurance Compact** for life and annuities,
facilitating those SERFF-based multi-state filings.

**National systems & integration:**

-   **Producer licensing**: through **NIPR** (Washington uses an
    internal database but accepts NIPR transmittals for license
    applications and renewals; it's not an SBS state).

-   **Company licensing**: NAIC's **UCAA** for Uniform Certificate
    applications (with any distinct requirements listed on NAIC's site).

-   **Financial data**: collected via NAIC (Washington directly queries
    NAIC DB for company statements).

**Claims & data integration**:

-   **Workers' Comp**: Washington is a **monopolistic state** for
    workers' compensation (all coverage is provided through the state's
    Dept. of Labor & Industries), so private insurers do not write
    standard workers' comp policies and thus no insurer claim system
    integration for that line is needed.

-   **Health**: Washington has an **All-Payer Health Care Claims
    Database** for which insurers must regularly feed data on claims and
    enrollment -- integration requiring periodic data file exports (in a
    fixed format) from insurers' systems to the state's contracted APCD
    operator.

-   **Auto**: Washington enacted an **Electronic Insurance
    Verification** system (recently in development) to combat uninsured
    driving. While not fully live statewide yet, once implemented
    insurers will either have to supply policy data via **batch
    processes** or maintain real-time query endpoints -- integrators
    should monitor as the program evolves.

-   **Catastrophe & Climate data**: OIC is proactive on climate risk and
    may initiate data calls (like a survey of wildfire-related
    underwriting actions or insurance availability). These are executed
    via forms or spreadsheets that insurers fill out.

Washington's integration priority for insurers is **SERFF for product
filings**, and to meet any specific data feed obligations (like health
APCD, auto when active). The state has not offered an open API for
generic insurer queries -- interactions are through the defined systems.

**West Virginia**

**Regulator:** **West Virginia Offices of the Insurance Commissioner
(OIC)** -- Official website:
[**https://www.wvinsurance.gov**](https://www.wvinsurance.gov/).

**Statutes & Regulations:** West Virginia's **Insurance statutes** are
in **West Virginia Code Chapter 33**. **Regulations** (rules) are in
**West Virginia Code of State Rules Title 114**. The OIC site provides
access to **WV Code and Rules** and an archive of **Informational
Letters** and **Emergency Orders** (in WV, formal directives to insurers
often come as "Insurance Bulletins" or "Informational Letters" from the
Commissioner, e.g., addressing issues like premium relief efforts or
system changes).

**Integration & Electronic Systems:** **West Virginia accepts SERFF** as
the primary channel for insurer filings (covering P&C, life, health).
The state has been increasing SERFF usage as part of modernization
efforts. All major lines are accepted and often required to be filed via
SERFF (especially after 2018, WV OIC pushed to eliminate paper). **West
Virginia is a Compact member**, so multi-state SERFF filings for life
and annuities via the IIPRC can include WV.

**WV's integration with NAIC** was somewhat limited historically but:

-   In 2025, WV began **transitioning to NAIC's SBS platform** (with an
    expected go-live that year, as news noted WV going live with SBS for
    licensing and education). This means **producer licensing** and
    related processes will align with NIPR & SBS integration (carriers
    will interface with the NAIC-managed SBS portal for license info).

-   **Company licensing**: standard via UCAA.

-   **Financials & data**: through NAIC.

**Claims and data integration**:

-   **Workers' Comp**: WV's workers' comp has been privatized since
    2008, but the OIC still collects some data (like claim frequency and
    severity). They have not mandated EDI for claims at the OIC level.
    However, **some companies file EDI** voluntarily to a monitoring
    system or respond to periodic data calls on work comp performance
    (the state might not have full EDI because of historical transitions
    from a state fund).

-   **Auto**: WV uses the **Electronic Insurance Verification** system
    -- insurers must provide **weekly updates of all insured vehicles**
    to the WV DMV via an electronic means. Most provide a **weekly batch
    file** (in ALIR standardized format) via SFTP. This requires pulling
    data from policy systems to compile a dataset with vehicle and
    coverage details on a strict schedule.

-   **Fire & Coal Mine Subsidence**: WV OIC runs a **Mine Subsidence
    Insurance program** requiring insurers to cede certain coverage to a
    state fund -- it provides an **online system for insurers to report
    and remit associated premiums**. While not exactly a policy admin
    integration, insurers often incorporate it into workflows if writing
    property insurance in WV.

In essence, West Virginia's insurers must integrate with **SERFF** for
filings and prepare to shift agent licensing integration to the new
**SBS/NIPR** solution. Additional integration points like auto insurance
data feeds should be accounted for in their IT planning to ensure
compliance with WV's mandates.

**Wisconsin**

**Regulator:** **Wisconsin Office of the Commissioner of Insurance
(OCI)** -- Official website:
[**https://oci.wi.gov**](https://oci.wi.gov/).

**Statutes & Regulations:** Wisconsin's **Insurance laws** are in
**Wisconsin Statutes Chapter 600-655**. **Regulations** are in
**Wisconsin Administrative Code (Ins)** chapters. The OCI website gives
access to **Statutes & Administrative Code** sections and provides **OCI
Bulletins** (Wisconsin calls them "OCI Bulletins" often, addressing
topics like prescribe requirements for electronic filings, summary of
enacted bills, etc.).

**Integration & Electronic Systems:** **Wisconsin requires insurers to
use SERFF** for nearly all required rate and form filings in P&C, life,
and health lines. OCI's adoption of SERFF is broad, and the state has
integrated SERFF's processes including **electronic fee payments**
(Wisconsin historically has few fees for rate/form filings but when
applicable uses electronic payments). Wisconsin is a **member of the
Interstate Insurance Compact**, leveraging SERFF for life/annuity
multi-state filings.

**National Systems usage:**

-   **Producer licensing**: Wisconsin uses **NIPR** (Wisconsin still
    runs an independent in-state licensing system but uses NIPR for all
    new/renewal applications).

-   **Company licensing**: **UCAA** for primary steps.

-   **Financial filings & data**: by NAIC's processes, with OCI
    retrieving data from NAIC.

-   **Market conduct**: Wisconsin obtains MCAS and similar data via NAIC
    but also conducts its own state-specific market conduct data calls
    when needed.

**Claims & data integration**:

-   **Workers' Comp**: The **Wisconsin Department of Workforce
    Development, Worker's Compensation Division** requires electronic
    submission of First Reports of Injury. WI uses the **IAIABC EDI
    Claims Release 3** standard (with an active EDI system since early
    2000s), requiring direct integration of insurers' claim systems or
    via third-party EDI vendors to comply.

-   **Auto Insurance**: Wisconsin only mandates insurance for drivers in
    certain scenarios and does not have an active continuous insurer
    reporting requirement (no central insurance verification system;
    they rely on spot checks).

-   **Health**: Wisconsin's **Health Care Liability** program collects
    some malpractice claims data electronically (through an online
    portal for its state-managed Injured Patients and Families
    Compensation Fund if applicable).

-   **Other data**: WI's OCI might request data electronically for
    things like **crop hail insurance reports** or other specialized
    lines, typically by emailing forms.

Wisconsin's environment is similar to that of many states -- heavy
reliance on **SERFF** for regulatory integration and **EDI** for work
comp claims, but otherwise no daily real-time API obligations.

**Wyoming**

**Regulator:** **Wyoming Department of Insurance** -- Official website:
[**https://doi.wyo.gov**](https://doi.wyo.gov/).

**Statutes & Regulations:** Wyoming's **Insurance Code** is in **Wyoming
Statutes Title 26**. **Insurance regulations** are found in **Wyoming
Insurance Rules** (published by the Dept). The DOI website directs users
to **Wyoming Statutes and Regulations** and provides **Bulletins** or
**Regulatory Memoranda** (e.g., guidance on topics like domestic surplus
lines law implementation, often labeled with a date).

**Integration & Electronic Systems:** **Wyoming accepts SERFF filings**
for insurance products and encourages use of the system across all
applicable lines (especially for multi-state insurers). SERFF's adoption
is in line with NAIC's push for uniform electronic filing -- insurers
writing in Wyoming typically integrate SERFF in their compliance
processes. Wyoming is a **member of the Insurance Compact** for
life/annuity, so that multi-state SERFF channel is available.

Being a smaller state, **Wyoming heavily leverages NAIC's integration**:

-   **Producer Licensing** is processed through **NIPR** (Wyoming uses
    an in-house licensing system but all cross-communication with
    industry is via NIPR's portal or PDB).

-   **Company licensing**: via **UCAA** (with minimal state-specific
    extra requirements).

-   **Financial statements**: filed to NAIC by companies, accessed by
    Wyoming via NAIC tools.

**Claims and data integration**:

-   **Workers' Comp**: Wyoming is a **monopolistic state** for workers'
    comp (like OH, ND, WA); coverage is only provided by the state-run
    fund, so private insurers do not file work comp claims, eliminating
    EDI obligations for insurers.

-   **Auto**: Wyoming enacted an **electronic insurance verification**
    law, which requires insurers to **cooperate with the Wyoming DMV on
    a system to confirm auto insurance**. Many insurers fulfill this by
    providing the DMV with the ability to query a web service for policy
    status or by sending periodic policy data file updates. The program
    is similar to others: insurer policy systems must either accept
    queries with vehicle/driver information or push updated lists of
    insured vehicles. This is done through either direct integration or
    a vendor aggregator system; integration teams should ensure the
    policy system's data can feed into the chosen approach.

-   **Other**: Wyoming seldom issues large data calls individually,
    typically relying on NAIC for aggregated data. One exception could
    be **catastrophe reporting** if needed but major disasters are less
    common.

**Conclusion:** **Wyoming** focuses on using **SERFF** and **NAIC's
national tools** to minimize bespoke integrations, with the main unique
integration requirement being participation in the auto insurance
verification program through continuous or on-demand data sharing.

**Conclusion and Key Takeaways:** Every U.S. state (and D.C.) operates
its own insurance regulatory body with unique statutes and regulatory
guidance. **However, the common theme is the widespread adoption of
electronic systems to facilitate regulatory compliance and data
exchange.**

**SERFF** is nearly universal for **rate and form filings**, with very
few exceptions like Florida (which uses a proprietary system). Insurers
should ensure their **policy administration systems or product
management tools** are equipped to generate appropriate SERFF filings or
state-specific filing packages. SERFF's **web services** allow direct
integration, which can significantly streamline the submission process
for insurers handling high volumes of multi-state filings.

On the **claims integration front**, multiple states require insurers to
supply data electronically:

-   **Workers' compensation claims** EDI programs (for reporting first
    and subsequent injury/illness reports) are widespread -- insurers
    should implement an enterprise solution or vendor service to meet
    multiple states' EDI specs (often aligned with IAIABC standards).

-   **Auto insurance verification** systems in many states demand
    periodic or real-time data exchange about insured vehicles/policies
    -- these vary state by state but often follow a common model that
    can be integrated into policy systems.

**National and Shared Infrastructure** like **NAIC's** **SERFF, UCAA,
NIPR/SBS, SERFF Filing Access, and NAIC data calls** are integral to all
states' regulatory oversight, reducing fragmentation and helping
insurers to apply a more uniform integration approach across
jurisdictions. Being aware of **which states diverge (like Florida's
IRFS, Washington & others with unique processes)** is crucial for
focused compliance.

Finally, many state regulators supplement formal regulations with
**bulletins, directives, and guidelines** accessible on their websites;
these often contain details on technical requirements (like the use of
specific data portals or instructions for electronic submissions).
**Staying informed on each state's bulletins** is a key part of managing
compliance integration: for instance, Alabama's bulletin on adopting a
new surplus line platform (SLIP+), or New York's circular letters on new
e-filing mandates, provide actionable information for insurer IT teams.
[\[7\]](http://www.aldoi.gov/pdf/legal/Bulletin%202025-06.pdf)

**By understanding each state's regulatory site and integration tools,
insurers and their system integrators can more effectively align their
internal systems with regulatory requirements -- enabling smoother data
flows, faster approvals, and better compliance management nationwide.**

**Sources:**

-   *National Association of Insurance Commissioners (NAIC) -- State
    Insurance Department Directory (NAIC content, updated 2025/2026)*
    [\[content.naic.org\]](https://content.naic.org/state-insurance-departments),
    [\[content.naic.org\]](https://content.naic.org/sites/default/files/publication-ins-ou-insurance-directory.pdf)

-   *Insurance Department official websites and "Industry/Legal
    Resources" sections* (state statutes, admin codes, bulletins,
    integration references) -- e.g., ALDOI legal resources, ALDOI
    bulletins, TDI site for SERFF usage, Georgia OCI site for regulatory
    filings info. [\[aldoi.gov\]](https://aldoi.gov/Legal/)
    [\[aldoi.gov\]](https://aldoi.gov/Legal/Bulletins.aspx)

-   *NAIC SERFF State Participation Pages* (Florida's I-File system);
    SERFF usage notes for states (Mass., Texas, New York); NAIC SERFF
    Filing Access references.
    [\[serff.com\]](https://www.serff.com/serff_participation_florida.htm)
    [\[dfs.ny.gov\]](https://www.dfs.ny.gov/apps_and_licensing/health_insurers)

-   *State bulletins and regulatory documents on integration* -- e.g.,
    Alabama Bulletin 2025-06 (SLIP+ surplus lines system), Texas TAC
    §124.107 (work comp EDI requirement), SC Workers' Comp Commission
    EDI guide (Release 3.0).
    [\[7\]](http://www.aldoi.gov/pdf/legal/Bulletin%202025-06.pdf)

-   *Industry references and news on regulatory tech adoption* -- e.g.,
    AgentSync Regulatory Roundup (SD SBS adoption, 2025), OID complaint
    portal migration to SBS (Mulready notice).

-   *State data call announcements* -- TDI property catastrophe data
    call; TDI health claims data call (prompt pay compliance).
    [\[tdi.texas.gov\]](https://www.tdi.texas.gov/webinfo/datacall.html)

-   *State insurance department integration guides* -- e.g., GA OCI
    SERFF help page, TX SERFF search page, Florida OIR industry portal
    resources.
