/**
 * Structured renderer for multi-line procedure values authored as
 * "By the <role>:\n1) <action>\n…\nDone when/Pass when <condition>".
 * The key/title is rendered by the caller; this lays out the byline, the
 * actions as dash bullets and the closing condition on its own line.
 * Single-line values fall back to plain inline text so profile facts keep
 * their "key: value" one-liner layout.
 */
export default function ProcedureValue({ value }: { value: string }) {
  const lines = value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return <span className="whitespace-pre-line">{value}</span>;
  return (
    <>
      {lines.map((ln, i) => {
        if (/^(Done|Pass) when\b/i.test(ln))
          return (
            <span key={i} className="block font-medium mt-0.5">
              {ln}
            </span>
          );
        if (/^By the .+:$/.test(ln))
          return (
            <span key={i} className="block">
              {ln}
            </span>
          );
        return (
          <span key={i} className="block pl-3">
            <span className="text-[#8a94a0]">- </span>
            {ln.replace(/^\d+[.)]\s*/, '')}
          </span>
        );
      })}
    </>
  );
}
