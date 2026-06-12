import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import AssistantMarkdown from './AssistantMarkdown';

// Floating AI Assistant — a launcher button (bottom-right) that opens a chat
// popup, available on every page. The backend (/chat) answers each question by
// writing and running read-only SQL against the operating_model data, then
// replying in prose. The SQL it ran is shown (collapsed) under each answer.

type Query = { query: string; rowCount: number; error?: string };
type Msg = { role: 'user' | 'assistant'; content: string; queries?: Query[] };

const DEFAULT_SUGGESTIONS = [
  'How many roles are there, by role level?',
  'Which value streams have the most roles?',
  'Which roles have the most checklist items?',
];

const ORG_SUGGESTIONS = [
  'How many roles are there, by role level?',
  'Which departments have the most roles?',
  'Which roles have the most checklist items?',
];

const PROCESS_SUGGESTIONS = [
  'Which value streams have the most process steps?',
  'Which L4 processes have the most L5 steps?',
  'Which roles lead the most process steps?',
];

// Suggested starter questions per screen — first matching path prefix wins,
// falling back to DEFAULT_SUGGESTIONS.
const SUGGESTIONS_BY_SCREEN: [prefix: string, suggestions: string[]][] = [
  ['/standards', [
    'How many individual standards are there, by standards area?',
    'List the individual actuarial standards we have to validate',
    'Which roles own the most individual standards?',
  ]],
  ['/roles', ORG_SUGGESTIONS],
  ['/divisions', ORG_SUGGESTIONS],
  ['/departments', ORG_SUGGESTIONS],
  ['/overview', PROCESS_SUGGESTIONS],
  ['/n/', PROCESS_SUGGESTIONS],
  ['/metrics', [
    'Which value streams have the most metrics?',
    'How many metrics are there, by metric category?',
    'Which roles own the most metrics?',
  ]],
  ['/applications', [
    'Which applications have the highest total annual TCO?',
    'How does application TCO break down by primary division?',
    'Which value streams are linked to the most applications?',
  ]],
  ['/work', [
    'Which roles are named on the most deliverables and outputs?',
    'Which L4 processes have the most inputs and outputs?',
    'Which process steps involve external participants?',
  ]],
];

function suggestionsFor(pathname: string): string[] {
  return SUGGESTIONS_BY_SCREEN.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? DEFAULT_SUGGESTIONS;
}

export default function AssistantWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, open]);

  // Focus the composer when the popup opens; close on Escape.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const history = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post('/chat', { messages: history });
      setMessages([...next, { role: 'assistant', content: res.answer, queries: res.queries }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setMessages(next); // keep the question; drop the failed answer
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center h-12 w-12 rounded-full bg-[#171717] text-white shadow-lg hover:bg-[#404040] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#171717] transition-colors duration-150"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Popup panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Bridge Assistant"
          className={
            'fixed z-40 bg-white border border-[#eaeaea] shadow-2xl flex flex-col ' +
            'inset-x-3 bottom-3 top-16 rounded-2xl ' +
            'sm:inset-auto sm:bottom-20 sm:right-5 sm:top-auto sm:max-h-[calc(100vh-7rem)] ' +
            (expanded ? 'sm:w-[760px] sm:h-[85vh]' : 'sm:w-[400px] sm:h-[600px]')
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#eaeaea]">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#171717] text-white" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <div>
                <div className="text-sm font-semibold text-[#171717] leading-tight">Bridge Assistant</div>
                <div className="text-[11px] text-[#a3a3a3] leading-tight">Get AI insights on the transformation</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setError(null); }}
                  className="text-[11px] text-[#a3a3a3] hover:text-[#525252] px-2 py-1 transition-colors duration-150"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? 'Shrink window' : 'Expand window'}
                title={expanded ? 'Shrink' : 'Expand'}
                className="hidden sm:inline-flex p-1.5 rounded-md text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa] transition-colors duration-150"
              >
                {expanded ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 9H4M9 9V4M9 9 4 4M15 9h5M15 9V4M15 9l5-5M9 15H4M9 15v5M9 15l-5 5M15 15h5M15 15v5M15 15l5 5" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-md text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa] transition-colors duration-150"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="text-xs text-[#737373] max-w-[16rem]">
                  Ask about roles, value streams, processes, or checklists — or for analysis and recommendations. Facts come from the data; charts and tables render inline.
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  {suggestionsFor(pathname).map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs rounded-lg border border-[#eaeaea] bg-[#fafafa] px-3 py-2 text-[#404040] hover:border-[#d4d4d4] hover:bg-white transition-colors duration-150"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-[#171717] px-3.5 py-2 text-sm text-white whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex flex-col gap-1.5">
                  <AssistantMarkdown content={m.content} />
                  {m.queries && m.queries.length > 0 && <QueryDisclosure queries={m.queries} />}
                </div>
              ),
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#a3a3a3] animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#a3a3a3] animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#a3a3a3] animate-bounce" />
                </span>
                Querying the data…
              </div>
            )}

            {error && <div className="text-xs text-red-600">{error}</div>}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="border-t border-[#eaeaea] p-3 flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask about the operating model…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-[#eaeaea] bg-white px-3.5 py-2 text-sm text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-1 focus:ring-[#171717] focus:border-[#171717] transition-colors duration-150 max-h-32"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-[#171717] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#404040] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// Collapsible list of the SQL the assistant ran for an answer.
function QueryDisclosure({ queries }: { queries: Query[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-[#a3a3a3] hover:text-[#525252] transition-colors duration-150"
      >
        {open ? '▾' : '▸'} {queries.length} quer{queries.length === 1 ? 'y' : 'ies'} run
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {queries.map((q, i) => (
            <div key={i} className="rounded-lg border border-[#eaeaea] bg-[#fafafa] p-2.5">
              <pre className="text-[11px] text-[#404040] whitespace-pre-wrap font-mono leading-relaxed">{q.query}</pre>
              <div className={'mt-1 text-[10px] ' + (q.error ? 'text-red-500' : 'text-[#a3a3a3]')}>
                {q.error ? `error: ${q.error}` : `${q.rowCount} row${q.rowCount === 1 ? '' : 's'}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
