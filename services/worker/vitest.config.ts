import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Los tests de integración comparten el emulador de Firestore y limpian colecciones.
    fileParallelism: false,
  },
});
