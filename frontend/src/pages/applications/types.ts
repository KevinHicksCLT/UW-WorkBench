// Shared row shape for the Applications list/kind pages (GET /applications).
export type App = {
  id: string;
  code: string | null;
  name: string;
  kind: string;
  category: string | null;
  vendor: string | null;
  criticality: string;
  description: string | null;
  scanStatus: string; // NOT_SCANNED | SCANNED
  systemOfRecord: boolean | null;
  illustrative: boolean;
  totalTco: number | null;
  primaryDivisionName: string | null;
  stepUsages: number;
  sorDeliverables: number;
  valueStreams: string[];
  roles: { id: string; name: string }[];
};
