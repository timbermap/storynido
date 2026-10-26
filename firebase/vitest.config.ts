import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Los tests comparten el emulador: se corren en serie.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
