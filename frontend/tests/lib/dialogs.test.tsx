// dialogs — the promise-based in-app confirm/prompt/alert replacements.
// Renders the provider with a trigger component and asserts resolution values.
import { useState, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DialogProvider, useDialogs } from '../../src/lib/dialogs';
import type { ConfirmOptions, PromptOptions } from '../../src/lib/dialogs';

// Harness: a button that fires the given dialog and records its resolution.
function ConfirmHarness({ opts }: { opts: ConfirmOptions }) {
  const dialogs = useDialogs();
  const [result, setResult] = useState('pending');
  const open = () => {
    dialogs.confirm(opts).then((v) => setResult(String(v)));
  };
  return <button onClick={open}>open:{result}</button>;
}

function PromptHarness({ opts }: { opts: PromptOptions }) {
  const dialogs = useDialogs();
  const [result, setResult] = useState<string>('pending');
  const open = () => {
    dialogs.prompt(opts).then((v) => setResult(v === null ? 'null' : v));
  };
  return <button onClick={open}>open:{result}</button>;
}

function AlertHarness({ message }: { message: string }) {
  const dialogs = useDialogs();
  const [result, setResult] = useState('pending');
  const open = () => {
    dialogs.alert(message).then(() => setResult('done'));
  };
  return <button onClick={open}>open:{result}</button>;
}

const withProvider = (ui: ReactElement) => render(<DialogProvider>{ui}</DialogProvider>);

describe('useDialogs', () => {
  it('throws outside a <DialogProvider>', () => {
    const Naked = () => {
      useDialogs();
      return null;
    };
    expect(() => render(<Naked />)).toThrow('useDialogs must be used inside <DialogProvider>');
  });
});

describe('confirm', () => {
  it('resolves true on Confirm', async () => {
    withProvider(<ConfirmHarness opts={{ title: 'Delete this row?' }} />);
    fireEvent.click(screen.getByText('open:pending'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete this row?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(screen.getByText('open:true')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves false on Cancel', async () => {
    withProvider(<ConfirmHarness opts={{ title: 'Sure?' }} />);
    fireEvent.click(screen.getByText('open:pending'));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.getByText('open:false')).toBeInTheDocument());
  });

  it('resolves false when the backdrop is clicked', async () => {
    withProvider(<ConfirmHarness opts={{ title: 'Sure?' }} />);
    fireEvent.click(screen.getByText('open:pending'));
    fireEvent.click(screen.getByRole('dialog')); // the backdrop root
    await waitFor(() => expect(screen.getByText('open:false')).toBeInTheDocument());
  });

  it('danger mode relabels the confirm button to Delete', () => {
    withProvider(<ConfirmHarness opts={{ title: 'Remove company?', danger: true }} />);
    fireEvent.click(screen.getByText('open:pending'));
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('typedConfirm keeps Confirm disabled until the exact label is typed', async () => {
    withProvider(<ConfirmHarness opts={{ title: 'Cascade delete', typedConfirm: 'Acme' }} />);
    fireEvent.click(screen.getByText('open:pending'));

    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn).toBeDisabled();

    const input = document.querySelector('input.input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Acm' } });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Acme' } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    await waitFor(() => expect(screen.getByText('open:true')).toBeInTheDocument());
  });
});

describe('prompt', () => {
  it('resolves the trimmed input value on Save', async () => {
    withProvider(<PromptHarness opts={{ title: 'New value stream', label: 'Name' }} />);
    fireEvent.click(screen.getByText('open:pending'));

    const saveBtn = screen.getByText('Save');
    expect(saveBtn).toBeDisabled(); // empty input → not ready

    const input = document.querySelector('input.input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Claims  ' } });
    fireEvent.click(saveBtn);
    await waitFor(() => expect(screen.getByText('open:Claims')).toBeInTheDocument());
  });

  it('submits on Enter', async () => {
    withProvider(<PromptHarness opts={{ title: 'Name it', initial: 'Seed' }} />);
    fireEvent.click(screen.getByText('open:pending'));
    const input = document.querySelector('input.input') as HTMLInputElement;
    expect(input.value).toBe('Seed'); // initial value pre-filled
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('open:Seed')).toBeInTheDocument());
  });

  it('resolves null on Cancel', async () => {
    withProvider(<PromptHarness opts={{ title: 'Name it' }} />);
    fireEvent.click(screen.getByText('open:pending'));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.getByText('open:null')).toBeInTheDocument());
  });
});

describe('alert', () => {
  it('accepts a plain string, shows the fallback title, and resolves on OK', async () => {
    withProvider(<AlertHarness message="Something went sideways." />);
    fireEvent.click(screen.getByText('open:pending'));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument(); // default title
    expect(screen.getByText('Something went sideways.')).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument(); // alerts have no cancel

    fireEvent.click(screen.getByText('OK'));
    await waitFor(() => expect(screen.getByText('open:done')).toBeInTheDocument());
  });

  it('dismisses on Escape', async () => {
    withProvider(<AlertHarness message="Esc me" />);
    fireEvent.click(screen.getByText('open:pending'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.getByText('open:done')).toBeInTheDocument());
  });
});
