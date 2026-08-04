import { useEffect } from 'react';

// Breadcrumb stub — the Transformation Bridge platform renders a visited-path
// trail in its global header; this single-module app has no trail to walk, so
// the hook keeps the same signature (PageHeader calls it verbatim) and simply
// reflects the page title into the document title.
export function useRegisterCrumb(label: string) {
  useEffect(() => {
    document.title = `${label} · UW WorkBench`;
  }, [label]);
}
