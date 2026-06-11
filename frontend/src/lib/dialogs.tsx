import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ─── In-app dialogs ──────────────────────────────────────────────────────────
// Promise-based replacements for window.confirm / prompt / alert so the app
// never opens a native browser popup. Usage:
//
//   const dialogs = useDialogs();
//   if (!(await dialogs.confirm({ title: 'Delete this row?', danger: true }))) return;
//   const name = await dialogs.prompt({ title: 'New value stream', label: 'Name' });
//   await dialogs.alert('Something went wrong.');
//
// `typedConfirm` makes destructive confirms require typing the exact label
// (used for cascading deletes — company, model subtrees).

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  typedConfirm?: string;
};

export type PromptOptions = {
  title: string;
  message?: ReactNode;
  label?: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
};

export type AlertOptions = { title?: string; message: ReactNode };

type Dialogs = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  alert: (opts: AlertOptions | string) => Promise<void>;
};

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void };

const DialogContext = createContext<Dialogs | null>(null);

export function useDialogs(): Dialogs {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ kind: 'confirm', opts, resolve })),
    [],
  );
  const prompt = useCallback(
    (opts: PromptOptions) => new Promise<string | null>((resolve) => setPending({ kind: 'prompt', opts, resolve })),
    [],
  );
  const alert = useCallback(
    (opts: AlertOptions | string) =>
      new Promise<void>((resolve) =>
        setPending({ kind: 'alert', opts: typeof opts === 'string' ? { message: opts } : opts, resolve }),
      ),
    [],
  );

  const api = useRef<Dialogs>({ confirm, prompt, alert });

  return (
    <DialogContext.Provider value={api.current}>
      {children}
      {pending && <DialogModal pending={pending} onDone={() => setPending(null)} />}
    </DialogContext.Provider>
  );
}

function DialogModal({ pending, onDone }: { pending: Pending; onDone: () => void }) {
  const [text, setText] = useState(pending.kind === 'prompt' ? (pending.opts.initial ?? '') : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const needsInput = pending.kind === 'prompt' || (pending.kind === 'confirm' && pending.opts.typedConfirm);
  useEffect(() => {
    (needsInput ? inputRef : confirmRef).current?.focus();
  }, [needsInput]);

  const cancel = () => {
    if (pending.kind === 'confirm') pending.resolve(false);
    else if (pending.kind === 'prompt') pending.resolve(null);
    else pending.resolve();
    onDone();
  };

  const ready =
    pending.kind === 'alert' ||
    (pending.kind === 'prompt' ? text.trim().length > 0 : !pending.opts.typedConfirm || text === pending.opts.typedConfirm);

  const submit = () => {
    if (!ready) return;
    if (pending.kind === 'confirm') pending.resolve(true);
    else if (pending.kind === 'prompt') pending.resolve(text.trim());
    else pending.resolve();
    onDone();
  };

  const danger = pending.kind === 'confirm' && pending.opts.danger;
  const title =
    pending.kind === 'alert' ? (pending.opts.title ?? 'Something went wrong') : pending.opts.title;
  const confirmLabel =
    pending.kind === 'alert' ? 'OK' : (pending.opts.confirmLabel ?? (pending.kind === 'prompt' ? 'Save' : danger ? 'Delete' : 'Confirm'));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={cancel}
      onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div className="card-elevated bg-white max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className={'text-base font-semibold mb-2 ' + (danger ? 'text-[#9f1239]' : 'text-[#171717]')}>{title}</h3>
        {pending.opts.message && <div className="text-sm text-[#525252] mb-3">{pending.opts.message}</div>}

        {pending.kind === 'prompt' && (
          <>
            {pending.opts.label && <label className="label">{pending.opts.label}</label>}
            <input
              ref={inputRef}
              className="input"
              value={text}
              placeholder={pending.opts.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </>
        )}

        {pending.kind === 'confirm' && pending.opts.typedConfirm && (
          <>
            <label className="label">
              Type <span className="font-mono text-[#171717]">{pending.opts.typedConfirm}</span> to confirm
            </label>
            <input
              ref={inputRef}
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </>
        )}

        <div className="flex justify-end gap-2 mt-4">
          {pending.kind !== 'alert' && (
            <button
              className="text-sm px-3 py-1.5 rounded-md border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa]"
              onClick={cancel}
            >
              {(pending.opts as ConfirmOptions).cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            ref={confirmRef}
            disabled={!ready}
            onClick={submit}
            className={
              'text-sm px-3 py-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed ' +
              (danger ? 'bg-[#be123c] text-white hover:bg-[#9f1239]' : 'bg-[#171717] text-white hover:bg-[#333333]')
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
