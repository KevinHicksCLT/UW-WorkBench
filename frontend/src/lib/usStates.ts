// US jurisdiction names — anywhere a state code surfaces in the UI it should
// read as a PLACE ("California (CA)"), never leak the data model's version
// naming ("US-CA — own state form").

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

/** "CA" → "California (CA)"; unknown codes fall back to "US-XX". */
export function stateLabel(code: string): string {
  return STATE_NAMES[code] ? `${STATE_NAMES[code]} (${code})` : `US-${code}`;
}

/** Version-node display name → place vocabulary:
 *  "v2 — US-CA" → "v2 · California"; "v2 — Countrywide" → "v2 · Countrywide". */
export function versionPlaceLabel(name: string): string {
  const token = name.split(/[\s—–]+/).filter(Boolean)[0] ?? name;
  const st = /US-([A-Z]{2})\b/.exec(name)?.[1];
  if (st) return `${token} · ${STATE_NAMES[st] ?? `US-${st}`}`;
  if (/countrywide/i.test(name)) return `${token} · Countrywide`;
  return name;
}
