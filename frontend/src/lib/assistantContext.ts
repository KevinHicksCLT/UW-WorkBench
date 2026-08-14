// A tiny context bus for the bottom-right AI assistant: views that hold rich
// selection context (e.g. a Forms Rationalization form or cluster comparison)
// publish a plain-text context detail here; AssistantWidget appends it to the
// pageContext label it already sends with every /chat call (7/28 "assistant
// lacks context" fix). Module-level on purpose — the widget and the publishing
// view live in different trees.

let detail: string | null = null;

/** Publish (or clear with null) the active view's assistant context detail. */
export function setAssistantDetail(d: string | null): void {
  detail = d;
}

/** The current context detail, read by AssistantWidget at send time. */
export function assistantDetail(): string | null {
  return detail;
}

/** Ask the assistant widget to open (e.g. "Ask about this comparison"). */
export function openAssistant(): void {
  window.dispatchEvent(new CustomEvent('assistant:open'));
}
