/**
 * Niveau 6 — La grotte et le temple secret.
 * Approche de nuit jusqu'à la porte cachée derrière la cascade, que la clé du vieux sage ouvre.
 * Dans le temple, il faut réveiller les trois signes au lance-pierre, dans l'ordre des indices,
 * pour faire surgir les pierres qui mènent au coffre.
 */
import type { LevelDef } from '../types';
import { LevelBuilder, RoomBuilder, THEMES, roomTheme } from './builder';
import { TEMPLE_ORDER, knownClues } from '../story';
import { t } from '../../i18n';

export function niveau6(): LevelDef {
  const b = new LevelBuilder('grotte', 6, 'level.6', THEMES.grotte, { width: 128, spawn: { x: 3, y: 0.05 } });
  const W = -1.2;
  b.water(18, 110, W);

  // ---- terrain
  b.ground(0, 20);
  b.plat(21.4, 0.3, 1.7, 'gue').plat(24.8, 0.8, 1.7, 'gue').plat(28.2, 1.4, 1.7, 'gue');
  b.ground(31, 42, 2.0).plat(36.4, 5.0, 2.6).ground(42, 58, 4.6).liane(42.1, 2.0, 4.6);
  b.plat(59.6, 3.2, 2.6).plat(63, 1.8, 2.6).ground(66, 84);
  b.mover(85.6, 0.4, 2.4, 'motif', 0, 2.2, 5);
  b.plat(90.4, 1.6, 2.2, 'pilotis').plat(94.6, 2.2, 2.2, 'pilotis');
  b.mover(98.2, 1.6, 2.4, 'motif', 3, 0, 5);
  b.ground(104.6, 128, 1.0);

  // ---- décor : cascade, lanternes, cristaux, entrée du temple
  b.fall(94, 15, 10, 16.4, -2.2, 0.95).fall(109, 13, 5, 12.2, -3, 0.8);
  b.decor('props/entree_grotte', 119.2, 0.75, 5.6, { z: -0.5 });
  b.decor('props/cristaux', 112.4, 1.0, 1.7, { z: -0.35, glow: { color: 0x7fe0ff, size: 2.6 } });
  b.decor('props/cristaux', 125.4, 1.0, 1.5, { z: -0.35, flip: true, glow: { color: 0x7fe0ff, size: 2.4 } });
  b.decor('props/cristaux', 35, 2.0, 1.4, { z: -0.35, glow: { color: 0x7fe0ff, size: 2.2 } });
  b.baobab(9, 0, 9.5, -6).acacia(50, 4.6, 5.5, -6).baobab(74, 0, 9, -7).hut(14.5, 0, 3.6, -4);
  b.dress(0, 20).dress(31, 42, 2).dress(42, 58, 4.6).dress(66, 84).dress(104.6, 128, 1);
  for (const [x, y] of [[6, 3.4], [16, 3.2], [33, 5.4], [47, 7.8], [55, 7.6], [70, 3.4], [80, 3.2], [107, 4.4], [115.6, 5.6], [122.8, 5.6]]) {
    b.lantern(x, y, -0.7);
  }
  for (const x of [22.8, 26.4, 60.6, 64.6, 87, 92.6, 96.4, 100.8]) b.lily(x, W, 0.28);
  b.foliage(5, 7.4, 3.6, 2.2, false, 0.9).foliage(60, 8.4, 3.4, 2.2, true, 0.9);

  // ---- pièces et objets
  b.coins(8, 1.1, 5).coins(22, 1.2, 1).coins(25.4, 1.7, 1).coins(28.8, 2.3, 1).coins(33, 3.1, 4);
  b.coins(42.1, 3.0, 3, 0, 0.8).coins(46, 5.7, 5).coins(60.2, 4.0, 2).coins(63.6, 2.6, 2).coins(69, 1.1, 5);
  b.coins(86.4, 1.6, 3, 0, 1.0).coins(91, 2.5, 2).coins(95.2, 3.1, 2).coins(108, 2.1, 5);
  b.item('pile', 5, 0.45).item('pile', 44.6, 5.05).item('heart', 64.2, 3.2).item('pile', 106, 1.45).item('pile', 115, 1.45);
  b.item('feather', 37.7, 5.8, { id: 'g.plume' });

  // ---- aides et points de sauvegarde
  b.checkpoint(45.4, 4.6).checkpoint(67.6).checkpoint(106.6, 1.0);
  b.trigger('arrivee', 86, 92, async (g) => g.say('ousmane', 'dlg.grotte.1'));

  // ---- animaux
  b.enemy('serpent', 13.4, 0.02);
  b.enemy('singe', 37.7, 5.0, { ammo: 'stone' });
  b.enemy('serpent', 52.6, 4.62);
  b.enemy('hyene', 75, 0.02, { x0: 67.5, x1: 83 });
  b.enemy('croc', 92, W, { x0: 86, x1: 103 });

  // ---- la porte du temple, derrière la cascade
  b.door({
    id: 'porte.temple', x: 119.3, y: 1.0, to: 'temple', label: 'prompt.enterTemple',
    canOpen: (g) => g.has('cle'), lockedText: 'lock.temple',
    onEnter: async (g) => {
      if (g.has('templeVu')) return;
      g.setFlag('templeVu');
      g.completeQuest('indices');
      g.startQuest('temple');
      await g.say('narrateur', 'dlg.temple.porte');
      await g.say('ousmane', 'dlg.temple.1');
    },
  });
  b.def.objective = (g) => (g.has('templeOuvert') ? 'obj.6c' : g.inRoom ? 'obj.6b' : 'obj.6a');
  return b.build();
}

/** Le temple secret : énigme des trois signes, pierres de gué et coffre final. */
export function templeSecret(): LevelDef {
  const r = new RoomBuilder({
    id: 'temple', name: 'room.temple', painting: 'rooms/temple', ppu: 197,
    theme: roomTheme(THEMES.grotte, ['cascade', 'grotte']), spawnPx: { x: 190, y: 705 },
  });
  r.def.theme.music = 'grotte';
  r.floor(0, 669, 705, 240).wallPx(0, 70, 0, 941).wallPx(1664, 1672, 0, 941);
  r.floor(1266, 1672, 525, 130);
  r.poolPx(669, 1266, 845);
  // Pierres qui surgissent de l'eau quand l'énigme est résolue.
  r.solid(3.5, 1.3, 0.9, 0.4, 'gue', { oneWay: true, hidden: true, id: 'p1' });
  r.solid(4.7, 1.55, 0.9, 0.4, 'gue', { oneWay: true, hidden: true, id: 'p2' });
  r.solid(5.82, 1.85, 0.75, 0.4, 'gue', { oneWay: true, hidden: true, id: 'p3' });
  r.door({ id: 'sortie', x: r.px(140), y: r.py(705), to: 'exit', label: 'prompt.exit' });
  r.sign(r.px(420), r.py(705), 'sign.temple', ['throw']);
  r.target({ id: 'eau', x: 1.25, y: 3.45, symbol: 'eau', size: 0.66 });
  r.target({ id: 'baobab', x: 2.2, y: 3.7, symbol: 'baobab', size: 0.66 });
  r.target({ id: 'soleil', x: 3.15, y: 3.45, symbol: 'soleil', size: 0.66 });
  r.chest('t.coffre', r.px(1450), r.py(525), { coins: 12, gem: 1 }, {
    onOpen: (g) =>
      g.runScript(async () => {
        await g.say('narrateur', 'dlg.temple.coffre1');
        await g.say('ousmane', 'dlg.temple.coffre2');
        g.setFlag('tamtam');
        g.sfx('key');
        g.toast('toast.treasure', undefined, 'items/coffre');
        await g.say('narrateur', 'dlg.temple.coffre3');
        g.setFlag('carte2');
        g.completeQuest('temple');
        g.startQuest('retour');
        g.completeLevel();
      }),
  });
  r.def.setup = (g, stage) => {
    const stones = ['p1', 'p2', 'p3'];
    let step = 0;
    let fails = 0;
    if (g.has('templeOuvert')) {
      stones.forEach((id) => stage.setSolidActive(id, true, false));
      stage.targets.forEach((tg) => tg.setLit(true));
      return;
    }
    for (const tg of stage.targets) {
      tg.onHit = (hit) => {
        if (g.has('templeOuvert') || hit.lit) return;
        if (hit.def.symbol === TEMPLE_ORDER[step]) {
          hit.setLit(true);
          step++;
          g.sfx('target');
          if (step < TEMPLE_ORDER.length) {
            g.toast('toast.signLit');
            return;
          }
          g.setFlag('templeOuvert');
          g.view.shake(0.06, 0.6);
          void g.runScript(async () => {
            g.sfx('secret');
            stones.forEach((id) => stage.setSolidActive(id, true));
            await g.say('narrateur', 'dlg.temple.ok');
          });
        } else {
          step = 0;
          fails++;
          stage.targets.forEach((x) => x.setLit(false));
          g.sfx('wrong');
          g.toast('toast.wrongOrder');
          const clues = knownClues(g);
          if (fails >= 2 && clues.length) g.toast('toast.clues', { clues: clues.map((c) => t(c)).join(', ') }, 'items/parchemin');
        }
      };
    }
  };
  return r.build();
}
