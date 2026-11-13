#!/usr/bin/env node
/**
 * Prépare la version du jeu publiée sous forme de lien (artifact claude.ai) dans dist-lien/ :
 * construction Vite en mode « artifact », puis page d'entrée sans en-tête HTML (l'hébergeur l'ajoute).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

execFileSync('npx', ['vite', 'build', '--mode', 'artifact'], { stdio: 'inherit' });
copyFileSync('tools/artifact/page.html', 'dist-lien/index.html');

// La publication en lien ne sert pas les fichiers GLB : chaque modèle est intégré au catalogue
// (data: en base64) puis son fichier est retiré de la version publiée.
const catalogue = 'dist-lien/assets/models/models.json';
if (existsSync(catalogue)) {
  const doc = JSON.parse(readFileSync(catalogue, 'utf8'));
  for (const entree of Object.values(doc.characters ?? {})) {
    if (!entree.file?.endsWith('.glb')) continue;
    const chemin = join('dist-lien/assets/models', entree.file);
    if (!existsSync(chemin)) continue;
    entree.file = 'data:model/gltf-binary;base64,' + readFileSync(chemin).toString('base64');
    unlinkSync(chemin);
  }
  writeFileSync(catalogue, JSON.stringify(doc));
}

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative('dist-lien', p).split('\\').join('/'));
  }
};
walk('dist-lien');
const size = files.reduce((n, f) => n + statSync(join('dist-lien', f)).size, 0);
console.log(`dist-lien : ${files.length} fichiers, ${(size / 1e6).toFixed(1)} Mo`);
