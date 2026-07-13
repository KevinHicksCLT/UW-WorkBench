# Product-spine segment content files

One JSON file per segment (`personal-lines.json`, `smb.json`, `commercial.json`,
`multinational.json`, `specialty.json`, `lloyds.json`), consumed by
`backend/scripts/seed-product-spine.ts`. Hierarchy seeded from it:
L1 segment → L2 LOB / product family → L3 product → L4 version / jurisdiction →
L5 model component (exactly the 9 canonical names below, in this order) →
`items` = the REAL contents of that component for that product version
(actual coverages / limits / rating factors / fees / UW rules / forms /
filings / lifecycle transactions), each with what it is and the system or
document it lives in today.

Canonical component names + default owners:

1. Product Taxonomy — Product operations
2. Coverages — Product operations
3. Terms — Product operations
4. Rating — Actuarial + IT
5. Pricing — Actuarial
6. Underwriting Rules — Underwriting
7. Forms — Compliance / forms team
8. Filings — Compliance
9. Lifecycle Behavior — IT / policy operations

```jsonc
{
  "segment": {
    "name": "Personal Lines", // in-app display name
    "canonicalName": "Personal Lines",
    "systems": "PAS A (mainframe) · PAS B",
    "legacyVariants": 14,
    "operatingPattern": "one-line description",
    "distribution": "Direct, aggregator",
    "placement": "Single policy",
    "reinsurance": "Treaty (back-end)",
    "regulatory": "State filings",
    "behavior": { "Product Taxonomy": "Shared taxonomy", "...": "all 9 keys" },
    "patterns": [{ "name": "Personal packaged policy", "components": ["Coverages", "Terms"] }],
  },
  "lobs": [
    // every L2 family shown under this segment; products reference one by name
    {
      "name": "Auto / Motor",
      "appliesTo": "Personal auto",
      "componentsExtended": "Vehicles; drivers; territories",
    },
  ],
  "products": [
    {
      "name": "PA Personal Auto 6-mo",
      "lob": "Auto / Motor",
      "runsIn": "PAS B",
      "description": "Six-month personal auto policy ...",
      "versions": [
        {
          "version": "v9",
          "jurisdiction": "US-CA",
          "effective": "Eff. 03/2026",
          "status": "Active", // Active | Bound | Renewal only | Runoff | Expired
          "components": [
            {
              "name": "Coverages", // one entry per canonical component, all 9
              "owner": "Product operations", // optional, defaults above
              "expression": "Packaged perils",
              "items": [
                {
                  "name": "Bodily Injury Liability",
                  "description": "Pays damages for third-party injury the insured is legally liable for; CA statutory minimum 15/30.",
                  "livesIn": "PAS B — coverage master CVG-AUTO, code BI; limits table LMT-BI",
                  "format": "System config", // optional; seed derives from livesIn when omitted
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
```

Rules: real insurance content only (real coverage names, ISO form numbers,
statutory rules, rating factors) — no "Coverage 1"/generic filler. Systems
must stay consistent with the segment's estate. Items may repeat across
versions of a product with jurisdiction-specific differences called out.
