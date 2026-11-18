import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Las pruebas de fotos (sharp) tardan más cuando Turborepo corre los paquetes en paralelo en el CI (DECISIONS 260).
    testTimeout: 30_000,
  },
});
