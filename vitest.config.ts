import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    snapshotFormat: {
      // Suppress printing type information in the snapshots for concision.
      printBasicPrototype: false,
    },
    // Set up cross-platform line ending normalization
    setupFiles: ['./src/normalize-line-endings.ts'],
  },
});
