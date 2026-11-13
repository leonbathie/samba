#!/usr/bin/env node
/**
 * Prépare le studio des mouvements publié en lien (dist-studio/) : construction Vite en mode « studio »,
 * page d'entrée, et copie des seules images utiles (personnages, sol, décor du village, manifeste).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

execFileSync('npx', ['vite', 'build', '--mode', 'studio'], { stdio: 'inherit' });
copyFileSync('tools/studio/page.html', 'dist-studio/index.html');
const keep = (rel) =>
  rel === 'manifest.json' || rel.startsWith('hero/') || rel.startsWith('npc/') || rel.startsWith('enemies/') ||
  rel === 'props/sol_pierre.webp' || rel === 'bg/village.webp' || rel.startsWith('models/');
const files = [];
const walk = (dir, base = '') => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const rel = base ? `${base}/${f}` : f;
    if (statSync(p).isDirectory()) walk(p, rel);
    else if (keep(rel)) {
      const dest = join('dist-studio/assets', rel);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(p, dest);
      files.push(rel);
    }
  }
};
walk('public/assets');
console.log(`dist-studio : ${files.length + 3} fichiers`);
