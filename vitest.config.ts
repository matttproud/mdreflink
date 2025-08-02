import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    snapshotFormat: {
      // Suppress printing type information in the snapshots for concision.
      printBasicPrototype: false,
    },
  },
});
