/**
 * Niveau 1 — Le village du départ.
 * Le joueur découvre les commandes, parle aux habitants, visite sa case puis celle de la conteuse,
 * qui lui confie la carte ancienne et sa première mission.
 */
import type { LevelDef } from '../types';
import type { Game } from '../Game';
import { LevelBuilder, RoomBuilder, THEMES, roomTheme } from './builder';

export function niveau1(): LevelDef {
  const b = new LevelBuilder('village', 1, 'level.1', THEMES.village, { width: 150, spawn: { x: 4, y: 0.05 } });

  // ---- terrain
  b.ground(0, 66).water(66, 76, -1.1).bridge(66, 76).ground(76, 150);
  b.ledge(18, 21, 1.0, 0);
  b.plat(35.4, 2.3, 2.6).plat(39.2, 4.3, 2.8);
  b.plat(52.2, 2.0, 2.4).branch(56.2, 3.6, 6.4, 'right');
  b.plat(100.4, 2.5, 2.6).plat(104.6, 3.5, 2.6);
  b.plat(112, 2.2, 2.6).plat(116.2, 4.0, 2.6).plat(120.6, 5.4, 3.2);

  // ---- décor
  b.baobab(12, 0, 10, -7).acacia(30, 0, 5.5, -9).hut(27.5, 0, 4.2, -3.2).hut(41, 0, 3.8, -4, true);
  b.baobab(63.5, 0, 8.5, -1.4).acacia(72, 0, 5, -10).hut(92.5, 0, 4, -3.5).baobab(110, 0, 10, -8);
  b.hut(127, 0, 4.2, -3.2, true).acacia(134, 0, 6, -7).baobab(146, 0, 9, -5);
  b.dress(0, 66).dress(76, 150);
  b.decor('props/etal_fruits', 45.6, -0.15, 4.3, { z: -0.5 });
  b.pot(43.2, 0, 1.1, -0.45).pot(48.9, 0, 0.8, -0.45).bush(24.1, 0, 0.9, 0.2);
  b.lantern(10.6, 3.6).lantern(22, 3.2, -2).lantern(57.5, 2.7).lantern(61.5, 2.9).lantern(88.6, 3.7).lantern(131, 3.4, -2);
  b.foliage(60, 6.2, 3.2, -1.2).foliage(64, 6.6, 3, -1.6, true).foliage(8, 8.4, 3.4, 2.2, false, 0.9).foliage(112, 8.6, 3.4, 2.2, true, 0.9);
  b.lily(69, -1.1).lily(73.2, -1.1, 0.26);
  b.bird(20, 7.5).bird(90, 8.2, 'props/oiseau', 0.9, -6, 2.8, 26);
  b.decor('props/ballon', 31.9, 0.02, 0.42, { z: -0.1 });

  // ---- pièces et objets
  b.coins(10.5, 1.1, 4).arc(16.6, 22.4, 1.6, 1.6, 6).coins(28, 1.1, 3);
  b.coins(35.8, 3.1, 3).coins(53, 2.8, 2).coins(57.4, 4.4, 5);
  b.arc(66.5, 75.5, 1.2, 1.2, 8).coins(81, 1.1, 3).coins(96.5, 1.1, 4);
  b.coins(101, 3.3, 2).coins(105.2, 4.3, 2).coins(112.6, 3.0, 2).coins(116.8, 4.8, 2).coins(134, 1.1, 5);
  b.item('quest', 40.6, 5.05, { id: 'ballon', img: 'props/ballon', flag: 'ballon' });
  b.item('pile', 95.2, 0.45).item('stone', 98.2, 0.4).item('stone', 99.4, 0.4);
  b.item('heart', 105.9, 4.35).item('banana', 59.3, 4.4);
  b.chest('v.coffre1', 122.6, 5.4, { coins: 8, gem: 1 });

  // ---- aides
  b.sign(6.2, 0, 'sign.move', ['left', 'right']);
  b.sign(11.2, 0, 'sign.interact', ['interact']);
  b.sign(15.6, 0, 'sign.jump', ['jump']);
  b.sign(50.6, 0, 'sign.throw', ['throw']);
  b.sign(54.4, 0, 'sign.crouch', ['down']);
  b.sign(63.2, 0, 'sign.checkpoint');
  b.sign(94, 0, 'sign.switch', ['switch', 'throw']);
  b.sign(102.2, 0, 'sign.snake', ['defend']);
  b.checkpoint(64.6).checkpoint(90.2);

  // ---- animaux
  b.enemy('singe', 59.2, 3.6, { ammo: 'banana' });
  b.enemy('serpent', 107.5, 0.02);

  // ---- cases
  b.door({ id: 'porte.famille', x: 8.6, y: 0, to: 'famille', label: 'prompt.enter', hut: true });
  b.door({ id: 'porte.conteuse', x: 86.4, y: 0, to: 'conteuse', label: 'prompt.enterConteuse', hut: true });

  // ---- habitants
  const voisines = async (g: Game): Promise<void> => {
    if (!g.has('carte')) {
      await g.say('voisine1', 'dlg.voisines.1');
      await g.say('voisine2', 'dlg.voisines.2');
      await g.say('voisine3', 'dlg.voisines.3');
    } else {
      await g.say('voisine2', 'dlg.voisines.apres');
    }
  };
  b.npc({ id: 'voisine1', char: 'femme_bleue', x: 24.1, y: 0.25, facing: 1, talk: voisines, reach: 1.0 });
  b.npc({ id: 'voisine2', char: 'femme_rose', x: 25.5, y: 0, facing: 1, talk: voisines, reach: 1.0 });
  b.npc({ id: 'voisine3', char: 'femme_verte', x: 27.1, y: 0, facing: -1, talk: voisines, reach: 1.0 });

  const enfants = async (g: Game): Promise<void> => {
    if (g.questDone('ballon')) {
      await g.say('fanta', 'dlg.enfants.fin');
    } else if (g.has('ballon')) {
      await g.say('malick', 'dlg.enfants.merci1');
      await g.say('fanta', 'dlg.enfants.merci2');
      g.addCoins(10);
      g.give('feather');
      g.toast('toast.feather', undefined, 'items/plume');
      g.completeQuest('ballon');
    } else if (g.questActive('ballon')) {
      await g.say('malick', 'dlg.enfants.rappel');
    } else {
      await g.say('malick', 'dlg.enfants.1');
      await g.say('fanta', 'dlg.enfants.2');
      g.startQuest('ballon');
    }
  };
  b.npc({ id: 'malick', char: 'enfant_garcon', x: 30.7, y: 0, facing: 1, talk: enfants });
  b.npc({ id: 'fanta', char: 'enfant_fille', x: 33.3, y: 0, facing: -1, talk: enfants });

  b.npc({
    id: 'marchande', char: 'porteuse', ghost: true, x: 46.9, y: 0, promptY: 3.0, reach: 1.6,
    talk: async (g) => {
      if (!g.has('bananesOffertes')) {
        await g.say('marchande', 'dlg.marchande.1');
        g.give('bananas', 3);
        g.setFlag('bananesOffertes');
        g.toast('toast.bananas', { n: 3 }, 'items/banane');
        await g.say('marchande', 'dlg.marchande.2');
        return;
      }
      const choice = await g.choose('marchande', 'dlg.marchande.vente', ['choice.buy', 'choice.no']);
      if (choice !== 0) return;
      if (g.progress.coins < 10) {
        await g.say('marchande', 'dlg.marchande.pauvre');
      } else {
        g.addCoins(-10);
        g.give('bananas', 5);
        g.toast('toast.bananas', { n: 5 }, 'items/banane');
        await g.say('marchande', 'dlg.marchande.merci');
      }
    },
  });
  b.npc({
    id: 'enfants_assis', char: 'enfants_assis', x: 50.2, y: 0, facing: -1,
    talk: async (g) => g.say('enfants', 'dlg.assis.1'),
  });
  b.npc({
    id: 'artisan', char: 'artisan', x: 54.6, y: 0, facing: -1, z: -0.6,
    talk: async (g) => {
      await g.say('artisan', 'dlg.artisan.1');
      await g.say('artisan', 'dlg.artisan.2');
    },
  });
  b.npc({
    id: 'cuisiniere', char: 'cuisiniere', x: 80.6, y: 0, facing: -1,
    talk: async (g) => {
      if (g.questDone('beignets')) return g.say('cuisiniere', 'dlg.cuisiniere.fin');
      if (!g.questActive('beignets')) {
        await g.say('cuisiniere', 'dlg.cuisiniere.1');
        g.startQuest('beignets');
      }
      if (g.progress.bananas < 3) return g.say('cuisiniere', 'dlg.cuisiniere.manque');
      const choice = await g.choose('cuisiniere', 'dlg.cuisiniere.demande', ['choice.give', 'choice.later']);
      if (choice !== 0) return;
      g.progress.bananas -= 3;
      await g.say('cuisiniere', 'dlg.cuisiniere.merci');
      g.give('heartMax');
      g.toast('toast.heartMax', undefined, 'items/coeur');
      g.completeQuest('beignets');
    },
  });
  b.npc({
    id: 'grue', char: 'grue', x: 109.4, y: 0, facing: -1, prompt: 'prompt.look',
    talk: async (g) => {
      if (g.has('plumeGrue')) return g.say('narrateur', 'dlg.grue.2');
      await g.say('narrateur', 'dlg.grue.1');
      g.setFlag('plumeGrue');
      g.stage!.spawnPickup({ kind: 'feather', x: 108.2, y: 0.6, id: 'v.plume' }, { pop: true });
    },
  });
  b.npc({
    id: 'exploratrice', char: 'fille_exploratrice', x: 139.6, y: 0, facing: -1,
    talk: async (g) => {
      await g.say('exploratrice', 'dlg.explo.1');
      await g.say('explorateur', 'dlg.explo.2');
    },
  });
  b.npc({ id: 'explorateur', char: 'garcon_explorateur', x: 141.3, y: 0, facing: -1, talk: async (g) => g.say('explorateur', 'dlg.explo.2') });

  b.exit(146.5, 0, (g) => g.has('carte'), 'lock.carte');
  b.def.objective = (g) => (g.has('carte') ? 'obj.1b' : 'obj.1a');
  b.def.setup = (g) => {
    if (!g.progress.quests.carte) g.progress.quests.carte = 'active';
  };
  return b.build();
}

/** La case de la famille d'Ousmane. */
export function caseFamille(): LevelDef {
  const r = new RoomBuilder({
    id: 'famille', name: 'room.famille', painting: 'rooms/famille', ppu: 218,
    theme: roomTheme(THEMES.village, ['village']), spawnPx: { x: 372, y: 665 },
  });
  r.floor(0, 1672, 665, 300).wallPx(0, 250, 0, 941).wallPx(1608, 1672, 0, 941);
  r.door({ id: 'sortie', x: r.px(330), y: r.py(665), to: 'exit', label: 'prompt.exit' });
  r.npc({
    id: 'maman', char: 'femme_fruits', ghost: true, x: r.px(812), y: r.py(665), promptY: 2.75, reach: 1.1,
    talk: async (g) => {
      if (g.has('carte')) return g.say('maman', 'dlg.maman.carte');
      if (g.has('vuMaman')) return g.say('maman', 'dlg.maman.rappel');
      await g.say('maman', 'dlg.maman.1');
      await g.say('maman', 'dlg.maman.2');
      await g.say('maman', 'dlg.maman.3');
      g.setFlag('vuMaman');
    },
  });
  r.npc({
    id: 'tante', char: 'femme_kente', ghost: true, x: r.px(1330), y: r.py(665), promptY: 1.9, reach: 1.1,
    talk: async (g) => {
      await g.say('tante', 'dlg.tante.1');
      if (!g.has('piecesTante')) {
        g.setFlag('piecesTante');
        g.addCoins(5);
        g.toast('toast.coins', { n: 5 }, 'items/piece');
      }
    },
  });
  return r.build();
}

/** La case de Mame Awa, la conteuse. */
export function caseConteuse(): LevelDef {
  const r = new RoomBuilder({
    id: 'conteuse', name: 'room.conteuse', painting: 'rooms/conteuse', ppu: 270,
    theme: roomTheme(THEMES.village, ['village']), spawnPx: { x: 400, y: 705 },
  });
  r.floor(0, 1672, 705, 300).wallPx(0, 235, 0, 941).wallPx(800, 1672, 0, 941);
  r.door({ id: 'sortie', x: r.px(345), y: r.py(705), to: 'exit', label: 'prompt.exit' });
  r.npc({
    id: 'conteuse', char: 'conteuse', ghost: true, x: r.px(900), y: r.py(705), promptY: 2.1, reach: 1.45,
    talk: async (g) => {
      if (g.has('carte')) {
        await g.say('conteuse', 'dlg.conteuse.rappel');
        return;
      }
      await g.say('conteuse', 'dlg.conteuse.1');
      await g.say('conteuse', 'dlg.conteuse.2');
      await g.say('conteuse', 'dlg.conteuse.3');
      await g.say('conteuse', 'dlg.conteuse.4');
      await g.say('conteuse', 'dlg.conteuse.5');
      g.setFlag('carte');
      g.sfx('key');
      g.toast('toast.carte', undefined, 'items/parchemin');
      g.completeQuest('carte');
      g.startQuest('sorcier');
      await g.say('enfants', 'dlg.conteuse.enfants');
    },
  });
  return r.build();
}
