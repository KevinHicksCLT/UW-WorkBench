#!/usr/bin/env bash
# Behavioral baseline capture — records API response bodies + timings from the
# pre-refactor backend so the refactored app can be diffed against them.
# Usage: bash capture-api.sh <outdir>
set -u
BASE=http://localhost:4000
OUT="${1:-api}"
mkdir -p "$OUT"

TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"kevin.hicks@capgemini.com","password":"demo1234"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
if [ -z "$TOKEN" ]; then echo "LOGIN FAILED"; exit 1; fi

ENDPOINTS=(
  "/auth/me"
  "/companies"
  "/dashboard"
  "/explorer/overview"
  "/explorer/tree"
  "/explorer/org-table"
  "/explorer/standards"
  "/explorer/standards-flat"
  "/explorer/value-streams"
  "/explorer/value-stream-adoption"
  "/roles"
  "/roles/org-chart"
  "/applications"
  "/external-interactions"
  "/work?tab=deliverables"
  "/work?tab=tasks"
  "/work-library/templates"
  "/portfolio/dashboard"
  "/portfolio/programs"
  "/portfolio/initiatives"
  "/portfolio/risk-bands"
  "/rationalization"
  "/rationalization/vocabulary?domain=APPLICATION"
  "/rationalization/vocabulary?domain=PRODUCT_MODEL"
  "/product-models"
  "/regulations/overview"
  "/regulations/jurisdictions"
  "/regulations/federal"
  "/regulations/international"
  "/regulations/requirements"
  "/standards-skills"
  "/search?q=payroll"
  "/audit?limit=200"
  "/admin/_meta"
)

echo "endpoint,status,ms,bytes" > "$OUT/_timings.csv"
for EP in "${ENDPOINTS[@]}"; do
  FN=$(echo "$EP" | sed 's|^/||; s|[/?&=]|_|g')
  RES=$(curl -s -o "$OUT/$FN.json" -w "%{http_code},%{time_total},%{size_download}" \
    -H "Authorization: Bearer $TOKEN" "$BASE$EP")
  STATUS=${RES%%,*}; REST=${RES#*,}; T=${REST%%,*}; BYTES=${REST#*,}
  MS=$(python -c "print(round($T*1000))")
  echo "$EP,$STATUS,$MS,$BYTES" >> "$OUT/_timings.csv"
  echo "$EP -> $STATUS ${MS}ms ${BYTES}b"
done

# Board detail bodies (id-dependent, so resolved at capture time): the first
# workspace of each domain, via the same detail endpoint the board loads.
WS_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/rationalization" \
  | python -c "import sys,json;d=json.load(sys.stdin);w=d if isinstance(d,list) else [];print(w[0]['id'] if w else '')" 2>/dev/null)
if [ -n "$WS_ID" ]; then
  curl -s -o "$OUT/rationalization_detail_first.json" \
    -H "Authorization: Bearer $TOKEN" "$BASE/rationalization/$WS_ID"
  echo "/rationalization/$WS_ID -> captured (rationalization_detail_first.json)"
fi
echo "done."
