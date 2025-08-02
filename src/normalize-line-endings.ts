// Normalize line endings for cross-platform compatibility (registered in
// vitest.config.ts).
import {expect} from 'vitest';

// Custom matcher to normalize line endings in snapshots.
expect.addSnapshotSerializer({
  test: (value: unknown): value is string => typeof value === 'string',
  serialize: (value: string): string => {
    // Use to LF (\n) for consistent snapshots.
    return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  },
});
