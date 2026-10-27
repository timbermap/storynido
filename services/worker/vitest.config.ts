import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Los tests de integración comparten el emulador de Firestore y limpian colecciones.
    fileParallelism: false,
    // Maquetar un libro (Chromium + imágenes 2K) tarda más que el límite por defecto, sobre todo en CI.
    testTimeout: 60_000,
  },
});
