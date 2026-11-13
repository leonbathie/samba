#!/usr/bin/env node
/**
 * Test de bout en bout dans un vrai navigateur (Chromium piloté par Playwright).
 *
 *   npm run test:e2e                 lance un serveur Vite temporaire puis joue les scénarios
 *   E2E_URL=http://... npm run test:e2e   utilise un serveur déjà démarré
 *   E2E_SHOTS=dossier npm run test:e2e    enregistre une capture à la fin de chaque scénario
 *
 * Les scénarios utilisent le clavier et les commandes tactiles comme un joueur. Pour gagner du
 * temps, le héros est parfois placé directement près de ce qu'il faut tester (window.__ousmane).
 * Playwright n'est pas une dépendance du projet : s'il manque, installez-le avec
 *   npm i -D playwright && npx playwright install chromium
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright est introuvable. Installez-le : npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const SHOTS = process.env.E2E_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let server = null;
let base = process.env.E2E_URL;

async function startServer() {
  const port = 5199;
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return url;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('le serveur Vite ne répond pas');
}

/**
 * Petit modèle GLB fabriqué à la volée (une boîte de 1,6 de haut avec deux animations) :
 * il sert à vérifier que le jeu remplace bien la représentation provisoire par un modèle 3D.
 */
function makeTestGlb() {
  const pos = new Float32Array([
    -0.3, 0, -0.2, 0.3, 0, -0.2, 0.3, 1.6, -0.2, -0.3, 1.6, -0.2,
    -0.3, 0, 0.2, 0.3, 0, 0.2, 0.3, 1.6, 0.2, -0.3, 1.6, 0.2,
  ]);
  const idx = new Uint16Array([4, 5, 6, 4, 6, 7, 1, 0, 3, 1, 3, 2, 0, 4, 7, 0, 7, 3, 5, 1, 2, 5, 2, 6, 7, 6, 2, 7, 2, 3, 0, 1, 5, 0, 5, 4]);
  const times = new Float32Array([0, 1]);
  const rots = new Float32Array([0, 0, 0, 1, 0, 0.7071, 0, 0.7071]);
  const bin = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(idx.buffer), Buffer.from(times.buffer), Buffer.from(rots.buffer)]);
  const anim = (name) => ({
    name,
    channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
    samplers: [{ input: 2, output: 3, interpolation: 'LINEAR' }],
  });
  const json = {
    asset: { version: '2.0', generator: 'test Ousmane' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Corps', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.9, 0.6, 0.2, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 96, target: 34962 },
      { buffer: 0, byteOffset: 96, byteLength: 72, target: 34963 },
      { buffer: 0, byteOffset: 168, byteLength: 8 },
      { buffer: 0, byteOffset: 176, byteLength: 32 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-0.3, 0, -0.2], max: [0.3, 1.6, 0.2] },
      { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' },
      { bufferView: 2, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 3, componentType: 5126, count: 2, type: 'VEC4' },
    ],
    animations: [anim('repos'), anim('course')],
  };
  let jsonBuf = Buffer.from(JSON.stringify(json));
  if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)]);
  const binBuf = bin.length % 4 ? Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))]) : bin;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
  const chunk = (buf, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(buf.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, buf]);
  };
  return Buffer.concat([header, chunk(jsonBuf, 0x4e4f534a), chunk(binBuf, 0x004e4942)]);
}

const results = [];
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Outils communs à une page de jeu. */
function tools(page) {
  const st = () =>
    page.evaluate(() => {
      const a = window.__ousmane;
      const g = a.game;
      const s = g.stage;
      const p = s?.player;
      const pr = g.progress;
      return {
        mode: g.mode, level: s?.def.id ?? null, kind: s?.def.kind ?? null,
        x: p?.x ?? 0, y: p?.y ?? 0, vx: p?.body.vx ?? 0, ground: p?.body.onGround ?? false, state: p?.state ?? null,
        crouch: p?.crouch ?? false, invuln: p?.invuln ?? 0, hearts: pr.hearts, bananas: pr.bananas, stones: pr.stones,
        equipped: pr.equipped, checkpoint: pr.checkpoint, flags: pr.flags, coins: pr.coins,
        dialogue: !!document.querySelector('.dialogue'), screen: !!document.querySelector('.screen'),
      };
    });
  const place = (x, y, face = 1) =>
    page.evaluate(([x, y, face]) => {
      const p = window.__ousmane.game.stage.player;
      p.place(x, y);
      p.facing = face;
    }, [x, y, face]);
  const run = (fn, arg) => page.evaluate(fn, arg);
  const waitFor = async (fn, ms = 6000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await page.evaluate(fn, arg)) return true;
      await page.waitForTimeout(80);
    }
    return false;
  };
  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };
  /** Fait défiler un dialogue jusqu'au bout (en choisissant la première réponse). */
  const finishDialogue = async () => {
    for (let i = 0; i < 40; i++) {
      if (!(await page.evaluate(() => !!document.querySelector('.dialogue')))) return true;
      await page.keyboard.press('Space');
      await page.waitForTimeout(140);
    }
    return false;
  };
  const playing = () => waitFor(() => window.__ousmane?.game.mode === 'play', 30000);
  return { st, place, run, waitFor, hold, finishDialogue, playing };
}

async function scenario(name, page, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✔ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t0, err: err.message });
    console.log(`  ✘ ${name}\n      ${err.message}`);
  }
  if (SHOTS && page) {
    const file = `${SHOTS}/${String(results.length).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 70 }).catch(() => {});
  }
}

async function main() {
  if (!base) base = await startServer();
  const browser = await chromium.launch({ args: GL_ARGS });
  const errors = [];
  console.log('Les aventures d’Ousmane — tests de bout en bout\n');

  // ------------------------------------------------------------------ ordinateur (clavier)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const T = tools(page);

  await page.goto(base);
  await scenario('Écran d’accueil : Jouer, Continuer (grisé) et Paramètres', page, async () => {
    await page.waitForSelector('text=Jouer', { timeout: 30000 });
    assert(await page.isVisible('text=Paramètres'), 'bouton Paramètres absent');
    assert(await page.isDisabled('button:has-text("Continuer")'), 'Continuer devrait être grisé sans sauvegarde');
  });

  await scenario('Paramètres : langue anglaise puis française, réaffectation d’une touche', page, async () => {
    await page.click('text=Paramètres');
    await page.click('button:has-text("English")');
    await page.waitForSelector('text=Settings');
    await page.click('button:has-text("Français")');
    await page.waitForSelector('text=Paramètres');
    const jumpRow = page.locator('.keys-grid button').nth(4);
    await jumpRow.click();
    await page.keyboard.press('KeyU');
    const bound = await T.run(() => window.__ousmane.input.bindings.jump[0]);
    assert(bound === 'KeyU', 'la touche de saut devrait être U, obtenu ' + bound);
    const saved = await T.run(() => JSON.parse(localStorage.getItem('ousmane.settings.v1')).bindings.jump[0]);
    assert(saved === 'KeyU', 'la nouvelle touche n’est pas sauvegardée');
    await page.click('text=Touches par défaut');
    assert((await T.run(() => window.__ousmane.input.bindings.jump[0])) === 'Space', 'retour aux touches par défaut raté');
    await page.click('button:has-text("Retour")');
    await page.waitForSelector('text=Jouer');
  });

  await scenario('Jouer : le niveau 1 démarre avec trois cœurs', page, async () => {
    await page.click('text=Jouer');
    assert(await T.playing(), 'la partie ne démarre pas');
    const s = await T.st();
    assert(s.level === 'village', 'niveau inattendu ' + s.level);
    assert(s.hearts === 3, 'le héros devrait avoir 3 cœurs');
  });

  await scenario('Déplacement : flèches et touches de gauche (A en QWERTY / Q en AZERTY)', page, async () => {
    const a = await T.st();
    await page.keyboard.down('ArrowRight');
    const moved = await T.waitFor((x) => window.__ousmane.game.stage.player.x > x + 1.5, 4000, a.x);
    await page.keyboard.up('ArrowRight');
    const b = await T.st();
    assert(moved, `le héros n’avance pas (x ${a.x.toFixed(2)} → ${b.x.toFixed(2)})`);
    // On attend le résultat plutôt qu'une durée fixe : le rendu logiciel des tests peut être lent.
    await page.keyboard.down('KeyA');
    const back = await T.waitFor((x) => window.__ousmane.game.stage.player.x < x - 0.8, 4000, b.x);
    await page.keyboard.up('KeyA');
    assert(back, 'la touche de gauche ne fait pas reculer');
  });

  await scenario('Saut et retombée', page, async () => {
    await T.place(14, 0.05);
    await page.waitForTimeout(300);
    await page.keyboard.down('Space');
    let maxY = 0;
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(60);
      maxY = Math.max(maxY, (await T.st()).y);
    }
    await page.keyboard.up('Space');
    assert(maxY > 1.2, 'le saut est trop bas : ' + maxY.toFixed(2));
    assert(await T.waitFor(() => window.__ousmane.game.stage.player.body.onGround, 3000), 'le héros ne retombe pas');
  });

  await scenario('S’accroupir pour esquiver', page, async () => {
    await page.keyboard.down('ArrowDown');
    const crouched = await T.waitFor(() => window.__ousmane.game.stage.player.crouch, 2000);
    await page.keyboard.up('ArrowDown');
    assert(crouched, 'le héros ne s’accroupit pas');
  });

  await scenario('Dialogue avec les habitantes du village', page, async () => {
    await T.place(25.5, 0.05);
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    assert(await T.waitFor(() => !!document.querySelector('.dialogue .line')), 'pas de boîte de dialogue');
    const text = await page.textContent('.dialogue .speaker');
    assert(text && text.length > 2, 'le nom de l’interlocutrice manque');
    assert(await T.finishDialogue(), 'le dialogue ne se termine pas');
    assert(await T.playing(), 'le jeu ne reprend pas après le dialogue');
  });

  await scenario('Entrer dans une case, parler à Maman, ressortir au même endroit', page, async () => {
    await T.place(8.6, 0.05);
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    assert(await T.waitFor(() => window.__ousmane.game.stage?.def.id === 'famille' && window.__ousmane.game.mode === 'play', 8000), 'l’intérieur ne s’ouvre pas');
    await T.place(3.72, 1.27, 1);
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    assert(await T.waitFor(() => !!document.querySelector('.dialogue')), 'Maman ne parle pas');
    assert(await T.finishDialogue(), 'le dialogue de Maman ne se termine pas');
    await T.playing();
    const door = await T.run(() => window.__ousmane.game.stage.def.doors[0]);
    await T.place(door.x, door.y + 0.02, -1);
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    assert(await T.waitFor(() => window.__ousmane.game.stage?.def.id === 'village' && window.__ousmane.game.mode === 'play', 8000), 'retour au village raté');
    const s = await T.st();
    assert(Math.abs(s.x - 8.6) < 0.5, 'le héros n’est pas revenu devant la case (x=' + s.x.toFixed(2) + ')');
  });

  await scenario('Ramasser et lancer une banane, changer d’objet', page, async () => {
    await T.run(() => window.__ousmane.game.give('bananas', 3));
    await T.place(30, 0.05);
    await page.waitForTimeout(300);
    await T.run(() => (window.__ousmane.game.progress.equipped = 'banana'));
    const before = (await T.st()).bananas;
    await page.keyboard.press('KeyJ');
    assert(await T.waitFor(() => window.__ousmane.game.stage.projectiles.length > 0, 1500), 'aucun projectile');
    assert((await T.st()).bananas === before - 1, 'la réserve de bananes ne diminue pas');
    await page.keyboard.press('KeyL');
    assert(await T.waitFor(() => window.__ousmane.game.progress.equipped === 'stone', 2000), 'l’objet équipé ne change pas');
  });

  await scenario('Point de sauvegarde allumé et enregistré', page, async () => {
    await T.place(64.6, 0.05);
    assert(await T.waitFor(() => window.__ousmane.game.progress.checkpoint >= 0, 3000), 'le point de sauvegarde ne s’allume pas');
    const saved = await T.run(() => JSON.parse(localStorage.getItem('ousmane.progress.v1')).checkpoint);
    assert(saved >= 0, 'le point de sauvegarde n’est pas enregistré');
  });

  await scenario('Chute dans l’eau : un cœur perdu, retour au point de sauvegarde', page, async () => {
    await T.run(() => (window.__ousmane.game.progress.feathers = 0));
    const before = (await T.st()).hearts;
    await T.place(70, -1.0);
    assert(await T.waitFor(() => window.__ousmane.game.mode === 'play' && window.__ousmane.game.stage.player.state === 'normal' && window.__ousmane.game.stage.player.y > -0.1, 6000), 'le héros ne revient pas');
    const s = await T.st();
    assert(s.hearts === before - 1, `un cœur devrait être perdu (${before} → ${s.hearts})`);
    assert(Math.abs(s.x - 64.6) < 1, 'retour ailleurs qu’au point de sauvegarde : ' + s.x.toFixed(2));
  });

  await scenario('Défense : renvoyer un projectile', page, async () => {
    await T.place(80, 0.05, 1);
    await page.waitForTimeout(500);
    await T.run(() => {
      const st = window.__ousmane.game.stage;
      const p = st.player;
      st.spawnProjectile({ kind: 'stone', owner: 'enemy', x: p.x + 1.6, y: p.y + 1, vx: -5, vy: 0, grav: 0 });
    });
    await page.keyboard.press('KeyK');
    assert(await T.waitFor(() => window.__ousmane.game.stage.projectiles.some((p) => p.owner === 'player' && p.vx > 0), 1500), 'le projectile n’est pas renvoyé');
  });

  await scenario('Être touché : cœur perdu et protection temporaire', page, async () => {
    await page.waitForTimeout(1800);
    const before = (await T.st()).hearts;
    await T.run(() => {
      const st = window.__ousmane.game.stage;
      const p = st.player;
      st.spawnProjectile({ kind: 'stone', owner: 'enemy', x: p.x + 1.2, y: p.y + 0.8, vx: -6, vy: 0, grav: 0 });
    });
    assert(await T.waitFor((h) => window.__ousmane.game.progress.hearts < h, 2000, before), 'le héros n’est pas touché');
    const s = await T.st();
    assert(s.invuln > 0.5, 'pas de protection temporaire après la blessure');
  });

  await scenario('Lancer des pierres : le serpent s’enfuit', page, async () => {
    await T.run(() => {
      const g = window.__ousmane.game;
      g.give('stones', 6);
      g.progress.equipped = 'stone';
      g.progress.hearts = 3;
    });
    await T.place(103.6, 0.05, 1);
    await page.waitForTimeout(500);
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(650);
    }
    assert(await T.waitFor(() => !window.__ousmane.game.stage.enemies.some((e) => e.kind === 'serpent' && !e.gone), 3000), 'le serpent est toujours là');
  });

  await scenario('Fin du niveau 1 : bilan puis niveau 2', page, async () => {
    await T.run(() => window.__ousmane.game.setFlag('carte'));
    await T.place(146.5, 0.05);
    await page.waitForSelector('text=Niveau terminé', { timeout: 8000 });
    await page.click('text=Niveau suivant');
    assert(await T.waitFor(() => window.__ousmane.game.stage?.def.id === 'arbres' && window.__ousmane.game.mode === 'play', 15000), 'le niveau 2 ne démarre pas');
  });

  await scenario('Grimper à une liane jusqu’à la branche', page, async () => {
    await T.place(9.5, 0.05);
    await page.waitForTimeout(400);
    await page.keyboard.down('ArrowUp');
    assert(await T.waitFor(() => window.__ousmane.game.stage.player.state === 'climb', 1500), 'le héros n’attrape pas la liane');
    assert(await T.waitFor(() => window.__ousmane.game.stage.player.y > 4.1 && window.__ousmane.game.stage.player.body.onGround, 4000), 'le héros n’arrive pas sur la branche');
    await page.keyboard.up('ArrowUp');
  });

  await scenario('Se suspendre à une branche puis se hisser dessus', page, async () => {
    await T.place(8, 19.05);
    await page.waitForTimeout(500);
    await page.keyboard.down('Space');
    assert(await T.waitFor(() => window.__ousmane.game.stage.player.state === 'hang', 1500), 'le héros ne se suspend pas');
    await page.keyboard.up('Space');
    await T.hold('ArrowRight', 300);
    await page.keyboard.press('Space');
    assert(await T.waitFor(() => window.__ousmane.game.stage.player.body.onGround && window.__ousmane.game.stage.player.y > 22.5, 2500), 'le héros ne se hisse pas sur la branche');
  });

  await scenario('Une banane lancée apprivoise un singe', page, async () => {
    await T.run(() => {
      const g = window.__ousmane.game;
      g.give('bananas', 4);
      g.progress.equipped = 'banana';
    });
    await T.place(19.6, 7.05, 1);
    await page.waitForTimeout(400);
    for (let i = 0; i < 3 && !(await T.run(() => window.__ousmane.game.flag('monkeyFriends') > 0)); i++) {
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(900);
    }
    assert(await T.run(() => window.__ousmane.game.flag('monkeyFriends') > 0), 'le singe n’est pas apprivoisé');
  });

  await scenario('Pause avec Échap, puis reprise', page, async () => {
    await page.keyboard.press('Escape');
    await page.waitForSelector('text=Reprendre', { timeout: 3000 });
    assert(await T.run(() => window.__ousmane.paused), 'le jeu n’est pas en pause');
    await page.keyboard.press('Escape');
    assert(await T.waitFor(() => !window.__ousmane.paused, 2000), 'le jeu ne reprend pas');
  });

  await scenario('Sauvegarde : après rechargement, « Continuer » reprend le niveau 2', page, async () => {
    await T.run(() => window.__ousmane.save.saveProgress());
    await page.reload();
    await page.waitForSelector('text=Continuer', { timeout: 30000 });
    assert(!(await page.isDisabled('button:has-text("Continuer")')), 'Continuer reste grisé');
    await page.click('text=Continuer');
    assert(await T.waitFor(() => window.__ousmane.game.stage?.def.id === 'arbres' && window.__ousmane.game.mode === 'play', 20000), 'la partie sauvegardée ne reprend pas');
  });

  await scenario('Temple : clé, lance-pierre et énigme des trois signes', page, async () => {
    await page.goto(base + '?niveau=6');
    assert(await T.playing(), 'le niveau 6 ne démarre pas');
    await T.run(() => {
      const g = window.__ousmane.game;
      for (const f of ['cle', 'indice1', 'indice2', 'indice3']) g.setFlag(f);
      g.give('sling');
    });
    await T.place(119.3, 1.05);
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    assert(await T.waitFor(() => window.__ousmane.game.stage?.def.id === 'temple', 8000), 'la porte du temple ne s’ouvre pas');
    await page.waitForTimeout(600);
    await T.finishDialogue();
    await T.playing();
    // Un mauvais ordre éteint les signes.
    const order = await T.run(() => window.__ousmane.game.stage.targets.map((t) => ({ s: t.def.symbol, x: t.x })));
    const shoot = async (symbol) => {
      const tg = order.find((o) => o.s === symbol);
      await T.place(tg.x - 0.4, 1.22, 1);
      await page.waitForTimeout(250);
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(1100);
    };
    await shoot('eau');
    assert(await T.run(() => window.__ousmane.game.stage.targets.every((t) => !t.lit)), 'un mauvais signe ne devrait pas rester allumé');
    for (const s of ['soleil', 'eau', 'baobab']) {
      await shoot(s);
      await T.finishDialogue();
    }
    assert(await T.waitFor(() => window.__ousmane.game.has('templeOuvert'), 3000), 'l’énigme n’est pas résolue');
    assert(await T.run(() => !window.__ousmane.game.stage.solids.some((s) => s.off)), 'les pierres ne sont pas apparues');
  });


  // ------------------------------------------------------------------ modèles 3D et ressources manquantes
  const ctx3d = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'fr-FR' });
  const p3 = await ctx3d.newPage();
  p3.on('pageerror', (e) => errors.push(e.message));
  const D = tools(p3);
  await p3.route('**/assets/models/essai.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ characters: { hero: { file: 'essai-heros.glb', height: 1.7, yaw: 90, animations: { idle: 'repos', run: 'course' } } } }),
    }));
  await p3.route('**/assets/models/essai-heros.glb', (route) => route.fulfill({ contentType: 'model/gltf-binary', body: makeTestGlb() }));
  await p3.route('**/assets/npc/femme_rose.webp', (route) => route.fulfill({ status: 404, body: '' }));
  await p3.goto(base + '?niveau=1&modeles=essai.json');
  await scenario('Modèle 3D : un fichier GLB déclaré remplace le héros provisoire', p3, async () => {
    assert(await D.playing(), 'la partie ne démarre pas');
    assert(await D.waitFor(() => !window.__ousmane.game.stage.player.view.isPlaceholder, 10000), 'le modèle GLB n’a pas remplacé l’image provisoire');
    const info = await D.run(() => {
      const v = window.__ousmane.game.stage.player.view;
      let meshes = 0;
      v.root.traverse((o) => { if (o.isMesh && o.visible && o.geometry.attributes.position.count === 8) meshes++; });
      return { meshes, pose: v.pose };
    });
    assert(info.meshes === 1, 'le maillage du modèle n’est pas affiché');
    await p3.keyboard.down('ArrowRight');
    await D.waitFor(() => window.__ousmane.game.stage.player.view.pose === 'run', 3000);
    await p3.keyboard.up('ArrowRight');
  });

  await scenario('Ressource manquante : le jeu le signale et reste jouable', p3, async () => {
    const missing = await D.run(() => window.__ousmane.assets.missing);
    assert(missing.includes('npc/femme_rose'), 'l’image manquante n’est pas détectée : ' + JSON.stringify(missing));
    const x0 = (await D.st()).x;
    await p3.keyboard.down('ArrowLeft');
    const ok = await D.waitFor((x) => Math.abs(window.__ousmane.game.stage.player.x - x) > 1, 4000, x0);
    await p3.keyboard.up('ArrowLeft');
    assert(ok, 'le jeu ne répond plus après la ressource manquante');
  });
  await ctx3d.close();

  // ------------------------------------------------------------------ téléphone (tactile)
  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, locale: 'fr-FR', hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const mp = await phone.newPage();
  mp.on('pageerror', (e) => errors.push(e.message));
  const M = tools(mp);
  await mp.goto(base + '?niveau=1');
  await scenario('Téléphone : commandes tactiles visibles, sans cacher le héros', mp, async () => {
    assert(await M.playing(), 'la partie ne démarre pas sur téléphone');
    await M.place(20, 0.05);
    await mp.waitForTimeout(800);
    assert(await mp.isVisible('.pad'), 'la croix directionnelle est absente');
    assert(await mp.isVisible('.tb.jump'), 'le bouton de saut est absent');
    const overlap = await M.run(() => {
      const g = window.__ousmane.game;
      const p = g.stage.player;
      const a = g.view.toScreen(p.x - 0.4, p.y + 1.6);
      const b = g.view.toScreen(p.x + 0.4, p.y);
      const hero = { l: a.x, t: a.y, r: b.x, b: b.y };
      const hit = (sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return !(r.right < hero.l || r.left > hero.r || r.bottom < hero.t || r.top > hero.b);
      };
      return { pad: hit('.pad'), buttons: hit('.tbtns') };
    });
    assert(!overlap.pad && !overlap.buttons, 'les commandes recouvrent le héros : ' + JSON.stringify(overlap));
    const box = await mp.locator('.tb').first().boundingBox();
    assert(box && box.width >= 44 && box.height >= 44, 'boutons tactiles trop petits');
  });

  await scenario('Téléphone : la croix fait avancer, le bouton fait sauter', mp, async () => {
    const pad = await mp.locator('.pad').boundingBox();
    const a = await M.st();
    const px = pad.x + pad.width * 0.92;
    const py = pad.y + pad.height / 2;
    await mp.dispatchEvent('.pad', 'pointerdown', { pointerId: 7, clientX: px, clientY: py, pointerType: 'touch', isPrimary: true });
    const moved = await M.waitFor((x) => window.__ousmane.game.stage.player.x > x + 1.5, 4000, a.x);
    await mp.dispatchEvent('.pad', 'pointerup', { pointerId: 7, clientX: px, clientY: py, pointerType: 'touch' });
    assert(moved, 'la croix ne fait pas avancer le héros');
    await mp.waitForTimeout(300);
    await mp.dispatchEvent('.tb.jump', 'pointerdown', { pointerId: 8, pointerType: 'touch', isPrimary: true });
    let maxY = 0;
    for (let i = 0; i < 6; i++) {
      await mp.waitForTimeout(60);
      maxY = Math.max(maxY, (await M.st()).y);
    }
    await mp.dispatchEvent('.tb.jump', 'pointerup', { pointerId: 8, pointerType: 'touch' });
    assert(maxY > 1, 'le bouton de saut ne fait pas sauter');
  });

  await scenario('Téléphone : bouton d’interaction près d’une porte', mp, async () => {
    await M.place(8.6, 0.05);
    await mp.waitForTimeout(500);
    assert(await mp.isVisible('.tb.interact'), 'le bouton d’interaction n’apparaît pas');
    await mp.dispatchEvent('.tb.interact', 'pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true });
    await mp.waitForTimeout(100);
    await mp.dispatchEvent('.tb.interact', 'pointerup', { pointerId: 9, pointerType: 'touch' });
    assert(await M.waitFor(() => window.__ousmane.game.stage?.def.id === 'famille', 8000), 'la porte ne s’ouvre pas au toucher');
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  const realErrors = errors.filter((e) => !/favicon|GPU stall|WebGL/i.test(e));
  console.log(`\n${results.length - failed.length}/${results.length} scénarios réussis.`);
  if (realErrors.length) console.log('Erreurs dans la page :\n  ' + [...new Set(realErrors)].slice(0, 10).join('\n  '));
  return failed.length || realErrors.length ? 1 : 0;
}

main()
  .then((code) => {
    server?.kill();
    process.exit(code);
  })
  .catch((err) => {
    console.error(err);
    server?.kill();
    process.exit(1);
  });
