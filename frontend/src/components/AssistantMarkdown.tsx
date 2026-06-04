import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import ChartBlock from './ChartBlock';

// Renders the assistant's reply as real Markdown — headings, GitHub-flavoured
// tables, lists, bold, inline code — instead of raw monospace text. A ```chart
// fenced block is intercepted and drawn as an inline SVG chart (see ChartBlock).

const components: Components = {
  h1: ({ children }) => <h1 className="text-base font-semibold text-[#171717] mt-3 mb-1.5 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold text-[#171717] mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[13px] font-semibold text-[#171717] mt-2.5 mb-1 first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="text-sm text-[#262626] leading-relaxed my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5 text-sm text-[#262626]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5 text-sm text-[#262626]">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[#171717]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-[#4338ca] underline decoration-[#c7d2fe] hover:decoration-[#4338ca]">{children}</a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#e5e7eb] pl-3 my-2 text-sm text-[#525252] italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-[#eaeaea]" />,
  // Pass through — block/chart styling lives in the `code` renderer below, so we
  // avoid react-markdown's default <pre> double-wrapping our own.
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-[#eaeaea]">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#fafafa]">{children}</thead>,
  th: ({ children }) => <th className="text-left px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#525252] border-b border-[#eaeaea]">{children}</th>,
  td: ({ children }) => <td className="px-3 py-1.5 text-[#262626] border-b border-[#f5f5f5] align-top">{children}</td>,
  code: ({ className, children }) => {
    const text = String(children ?? '');
    if (className?.includes('language-chart')) return <ChartBlock source={text} />;
    // Block code (has a language- class or contains newlines) vs short inline code.
    if (className || text.includes('\n')) {
      return (
        <pre className="my-2 overflow-x-auto rounded-lg bg-[#171717] p-3">
          <code className="text-[12px] font-mono text-[#e5e5e5] leading-relaxed">{text}</code>
        </pre>
      );
    }
    return <code className="rounded bg-[#f1f1f1] px-1 py-0.5 text-[12px] font-mono text-[#be185d]">{text}</code>;
  },
};

export default function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm text-[#262626]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
    </div>
  );
}
