import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  // Los paquetes del monorepo se empaquetan dentro del bundle; las dependencias
  // de npm quedan externas y se instalan en la imagen con `pnpm deploy`.
  deps: { alwaysBundle: [/^@storynido\//] },
});
