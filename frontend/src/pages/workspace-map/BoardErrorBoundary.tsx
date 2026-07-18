import { Component, type ReactNode } from 'react';
import { Button, ErrorMessage } from '../../components/ui';

// Error boundary around the Workspace board: a data-shape hiccup in one
// comparison (e.g. boards with nothing in common) must degrade to a message
// with a reset — never blank the whole tab.
export default class BoardErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <ErrorMessage baseClassName="text-sm text-red-600">
          This comparison hit an error rendering the board. The applications may have nothing in
          common yet — reset the comparison and try again.
        </ErrorMessage>
        <Button
          onClick={() => {
            // Remount the board (parent bumps its key) so stale state can't
            // immediately re-crash.
            this.props.onReset?.();
            this.setState({ error: null });
          }}
        >
          Reset comparison
        </Button>
      </div>
    );
  }
}
