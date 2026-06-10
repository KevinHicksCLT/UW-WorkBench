// Value-stream name mapping. IDENTITY since the 29-stream canonicalization
// (gap backlog X3/S1/S2, 2026-06-10): the canonical value-stream set IS the 29
// workbook L4-Master streams, names verbatim from the ValueStream table — no
// renames, no folds. The earlier 29→21 consolidation (audit/value-stream-mapping.md)
// was reversed because the accepted backlog requires 1:1 source parity across
// Value Streams / Telemetry / Home / Work.
//
// The helpers are kept so call sites (explorer.ts, valueStreams.ts, backfill
// scripts) stay stable should a future mapping ever be needed.

export const VS_MAPPING: Record<string, string> = {};

// No synthesized streams: all 29 canonical streams exist as ValueStream rows.
export const NEW_STREAMS: { name: string; division: string }[] = [];

// Resolve a legacy value-stream name to its canonical node name (identity).
export const canonicalVs = (legacyName: string): string => VS_MAPPING[legacyName] ?? legacyName;

// Canonical stream name → legacy ValueStream names that feed it (itself only).
const LEGACY_FOR: Record<string, string[]> = {};
for (const [legacy, canon] of Object.entries(VS_MAPPING)) (LEGACY_FOR[canon] ??= []).push(legacy);
export const legacyNamesFor = (canonical: string): string[] => [...new Set([...(LEGACY_FOR[canonical] ?? []), canonical])];
