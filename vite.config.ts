import { defineConfig } from 'vite';

// base relative : le jeu fonctionne aussi bien à la racine d'un domaine que dans un sous-dossier.
export default defineConfig({
  base: './',
  build: {
    target: 'es2021',
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
} as never);
