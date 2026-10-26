import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Los tests de integración comparten el mismo emulador de Firestore y limpian colecciones:
    // en paralelo se pisarían entre archivos.
    fileParallelism: false,
  },
});
