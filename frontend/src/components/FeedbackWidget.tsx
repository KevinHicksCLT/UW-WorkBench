import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { domToBlob } from 'modern-screenshot';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from '@cascade/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Input, Label, Select, Textarea, ErrorMessage } from './ui';

// Header feedback button + NON-BLOCKING right-side panel. Deliberately not
// ui/DrawerShell: that shell is modal (dimming click-to-dismiss backdrop +
// aria-modal), and this panel must leave the page fully interactive — the
// user keeps scrolling/typing/reviewing while writing feedback, Inspector-
// style. The panel chrome (border, header row, scrollable body) mirrors the
// drawer look so it reads as the same family.
//
// A screenshot of the current view is captured SILENTLY at submit time — no
// preview, no toggle; the panel excludes itself from the capture so the image
// shows exactly what the user was looking at. Submit is ONE multipart
// POST /api/feedback; route, commit SHA, and user agent ride along
// automatically (tenant/user come from the JWT server-side). On failure the
// typed text is preserved and retry offered. The button hides itself when
// feedback.config.json disables it.

type FeedbackConfig = { enabled: boolean };

const PANEL_WIDTH = 380;

export default function FeedbackWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<FeedbackCategory | ''>('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .get<FeedbackConfig>('/feedback/config')
      .then((c) => setEnabled(c.enabled))
      .catch(() => setEnabled(false));
  }, [user]);

  // Escape closes the panel (never steals the key while typing elsewhere —
  // only when the panel is open).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!enabled || !user) return null;

  // Silent capture of the current view, taken at submit time so it shows the
  // state the user is actually looking at. The panel excludes itself via the
  // filter. Failure (tainted canvas, unsupported browser) degrades gracefully
  // — the submission simply goes without a screenshot.
  const captureScreenshot = async (): Promise<Blob | null> => {
    try {
      return await domToBlob(document.body, {
        type: 'image/jpeg',
        quality: 0.85,
        scale: 1,
        filter: (node) => !(node instanceof Element && node.id === 'feedback-panel'),
      });
    } catch {
      return null;
    }
  };

  const openPanel = () => {
    setError(null);
    setSent(false);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setError(null);
    // Deliberately keep `text`/`category`/`name`: closing after a failed
    // submit must not lose what the user typed.
    if (sent) {
      setText('');
      setCategory('');
      setName('');
      setSent(false);
    }
  };

  const submit = async () => {
    if (!text.trim() || !category || submitting) return;
    setSubmitting(true);
    setError(null);
    const screenshot = await captureScreenshot();
    const form = new FormData();
    form.append('text', text.trim());
    form.append('category', category);
    if (name.trim()) form.append('name', name.trim());
    form.append('route', location.pathname + location.search);
    form.append('commitSha', __COMMIT_SHA__);
    form.append('userAgent', navigator.userAgent);
    if (screenshot) form.append('screenshot', screenshot, 'screenshot.jpg');
    try {
      await api.upload('/feedback', form);
      setSent(true);
      setText('');
      setCategory('');
      setName('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Submission failed — your text is preserved, try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Header launcher */}
      <button
        onClick={() => (open ? close() : openPanel())}
        title="Send feedback"
        aria-label="Send feedback"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[#525252] hover:bg-[#fafafa] transition-colors duration-150"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="hidden lg:inline">Feedback</span>
      </button>

      {/* Portal to <body>: the header has transformed/filtered ancestors that
          would turn `fixed` into ancestor-relative and clip the panel. */}
      {open &&
        createPortal(
          <aside
            id="feedback-panel"
            role="complementary"
            aria-label="Send feedback"
            className="fixed right-0 top-12 bottom-0 z-40 bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col"
            style={{ width: PANEL_WIDTH, maxWidth: '94vw' }}
          >
            {/* Header row — mirrors the DrawerShell chrome */}
            <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
                  Feedback
                </div>
                <h2 className="text-sm font-semibold text-[#171717]">Send feedback</h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  The page stays live — keep browsing while you write.
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {sent ? (
                <div className="py-6 text-center">
                  <p className="text-sm font-medium text-[#171717]">Thanks — feedback received.</p>
                  <p className="mt-1 text-xs text-[#737373]">
                    It is being triaged into the backlog automatically.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button variant="secondary" onClick={() => setSent(false)}>
                      Send another
                    </Button>
                    <Button onClick={close}>Done</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="feedback-category">Category</Label>
                    <Select
                      id="feedback-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as FeedbackCategory | '')}
                    >
                      <option value="" disabled>
                        What kind of feedback is this?
                      </option>
                      {FEEDBACK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {FEEDBACK_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="feedback-name">Name (optional)</Label>
                    <Input
                      id="feedback-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Who is this from?"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <Label htmlFor="feedback-text">Feedback</Label>
                    <Textarea
                      id="feedback-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={6}
                      placeholder="What's broken, confusing, or missing?"
                      maxLength={10000}
                      autoFocus
                    />
                  </div>

                  {error && <ErrorMessage>{error}</ErrorMessage>}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="secondary" onClick={close} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button onClick={submit} disabled={!text.trim() || !category || submitting}>
                      {submitting ? 'Sending…' : error ? 'Retry' : 'Submit'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>,
          document.body,
        )}
    </>
  );
}
