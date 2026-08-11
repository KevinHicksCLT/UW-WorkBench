// ── Forms field plane seed data (SCRUM-229) ──
// The tenant field dictionary (ACORD-aware, one calculated composite, one
// do-not-map key) plus the extracted-field occurrences for the schedule-bearing
// manuscript forms (CPP Schedule A/B, OCIP covered parties, AL covered-aircraft
// schedule, PE portfolio-company schedule) and the GL demo forms. Ingested and
// τ-routed through the same suggestMapping pipeline the /field-mappings API uses.

export type DictEntry = {
  key: string;
  dataSetType: string;
  dataType?: string;
  acordRef?: string;
  stability?: 'stable' | 'do-not-map';
  compositionParts?: string[];
  compositionFormat?: string;
};

export type FieldSpec = {
  sourceName: string;
  label: string;
  widgetType?: string;
  options?: { label: string; exportValue: string }[];
  required?: boolean;
};

export const STATE_OPTIONS = [
  'NY',
  'NJ',
  'CT',
  'CA',
  'OR',
  'WA',
  'TX',
  'FL',
  'GA',
  'CO',
  'MI',
  'DE',
  'LA',
].map((s) => ({ label: s, exportValue: s }));

// Field-plane dictionary. insured.name.full is a calculated composite
// (get-only, INV-F2); legacy.insured.fein is do-not-map (INV-F1); ACORD-bearing
// keys defer semantics to ACORD (INV-F4). Extended for SCRUM-229 with the
// schedule / location / project / aircraft keys the manuscript forms ask for.
export const DICTIONARY: DictEntry[] = [
  { key: 'insured.name.first', dataSetType: 'Insured', dataType: 'string' },
  { key: 'insured.name.last', dataSetType: 'Insured', dataType: 'string' },
  {
    key: 'insured.name.full',
    dataSetType: 'Insured',
    dataType: 'string',
    compositionParts: ['insured.name.first', 'insured.name.last'],
    compositionFormat: '{First} {Last}',
  },
  {
    key: 'insured.entity.name',
    dataSetType: 'Insured',
    dataType: 'string',
    acordRef: 'ACORD:CommlName',
  },
  {
    key: 'insured.tax.fein',
    dataSetType: 'Identification',
    dataType: 'string',
    acordRef: 'ACORD:FEIN',
  },
  {
    key: 'policy.number',
    dataSetType: 'Policy',
    dataType: 'string',
    acordRef: 'ACORD:PolicyNumber',
  },
  {
    key: 'policy.form.number',
    dataSetType: 'Policy',
    dataType: 'string',
    acordRef: 'ACORD:FormNumberCd',
  },
  {
    key: 'policy.date.effective',
    dataSetType: 'Policy',
    dataType: 'date',
    acordRef: 'ACORD:EffectiveDt',
  },
  {
    key: 'policy.address.state',
    dataSetType: 'Location',
    dataType: 'choice',
    acordRef: 'ACORD:StateProvCd',
  },
  {
    key: 'location.address.line1',
    dataSetType: 'Location',
    dataType: 'string',
    acordRef: 'ACORD:Addr1',
  },
  {
    key: 'location.address.state',
    dataSetType: 'Location',
    dataType: 'choice',
    acordRef: 'ACORD:StateProvCd',
  },
  { key: 'location.value.building', dataSetType: 'Coverage', dataType: 'number' },
  { key: 'schedule.party.name', dataSetType: 'UserDefined', dataType: 'string' },
  { key: 'project.value.amount', dataSetType: 'Coverage', dataType: 'number' },
  { key: 'aircraft.registration.id', dataSetType: 'Vehicle', dataType: 'string' },
  { key: 'aircraft.weight.maxtakeoff', dataSetType: 'Vehicle', dataType: 'number' },
  { key: 'producer.name.full', dataSetType: 'Producer', dataType: 'string' },
  { key: 'signature.insured.sign', dataSetType: 'Signature', dataType: 'signature' },
  {
    key: 'legacy.insured.fein',
    dataSetType: 'Identification',
    dataType: 'string',
    stability: 'do-not-map',
  },
];

// Divergently-named fields asking the SAME questions across forms — the seed for
// the "same question, N phrasings" report (FORMS-HLR-020) and the τ-routed
// mapping suggestions. GL demo forms keep their original occurrences; the
// schedule-bearing manuscript forms add their schedule fields.
export const FIELDS: Record<string, FieldSpec[]> = {
  // ── GL demo set (unchanged from the shipped seed) ──
  'GL 20 10 A': [
    { sourceName: 'InsuredFirstName', label: 'Insured First Name', required: true },
    { sourceName: 'InsuredLastName', label: 'Insured Last Name', required: true },
    { sourceName: 'InsuredFEIN', label: 'FEIN', required: true },
    { sourceName: 'PolicyNumber', label: 'Policy Number', required: true },
    { sourceName: 'EffectiveDate', label: 'Effective Date', widgetType: 'date' },
    { sourceName: 'State', label: 'State', widgetType: 'choice', options: STATE_OPTIONS },
    { sourceName: 'InsuredSignature', label: 'Signature of Insured', widgetType: 'signature' },
  ],
  'GL 20 10 E': [
    { sourceName: 'FirstNameOfInsured', label: 'First Name of Named Insured', required: true },
    { sourceName: 'LastNameOfInsured', label: 'Last Name of Named Insured', required: true },
    { sourceName: 'FederalEIN', label: 'Federal Employer ID Number', required: true },
    { sourceName: 'PolicyNo', label: 'Policy No.' },
    { sourceName: 'PolEffDate', label: 'Policy Effective Date', widgetType: 'date' },
    { sourceName: 'RiskState', label: 'Risk State', widgetType: 'choice', options: STATE_OPTIONS },
  ],
  'GL 02 20': [
    { sourceName: 'NamedInsuredFEIN', label: 'Named Insured FEIN' },
    { sourceName: 'PolicyNumberField', label: 'Policy #', required: true },
    { sourceName: 'EffDt', label: 'Eff. Date', widgetType: 'date' },
    { sourceName: 'ProducerFullName', label: 'Producer Name' },
  ],
  // ── CPP 1016 — Schedule A (locations) + Schedule B (suppliers/customers) ──
  'CPP 1016': [
    { sourceName: 'FormNumber', label: 'Form Number' },
    { sourceName: 'PolicyNumber', label: 'Policy Number', required: true },
    { sourceName: 'EffectiveDate', label: 'Effective Date', widgetType: 'date' },
    { sourceName: 'ScheduleALocationAddress', label: 'Location Address', required: true },
    {
      sourceName: 'ScheduleALocationState',
      label: 'Location State',
      widgetType: 'choice',
      options: STATE_OPTIONS,
    },
    { sourceName: 'ScheduleABuildingValue', label: 'Building Value', widgetType: 'text' },
    { sourceName: 'ScheduleBSupplierName', label: 'Supplier Name' },
    { sourceName: 'ScheduleBCustomerName', label: 'Customer Name' },
  ],
  // ── OCIP 1017 — Schedule of Covered Parties ──
  'OCIP 1017': [
    { sourceName: 'PolicyNumber', label: 'Policy Number', required: true },
    { sourceName: 'ProjectOwnerName', label: 'Project Owner Name', required: true },
    { sourceName: 'GeneralContractorName', label: 'General Contractor Name', required: true },
    { sourceName: 'EnrolledSubcontractorName', label: 'Enrolled Subcontractor Name' },
    { sourceName: 'ProjectValue', label: 'Project Value' },
  ],
  // ── AL 1022 — Schedule of Covered Aircraft ──
  'AL 1022': [
    { sourceName: 'PolicyNumber', label: 'Policy Number', required: true },
    { sourceName: 'AircraftRegistration', label: 'Aircraft Registration Number', required: true },
    { sourceName: 'AircraftMakeModel', label: 'Aircraft Make and Model' },
    { sourceName: 'MaxTakeoffWeight', label: 'Maximum Takeoff Weight (lbs)' },
    { sourceName: 'PilotName', label: 'Pilot in Command' },
  ],
  // ── PE 1221 — Schedule A (portfolio companies) ──
  'PE 1221': [
    { sourceName: 'PolicyNumber', label: 'Policy Number', required: true },
    { sourceName: 'PortfolioCompanyName', label: 'Portfolio Company Name', required: true },
    {
      sourceName: 'PortfolioCompanyState',
      label: 'State of Incorporation',
      widgetType: 'choice',
      options: STATE_OPTIONS,
    },
    { sourceName: 'AcquisitionDate', label: 'Acquisition Date', widgetType: 'date' },
  ],
};
