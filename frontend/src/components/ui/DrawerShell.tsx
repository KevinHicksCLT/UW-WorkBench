import type { ReactNode } from 'react';

/** Props for {@link DrawerShell}. */
export interface DrawerShellProps {
  /** Called when the backdrop or the close button is clicked. */
  onClose: () => void;
  /** Panel width in px — rendered as an inline style (e.g. `720`). */
  width: number;
  /** Inline max-width (e.g. `'94vw'`). */
  maxWidth: string;
  /**
   * Left side of the header row — each drawer keeps its exact original
   * eyebrow/title/subtitle markup and passes it here verbatim.
   */
  header: ReactNode;
  /** Scrollable body content, rendered inside the `flex-1 overflow-y-auto p-5` div. */
  children: ReactNode;
  /**
   * Extra nodes rendered after the panel but inside the dialog root — e.g. a
   * nested full-screen overlay such as the StandardDrawer's SkillViewer.
   */
  after?: ReactNode;
}

/**
 * Shared right-side slide-over chrome: dialog root, click-to-dismiss backdrop,
 * white bordered panel, header row with close button, and scrollable body.
 * Extracted verbatim from RoleDrawer / ValueStreamDrawer / StandardDrawer —
 * the emitted DOM is byte-identical to the shells it replaces; only
 * width/maxWidth and the header/body content vary per drawer.
 */
export function DrawerShell({ onClose, width, maxWidth, header, children, after }: DrawerShellProps) {
  return (
    <div className="absolute inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop dims the canvas; click to dismiss. */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <aside className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col" style={{ width, maxWidth }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
          {header}
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>

      {after}
    </div>
  );
}
