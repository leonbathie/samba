/**
 * Niveau 3 — La rivière aux cascades.
 * Ponts, pierres de gué, pirogues et crocodiles. Près de la grande cascade, une pierre gravée
 * donne le deuxième indice ; un coffre se cache derrière un rideau d'eau.
 */
import type { LevelDef } from '../types';
import { LevelBuilder, THEMES } from './builder';

export function niveau3(): LevelDef {
  const b = new LevelBuilder('riviere', 3, 'level.3', THEMES.riviere, { width: 176, spawn: { x: 3, y: 0.05 } });
  const W = -1.15;
  b.water(0, 176, W);

  // ---- terrain
  b.ground(0, 16).bridge(16, 26).ground(26, 40);
  b.plat(41.4, -0.2, 1.7, 'gue').plat(45, 0.15, 1.7, 'gue').plat(48.6, -0.1, 1.7, 'gue');
  b.plat(52.2, 0.35, 1.7, 'gue').plat(55.8, 0, 1.7, 'gue').plat(59.3, -0.2, 1.7, 'gue');
  b.ground(62, 78).plat(65.6, 2.2, 2.6).branch(68.2, 3.8, 6.8, 'right');
  b.mover(79.2, -0.5, 3.4, 'pirogue', 8.4, 0, 7);
  b.plat(92.4, 0.4, 2.2, 'pilotis').plat(96.6, 1.2, 2.2, 'pilotis').plat(100.6, 0.6, 2.2, 'pilotis');
  b.ground(104, 124).ledge(107.4, 110, 1.0, 0).ledge(110, 124, 2.0, 0);
  b.plat(125.6, 1.2, 2.2, 'pilotis');
  b.mover(129.4, -0.5, 3.4, 'pirogue', 8, 0, 8, 0.5);
  b.plat(141.4, 0.1, 1.7, 'gue').plat(144.8, 0.4, 1.7, 'gue');
  b.ground(148.2, 176);

  // ---- la grande cascade : au fond, puis un rideau d'eau au premier plan qui cache un coffre
  b.fall(117, 13.5, 6.5, 11.6, -1.6).fall(122.4, 12.6, 3.6, 10.7, 0.7, 0.96);
  b.chest('r.coffre', 122.6, 2.0, { coins: 10, gem: 1 });
  b.rock(116.4, 2.0, 1.6, -0.3);
  b.decor('items/parchemin', 116.4, 3.15, 0.55, { z: -0.25, center: true, glow: { color: 0xffe08a, size: 1.9 } });
  b.npc({
    id: 'stele', char: 'conteuse', ghost: true, x: 116.4, y: 2.0, promptY: 2.3, reach: 1.3, prompt: 'prompt.read',
    talk: async (g) => {
      if (g.has('indice2')) return g.say('narrateur', 'dlg.stele.rappel');
      await g.say('narrateur', 'dlg.stele.1');
      await g.say('narrateur', 'dlg.stele.2');
      g.setFlag('indice2');
      g.sfx('secret');
      g.toast('toast.indice', undefined, 'items/parchemin');
      g.ui.hud();
      await g.say('ousmane', 'dlg.stele.3');
    },
  });

  // ---- décor
  b.baobab(8, 0, 9, -6).hut(21, 0, 3.8, -5).acacia(33, 0, 5.5, -8).baobab(75.6, 0, 8.4, -1.3).acacia(66, 0, 5, -9);
  b.hut(112, 2, 3.6, -4, true).baobab(106, 0, 9.5, -7).acacia(152, 0, 6, -7).baobab(163, 0, 9, -5).hut(170, 0, 4, -3.4);
  b.dress(0, 16).dress(26, 40).dress(62, 78).dress(148.2, 176).dress(110, 121, 2);
  for (const x of [18, 23, 43.5, 50.6, 57.6, 84, 89, 95, 99, 127, 135, 139.6, 143.4, 147]) b.lily(x, W, 0.28 + (x % 3) * 0.04);
  for (const x of [15.4, 26.6, 39.6, 62.4, 77.6, 104.4, 123.6, 148.6]) b.rock(x, W + 0.15, 0.9, 0.5, x % 2 > 1);
  b.lantern(70.5, 2.9).lantern(73.5, 2.9).lantern(109, 3.4, -2).lantern(160, 3.2, -2);
  b.foliage(72, 5.2, 3, -1.5).foliage(77, 6, 3, -1.8, true);
  b.bird(30, 7.6).bird(100, 8.4, 'props/oiseau', 0.9, -6, 2.6, 30).bird(150, 7.8);

  // ---- habitants de la rive
  b.walker('femme_kente', 150, 168, -1.4, 0.8).walker('enfant_garcon', 2, 14, -1.2, 1.3);

  // ---- pièces et objets
  b.coins(6, 1.1, 4).arc(16.5, 25.5, 1.3, 1.2, 8).coins(30, 1.1, 4);
  for (const x of [42.2, 45.8, 49.4, 53, 56.6, 60.1]) b.item('coin', x, 1.5);
  b.coins(66, 3.0, 2).coins(69.4, 4.6, 5).arc(80, 90.5, 0.6, 1.4, 7).coins(93, 1.3, 2).coins(97.2, 2.1, 2).coins(101.2, 1.5, 2);
  b.coins(111, 3.0, 5).arc(124.5, 129, 2.4, 1.0, 4).arc(130.5, 140, 0.6, 1.4, 7).coins(142, 1.0, 2).coins(145.4, 1.3, 2).coins(153, 1.1, 5);
  b.item('pile', 29, 0.45).item('bunch', 63.4, 0.5).item('heart', 97.7, 2.6).item('pile', 105.4, 0.45);
  b.item('key', 74.2, 4.6, { id: 'r.cle' }).item('feather', 60.1, 2.6, { id: 'r.plume' });
  b.chest('r.coffre2', 164.4, 0, { coins: 8, heart: 1, feather: 1 }, { locked: true });

  // ---- aides et points de sauvegarde
  b.sign(5, 0, 'sign.water').sign(37, 0, 'sign.croc').sign(76, 0, 'sign.pirogue').sign(111.4, 2.0, 'sign.secret');
  b.checkpoint(28).checkpoint(63.6).checkpoint(105.6).checkpoint(150);

  // ---- animaux
  b.enemy('croc', 50, W, { x0: 42, x1: 60 });
  b.enemy('singe', 71.2, 3.8, { ammo: 'mix' });
  b.enemy('croc', 85, W, { x0: 79, x1: 92 });
  b.enemy('croc', 134, W, { x0: 128, x1: 141 });
  b.enemy('serpent', 158.4, 0.02);

  b.exit(172, 0, (g) => g.has('indice2'), 'lock.indice2');
  b.def.objective = (g) => (g.has('indice2') ? 'obj.3b' : 'obj.3a');
  return b.build();
}
