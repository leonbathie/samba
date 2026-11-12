/**
 * Niveau 2 — Les arbres et les singes.
 * Ascension du grand baobab : lianes, branches où l'on se suspend, singes lanceurs et un serpent
 * qui garde le passage. Tout en haut vit le vieux sage, qui remet la clé et la mission.
 */
import type { LevelDef } from '../types';
import { LevelBuilder, RoomBuilder, THEMES, roomTheme } from './builder';

export function niveau2(): LevelDef {
  const b = new LevelBuilder('arbres', 2, 'level.2', THEMES.arbres, { width: 30, top: 63, spawn: { x: 7, y: 0.05 } });

  // ---- les deux grands troncs et le sol
  b.ground(0, 30);
  b.trunk(-1.4, 5.8, -4, 67).trunk(25.6, 5.8, -4, 67);

  // ---- la montée (de bas en haut)
  b.liane(9.5, 0, 4.2).branch(3.6, 4.2, 7.4, 'left');
  b.plat(13.6, 5.6, 2.6);
  b.branch(18, 7.0, 8.4, 'right').liane(24.6, 7.0, 11.5);
  b.branch(19.6, 11.5, 6.8, 'right');
  b.plat(15.4, 12.7, 2.6);
  b.branch(3.6, 14.0, 9, 'left').liane(5.6, 14.0, 19.0);
  b.branch(3.6, 19.0, 6.4, 'left');
  b.branch(3.6, 22.6, 15.8, 'left', true);
  b.plat(21.2, 24.2, 2.6);
  b.branch(21.4, 26.0, 5, 'right').liane(22.6, 26.0, 31.5);
  b.branch(19.4, 31.5, 7, 'right');
  b.plat(14.8, 32.7, 2.6).plat(10.6, 34.1, 2.6);
  b.branch(3.6, 35.5, 6.2, 'left').liane(5.4, 35.5, 40.6);
  b.branch(3.6, 40.6, 9, 'left');
  b.branch(10.8, 43.8, 15.6, 'right', true);
  b.branch(20.4, 45.8, 6, 'right').liane(25.2, 45.8, 51.2);
  b.branch(18.4, 51.2, 8, 'right');
  b.plat(13.8, 52.4, 2.8);
  b.branch(3.6, 53.8, 8.4, 'left');

  // ---- décor : feuillages, lanternes, oiseaux
  b.dress(4, 26, 0, 0.3);
  const leaves: [number, number, number, boolean][] = [
    [9, 5.6, -1.4, false], [22, 8.4, -1.6, true], [23, 13, -1.2, false], [8, 15.4, -1.8, true], [7, 20.4, -1.3, false],
    [12, 24, -1.8, true], [24, 27.4, -1.4, false], [22.5, 33, -1.7, true], [7, 36.9, -1.3, false], [8.5, 42, -1.8, true],
    [19, 45.2, -1.4, false], [23, 47.2, -1.6, true], [22, 52.6, -1.3, false], [8, 55.2, -1.6, true], [15, 58.5, -2.2, false],
    [24, 59.5, -2.4, true], [5, 60, -2.2, false],
  ];
  for (const [x, y, z, flip] of leaves) b.foliage(x, y, 3.1, z, flip);
  b.foliage(3, 9, 3.6, 2.4, false, 0.92).foliage(27, 29, 3.6, 2.6, true, 0.92).foliage(3, 48, 3.6, 2.4, false, 0.92);
  b.lantern(7.5, 3.3).lantern(21, 6.1).lantern(23.5, 10.6).lantern(9, 13.1).lantern(13, 21.7).lantern(24.5, 25.1);
  b.lantern(22, 30.6).lantern(7, 34.6).lantern(9.5, 39.7).lantern(17, 42.9).lantern(22, 50.3).lantern(9.6, 52.9);
  b.bird(15, 18, 'props/oiseau', 0.9, -5, 2.6, 22).bird(15, 38).bird(12, 56, 'props/oiseau', 0.9, -5, 3, 22);
  b.cloud(6, 34, 3, -34).cloud(22, 41, 3.6, -30).cloud(10, 49, 4, -26).cloud(24, 56, 3.4, -32).cloud(14, 61, 4.4, -24);

  // ---- pièces et objets
  b.coins(9.5, 1.2, 4, 0, 0.8).coins(5.5, 5.0, 4).coins(14, 6.4, 2).coins(19, 7.8, 4);
  b.coins(24.6, 8.2, 4, 0, 0.8).coins(20.4, 12.3, 3).coins(15.8, 13.5, 2).coins(9.6, 14.8, 3);
  b.coins(5.6, 15.2, 4, 0, 0.9).coins(5, 21.2, 5, 1.0).coins(9, 23.4, 6, 1.5).coins(21.6, 25.0, 2);
  b.coins(22.6, 27.2, 5, 0, 0.9).coins(20.4, 32.3, 4).coins(15.2, 33.5, 2).coins(11, 34.9, 2);
  b.coins(5.4, 36.7, 4, 0, 0.9).coins(12.5, 42.2, 7, 1.7).coins(13, 44.6, 7, 1.6).coins(25.2, 47, 5, 0, 0.9);
  b.coins(19.2, 52, 4).coins(14.2, 53.2, 2);
  b.item('bunch', 12.2, 0.5).item('pile', 20.6, 11.95).item('heart', 6.4, 36.0).item('pile', 24, 31.95);
  b.item('feather', 25.6, 26.7, { id: 'a.plume' }).item('banana', 11.6, 41.1).item('banana', 12.2, 41.1);
  b.item('shield', 4.6, 19.7, { id: 'a.bouclier' });

  // ---- aides et points de sauvegarde
  b.sign(8.2, 0, 'sign.climb', ['up', 'down', 'jump']);
  b.sign(14.6, 0, 'sign.monkeys', ['throw', 'defend']);
  b.sign(8.4, 19.0, 'sign.hang', ['up', 'jump', 'down']);
  b.sign(21.6, 31.5, 'sign.drop', ['down', 'jump']);
  b.checkpoint(11.6, 14.0).checkpoint(8.8, 35.5);

  // ---- animaux
  b.enemy('singe', 22.6, 7.0, { ammo: 'banana' });
  b.enemy('serpent', 8.6, 14.02);
  b.enemy('singe', 16.8, 22.6, { ammo: 'stone' });
  b.enemy('singe', 10.6, 40.6, { ammo: 'mix' });
  b.enemy('singe', 23.6, 43.8, { ammo: 'banana', x0: 18, x1: 24.5 });
  b.enemy('serpent', 22.6, 45.82);

  // ---- le petit singe gourmand (mission secondaire)
  b.npc({
    id: 'singe_ami', char: 'singe_ami', x: 19.4, y: 0, facing: -1, prompt: 'prompt.look',
    talk: async (g) => {
      if (g.questDone('singe')) return g.say('narrateur', 'dlg.singe.fin');
      await g.say('narrateur', 'dlg.singe.1');
      g.startQuest('singe');
      if (g.progress.bananas < 1) return g.say('narrateur', 'dlg.singe.rien');
      const choice = await g.choose('narrateur', 'dlg.singe.demande', ['choice.give', 'choice.later']);
      if (choice !== 0) return;
      g.progress.bananas -= 1;
      await g.say('narrateur', 'dlg.singe.merci');
      g.stage!.spawnPickup({ kind: 'gem', x: 18.2, y: 0.7, id: 'a.gemme', tint: 0x8fe8ff }, { pop: true });
      g.stage!.spawnPickup({ kind: 'feather', x: 20.4, y: 0.7, id: 'a.plume2' }, { pop: true });
      g.completeQuest('singe');
    },
  });

  // ---- la case du vieux sage, tout en haut
  b.door({ id: 'porte.sorcier', x: 7.4, y: 53.8, to: 'sorcier', label: 'prompt.enterSorcier', hut: true });
  b.exit(10.9, 53.8, (g) => g.has('cle'), 'lock.cle');
  b.def.objective = (g) => (g.has('cle') ? 'obj.2b' : 'obj.2a');
  return b.build();
}

/** La case du vieux Demba : il remet la clé du temple et la mission des trois signes. */
export function caseSorcier(): LevelDef {
  const r = new RoomBuilder({
    id: 'sorcier', name: 'room.sorcier', painting: 'rooms/sorcier', ppu: 169,
    theme: roomTheme(THEMES.arbres, ['vent']), spawnPx: { x: 290, y: 502 },
  });
  // Étage principal (traversable : l'échelle descend vers la petite grotte aux cristaux).
  r.floor(0, 1298, 502, 46, true).wallPx(0, 150, 0, 941).wallPx(1664, 1672, 0, 941);
  r.climbPx(512, 502, 836);
  r.floor(215, 1042, 836, 105).wallPx(165, 215, 560, 941).wallPx(1042, 1078, 610, 941);
  // Étagères de pierre à droite, jusqu'au coffre.
  r.floor(1230, 1463, 444, 40, true).floor(1338, 1672, 325, 40, true).floor(1385, 1672, 582, 40, true);
  r.poolPx(1078, 1672, 830);
  r.door({ id: 'sortie', x: r.px(300), y: r.py(502), to: 'exit', label: 'prompt.exit' });
  r.chest('s.coffre', r.px(1470), r.py(325), { coins: 6, gem: 1 });
  r.item('feather', r.px(830), r.py(790), { id: 's.plume' });
  r.npc({
    id: 'sorcier', char: 'sorcier', ghost: true, x: r.px(955), y: r.py(502), promptY: 1.95, reach: 1.25,
    talk: async (g) => {
      if (g.has('cle')) return g.say('sorcier', 'dlg.sorcier.rappel');
      await g.say('sorcier', 'dlg.sorcier.1');
      await g.say('sorcier', 'dlg.sorcier.2');
      g.setFlag('cle');
      g.setFlag('indice1');
      g.sfx('key');
      g.toast('toast.cle', undefined, 'items/cle');
      g.ui.hud();
      await g.say('sorcier', 'dlg.sorcier.3');
      await g.say('sorcier', 'dlg.sorcier.4');
      await g.say('sorcier', 'dlg.sorcier.5');
      await g.say('sorcier', 'dlg.sorcier.6');
      g.completeQuest('sorcier');
      g.startQuest('indices');
    },
  });
  // La clé brille dans la main du sage tant qu'il ne l'a pas donnée.
  r.def.setup = (g, stage) => {
    if (g.has('cle')) return;
    const key = stage.addDecor({
      img: 'items/cle', x: r.px(752), y: r.py(300), h: 0.5, z: 0.02, center: true,
      glow: { color: 0xffe08a, size: 1.6 },
    });
    stage.onTick = () => {
      if (g.has('cle')) key.visible = false;
    };
  };
  return r.build();
}
