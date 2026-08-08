// SDLC View — the composite deliverable map: every underwriting value-chain
// step as a card (numbered flow), with the UW-WORK capabilities, requirement
// refs, guarding invariants, the implementing artifacts in THIS app, and the
// source SDLC deliverables it derives from. Data lives in sdlcData.ts.
import { Card, Chip, StatusPill } from '../../components/ui';
import { SDLC_STEPS, type SdlcStep } from './sdlcData';

function RefRow({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#737373] w-24 shrink-0">
        {label}
      </span>
      {items.map((i) => (
        <Chip key={i}>{i}</Chip>
      ))}
    </div>
  );
}

function StepCard({ s }: { s: SdlcStep }) {
  return (
    <Card className="p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#171717] text-[11px] font-semibold text-white tnum">
          {s.step}
        </span>
        <h3 className="text-sm font-semibold text-[#171717]">{s.title}</h3>
        {s.gap && <StatusPill tone="amber">documented gap — not yet implemented</StatusPill>}
      </div>
      <p className="text-[12px] leading-relaxed text-[#525252]">{s.summary}</p>
      <div className="space-y-1.5">
        <RefRow label="Capabilities" items={s.capabilities} />
        <RefRow label="Requirements" items={s.requirements} />
        <RefRow label="Invariants" items={s.invariants} />
      </div>
      <div className="mt-auto border-t border-[#f0f0f0] pt-2 space-y-1">
        <div className="text-[11px] text-[#525252]">
          <span className="font-semibold text-[#171717]">Implements: </span>
          {s.implementedBy.api.length ? (
            <>
              {s.implementedBy.api.map((a) => (
                <code
                  key={a}
                  className="mr-1.5 rounded bg-[#f5f5f5] px-1 py-0.5 text-[10px] text-[#171717]"
                >
                  {a}
                </code>
              ))}
              <span className="text-[#737373]">· {s.implementedBy.screen}</span>
            </>
          ) : (
            <span className="text-[#a3a3a3]">not yet implemented in this app</span>
          )}
        </div>
        <div className="text-[11px] text-[#737373]">
          <span className="font-semibold text-[#525252]">Derived from: </span>
          {s.derivedFrom.join(' · ')}
        </div>
      </div>
    </Card>
  );
}

export default function SdlcComposite() {
  return (
    <div>
      <p className="text-[11px] text-[#737373] mb-3">
        The composite SDLC deliverable map — each value-chain step traced from its design lineage
        (the UW-WORK v0.1 requirements workbook, HLD, LLD, wireframes, ontology, and validation
        spec, plus the RATE-PRICING and FORMS-RATION module design sets) through capabilities,
        requirements, and invariants to the artifacts that implement it in this app.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SDLC_STEPS.map((s) => (
          <StepCard key={s.step} s={s} />
        ))}
      </div>
    </div>
  );
}
