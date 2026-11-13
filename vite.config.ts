import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Deux constructions :
 *  - normale (`npm run build`) : tout est regroupé dans dist/, à déposer sur n'importe quel hébergement ;
 *  - « artifact » (`npm run build:lien`) : version publiée sous forme de lien claude.ai, où Three.js est
 *    chargé depuis un CDN autorisé (carte d'imports) et la police depuis Google Fonts.
 */
export default defineConfig(({ mode }) => {
  if (mode === 'studio') {
    // Studio des mouvements publié en lien : même principe que le jeu (Three.js depuis le CDN).
    return {
      base: './',
      // Les images utiles sont copiées une à une par tools/studio/build.mjs.
      publicDir: false,
      build: {
        target: 'es2021',
        outDir: 'dist-studio',
        emptyOutDir: true,
        rollupOptions: {
          input: resolve(__dirname, 'src/studio/main.ts'),
          external: ['three', /^three\/examples\/jsm\//],
          output: { format: 'es', entryFileNames: 'assets/studio.js', assetFileNames: 'assets/studio[extname]' },
        },
      },
    };
  }
  if (mode === 'artifact') {
    return {
      base: './',
      resolve: {
        alias: [{ find: /^@fontsource\/baloo-2\/.*\.css$/, replacement: resolve(__dirname, 'src/styles/empty.css') }],
      },
      build: {
        target: 'es2021',
        outDir: 'dist-lien',
        emptyOutDir: true,
        rollupOptions: {
          input: resolve(__dirname, 'src/main.ts'),
          external: ['three', /^three\/examples\/jsm\//],
          output: {
            format: 'es',
            entryFileNames: 'assets/jeu.js',
            assetFileNames: 'assets/jeu[extname]',
          },
        },
      },
    };
  }
  return {
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
  } as never;
});
