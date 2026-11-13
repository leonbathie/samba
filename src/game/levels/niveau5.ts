/**
 * Niveau 5 — La mangrove.
 * Racines, plateformes de bois sur pilotis et pirogues. Des chemins écartés, en hauteur, cachent
 * les trois jarres de Penda la pêcheuse, qui connaît le dernier indice.
 */
import type { LevelDef } from '../types';
import type { Game } from '../Game';
import { LevelBuilder, THEMES } from './builder';

export function niveau5(): LevelDef {
  const b = new LevelBuilder('mangrove', 5, 'level.5', THEMES.mangrove, { width: 190, spawn: { x: 3, y: 0.35 } });
  const W = -1.0;
  b.water(0, 190, W);
  const P = (x: number, y: number): LevelBuilder => b.plat(x, y, 2.2, 'pilotis');

  // ---- terrain
  b.ground(0, 12, 0.3);
  P(13.6, 0.3); P(17.6, 0.9); P(21.6, 0.4);
  b.mover(25.2, -0.4, 3.4, 'pirogue', 8, 0, 7);
  P(37.8, 0.5);
  b.trunk(38.4, 2.4, -4, 13).branch(40.6, 1.6, 6.8, 'left').liane(45.2, 1.6, 5.4).branch(40.6, 5.4, 8.8, 'left');
  P(49.6, 0.4); P(53.6, 0.2);
  b.mover(57.4, -0.4, 3.4, 'pirogue', 7.6, 0, 7.5, 0.3);
  b.ledge(68.4, 81, 0.5, -4).plat(70.4, 2.6, 2.4).trunk(80.6, 2.4, -4, 12).branch(72.6, 4.4, 8.2, 'right');
  P(83, 0.6); P(87, 1.2); P(91, 0.5);
  b.mover(94.6, 0.6, 2.4, 'motif', 0, 3.0, 5);
  b.trunk(104.8, 2.4, -4, 12).branch(97.6, 4.2, 7.4, 'right');
  b.mover(97.5, -0.4, 3.4, 'pirogue', 6.5, 0, 7, 0.6);
  P(109, 0.6); P(113, 0.3);
  b.ledge(116.4, 127, 0.6, -4);
  P(129, 0.9); P(133, 0.5);
  b.mover(136.6, -0.4, 3.4, 'pirogue', 9.4, 0, 8);
  P(150, 0.6); P(154, 1.3); P(158, 0.7);
  b.trunk(167.4, 2.4, -4, 11).branch(160.8, 1.8, 6.8, 'right');
  P(170.2, 0.6);
  b.ground(173, 190, 0.4);

  // ---- décor : racines, feuillages, lanternes, nénuphars
  for (const [x, flip] of [[38, false], [80.4, true], [104.6, false], [167.2, true], [2, false], [186, true]] as [number, boolean][]) {
    b.decor('props/racines', x, W - 0.3, 3.2, { z: -0.9, flip });
  }
  b.foliage(42, 9, 3.4, -1.4).foliage(78, 8.2, 3.4, -1.5, true).foliage(102, 8, 3.4, -1.4).foliage(165, 6.4, 3.2, -1.5, true);
  b.foliage(4, 7.6, 3.6, 2.2, false, 0.92).foliage(120, 8, 3.6, 2.4, true, 0.92);
  b.dress(0, 12, 0.3).dress(68.4, 81, 0.5).dress(116.4, 127, 0.6).dress(173, 190, 0.4);
  for (const x of [15, 20, 30, 36, 51.6, 62, 85, 93, 107, 111, 131, 142, 152.6, 162, 171.4]) b.lily(x, W, 0.26 + (x % 4) * 0.03);
  b.lantern(43, 4.5).lantern(47, 0.7).lantern(75, 3.5).lantern(100, 3.3).lantern(120, 3.3, -2).lantern(163.5, 0.9).lantern(180, 3.4, -2);
  b.bird(40, 8, 'props/oiseau', 0.9, -6, 2.4, 30).bird(110, 9).bird(160, 8.2, 'props/oiseau', 0.9, -5, 2.8, 24);

  // ---- pièces et objets
  b.coins(5, 1.4, 3).coins(14.2, 1.2, 2).coins(18.2, 1.8, 2).coins(22.2, 1.3, 2).arc(26, 36, 0.7, 1.3, 7);
  b.coins(41.6, 2.4, 4).coins(45.2, 2.8, 3, 0, 0.9).coins(42, 6.2, 5).coins(50.2, 1.3, 2).arc(58, 67.5, 0.7, 1.3, 7);
  b.coins(71, 3.4, 2).coins(74, 5.2, 5).coins(83.6, 1.5, 2).coins(87.6, 2.1, 2).coins(95.8, 2.2, 3, 0, 1.0);
  b.coins(98.4, 5.0, 4).arc(98.5, 106.5, 0.7, 1.2, 6).coins(118, 1.7, 5).arc(137.5, 148.5, 0.7, 1.3, 8).coins(154.6, 2.2, 2).coins(161.6, 2.6, 5);
  b.item('pile', 8.6, 0.75).item('bunch', 69.6, 0.95).item('heart', 87.9, 2.7).item('pile', 117.4, 1.05).item('heart', 162, 3.2);
  b.item('key', 41.6, 6.25, { id: 'm.cle' });
  const jar = (id: string, x: number, y: number): LevelBuilder =>
    b.item('quest', x, y, { id, img: 'props/pot', flag: 'jarres', toast: 'toast.jarre' });
  jar('m.jarre1', 48.2, 6.15);
  jar('m.jarre2', 79.4, 5.15);
  jar('m.jarre3', 103.6, 4.95);
  b.chest('m.coffre', 124.2, 0.6, { coins: 10, gem: 1, heart: 1 }, { locked: true });

  // ---- aides et points de sauvegarde
  b.sign(10.4, 0.3, 'sign.pirogue').sign(66.4 + 3.6, 0.5, 'sign.secret');
  b.checkpoint(69.6, 0.5).checkpoint(117.6, 0.6);

  // ---- animaux
  b.enemy('singe', 43, 5.4, { ammo: 'banana' });
  b.enemy('croc', 54, W, { x0: 48, x1: 66 });
  b.enemy('serpent', 76.4, 0.52);
  b.enemy('croc', 88, W, { x0: 82, x1: 96 });
  b.enemy('singe', 100.2, 4.2, { ammo: 'stone' });
  b.enemy('croc', 142, W, { x0: 135, x1: 150 });
  b.enemy('singe', 163.6, 1.8, { ammo: 'mix' });

  // ---- Penda la pêcheuse : au départ, puis à l'embarcadère
  b.npc({
    id: 'penda1', char: 'femme_kente', x: 7.2, y: 0.3, facing: -1,
    talk: async (g) => {
      if (g.has('indice3')) return g.say('pecheuse', 'dlg.penda.rappel');
      if (g.questActive('jarres')) return g.say('pecheuse', 'dlg.penda.rappel');
      await g.say('pecheuse', 'dlg.penda.1');
      await g.say('pecheuse', 'dlg.penda.2');
      await g.say('pecheuse', 'dlg.penda.3');
      g.startQuest('jarres');
    },
  });
  const arrivee = async (g: Game): Promise<void> => {
    if (!g.has('indice3')) {
      if (!g.progress.quests.jarres) return g.say('pecheuse', 'dlg.penda.attente');
      const missing = 3 - g.flag('jarres');
      if (missing > 0) return g.say('pecheuse', 'dlg.penda.manque', { n: missing });
      await g.say('pecheuse', 'dlg.penda.merci');
      await g.say('pecheuse', 'dlg.penda.indice');
      g.setFlag('indice3');
      g.sfx('secret');
      g.toast('toast.indice', undefined, 'items/parchemin');
      g.completeQuest('jarres');
    }
    await g.say('pecheuse', 'dlg.penda.pirogue');
    g.completeLevel();
  };
  b.npc({ id: 'penda2', char: 'femme_kente', x: 180, y: 0.4, facing: -1, talk: arrivee });
  b.decor('props/pirogue', 185.4, W - 0.25, 0.75, { z: 0.36, sway: 0.025 });

  b.def.objective = (g) => (g.progress.quests.jarres ? 'obj.5b' : 'obj.5a');
  return b.build();
}
