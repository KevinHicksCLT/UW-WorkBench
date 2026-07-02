// Test-tree setup: register React Testing Library's cleanup manually.
// RTL only auto-registers its afterEach cleanup when test globals are enabled;
// this project runs vitest with explicit imports (globals off), so without this
// hook rendered DOM would accumulate across tests within a file.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
