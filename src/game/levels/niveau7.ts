/**
 * Niveau 7 — Retour au village.
 * Au crépuscule, Ousmane retrouve Coumba et les habitants, révèle sa découverte à la conteuse et
 * la fête commence. Le second morceau de carte ouvre la porte d'une prochaine aventure.
 */
import type { LevelDef } from '../types';
import type { Game } from '../Game';
import type { Stage } from '../Stage';
import { LevelBuilder, THEMES } from './builder';

const FETARDS = ['musicien_djembe', 'musicien_kora', 'musicienne_djembe', 'danseuse', 'danseur', 'malick', 'fanta'];

function lancerFete(g: Game, stage: Stage, withSound: boolean): void {
  for (const id of FETARDS) stage.npc(id)?.setPose('dance');
  g.audio.playMusic('fete');
  g.audio.setAmbience(['nuit', 'fete']);
  stage.companion?.celebrate(3);
  if (withSound) g.sfx('levelEnd');
  let timer = 0;
  // Gerbes d'étincelles au-dessus de la place.
  stage.onTick = (dt) => {
    timer -= dt;
    if (timer > 0) return;
    timer = 0.35 + Math.random() * 0.5;
    const colors = [0xffd76a, 0xff8f6a, 0x8fe0ff, 0xffa8e0, 0xb8ff9a];
    stage.fx.spark.burst({
      x: 52 + Math.random() * 30, y: 5 + Math.random() * 3.5, z: -1, count: 16, speed: 3.6, life: 1.1, size: 0.24,
      gravity: 1.5, color: colors[Math.floor(Math.random() * colors.length)],
    });
  };
}

export function niveau7(): LevelDef {
  const b = new LevelBuilder('retour', 7, 'level.7', THEMES.fete, { width: 112, spawn: { x: 3, y: 0.05 } });
  b.ground(0, 112);
  b.plat(30.4, 2.3, 2.6).plat(34.2, 4.2, 2.8).plat(84, 2.3, 2.6).plat(88, 4.2, 2.8);

  // ---- décor : le village illuminé
  b.baobab(6, 0, 9.5, -7).hut(15, 0, 4.2, -3.2).hut(26.5, 0, 3.8, -4, true).acacia(34, 0, 5.5, -9);
  b.baobab(62.5, 0, 11, -1.6).hut(48, 0, 4, -3.4).hut(81, 0, 4.2, -3.2, true).acacia(92, 0, 6, -8).baobab(104, 0, 9, -5).hut(98, 0, 3.8, -4);
  b.decor('props/etal_fruits', 39.8, -0.12, 4.4, { z: -0.5 });
  b.dress(0, 112, 0, 0.26);
  for (let x = 4; x < 110; x += 4.6) b.lantern(x, 3.5 + ((x * 7) % 5) * 0.22, -0.9 - ((x * 3) % 4) * 0.3);
  for (const x of [56, 59.5, 66, 69.5]) b.lantern(x, 5.2, -1.2, 1.1);
  b.foliage(60, 7.2, 3.6, -1.3).foliage(66, 7.6, 3.4, -1.5, true).foliage(8, 8.2, 3.6, 2.2, false, 0.9).foliage(100, 8.2, 3.6, 2.2, true, 0.9);
  b.pot(37.2, 0, 1.1, -0.45).pot(42.8, 0, 0.8, -0.45).pot(57, 0, 0.9, -0.45).pot(71, 0, 1.0, -0.45);
  b.bird(50, 8.4, 'props/grue_vol', 1.2, -9, 1.6, 34);

  // ---- les villageois qui arrivent pour la fête
  b.walker('femme_fruits', 26, 44, -1.5, 0.8).walker('femme_kente', 84, 102, -1.4, 0.9);
  b.walker('garcon_explorateur', 6, 18, -1.6, 1.1).walker('fille_exploratrice', 98, 108, -1.3, 1);

  // ---- pièces et friandises
  b.coins(12, 1.1, 5).coins(30.8, 3.1, 3).coins(34.8, 5.0, 3).coins(46, 1.1, 4).coins(84.4, 3.1, 3).coins(88.4, 5.0, 3).coins(96, 1.1, 5);
  b.item('gem', 35.6, 5.3, { id: 'f.gemme', tint: 0xb0a0ff }).item('feather', 89.4, 5.3, { id: 'f.plume' });

  // ---- Coumba attend à l'entrée du village
  b.npc({ id: 'coumba', char: 'amie', x: 9.2, y: 0, facing: -1, z: 0.05, when: (g) => !g.has('retourCoumba') });
  b.def.companion = { x: 9.2, y: 0.05, when: (g) => g.has('retourCoumba') };
  b.trigger('retrouvailles', 5.6, 12, async (g, stage) => {
    if (g.has('retourCoumba')) return;
    await g.say('coumba', 'dlg.retour.coumba1');
    await g.say('ousmane', 'dlg.retour.ousmane1');
    g.setFlag('retourCoumba');
    stage.removeNpc('coumba');
    stage.addCompanion(9.2, 0.05);
  });

  // ---- les habitants
  const v = async (g: Game): Promise<void> => g.say('voisine2', 'dlg.retour.voisines');
  b.npc({ id: 'voisine1', char: 'femme_bleue', x: 20, y: 0, facing: 1, talk: v, reach: 1.0, chat: true });
  b.npc({ id: 'voisine2', char: 'femme_rose', x: 21.4, y: 0, facing: 1, talk: v, reach: 1.0, chat: true });
  b.npc({ id: 'voisine3', char: 'femme_verte', x: 23, y: 0, facing: -1, talk: v, reach: 1.0, chat: true });
  b.bush(20, 0, 0.9, 0.2);
  b.npc({
    id: 'marchande', char: 'porteuse', ghost: true, x: 40.9, y: 0, promptY: 3.0, reach: 1.6,
    talk: async (g) => {
      await g.say('marchande', 'dlg.retour.marchande');
      if (!g.has('fruitsOfferts')) {
        g.setFlag('fruitsOfferts');
        g.give('bananas', 5);
        g.toast('toast.bananas', { n: 5 }, 'items/banane');
      }
    },
  });
  b.npc({ id: 'artisan', char: 'artisan', x: 46.6, y: 0, facing: -1, z: -0.6, talk: async (g) => g.say('artisan', 'dlg.retour.artisan') });
  b.npc({
    id: 'cuisiniere', char: 'cuisiniere', x: 52.4, y: 0, facing: -1,
    talk: async (g) => {
      await g.say('cuisiniere', g.questDone('beignets') ? 'dlg.retour.beignets' : 'dlg.retour.cuisiniere');
      g.heal(9);
      g.sfx('heart');
    },
  });
  b.npc({ id: 'enfants_assis', char: 'enfants_assis', x: 55.6, y: 0, facing: 1, talk: async (g) => g.say('enfants', 'dlg.retour.enfants') });
  b.npc({ id: 'musicien_djembe', char: 'musicien_djembe', x: 64.2, y: 0.05, z: -0.4 });
  b.npc({ id: 'musicien_kora', char: 'musicien_kora', x: 66.4, y: 0.05, z: -0.4, talk: async (g) => g.say('musicien', 'dlg.retour.griot') });
  b.npc({ id: 'musicienne_djembe', char: 'musicienne_djembe', x: 68.7, y: 0.05, z: -0.4 });
  b.npc({ id: 'danseuse', char: 'danseuse', x: 72, y: 0, facing: -1 });
  b.npc({ id: 'danseur', char: 'danseur', x: 74.2, y: 0 });
  b.npc({ id: 'malick', char: 'enfant_garcon', x: 77, y: 0, talk: async (g) => g.say('malick', 'dlg.retour.enfants'), wander: [75.5, 80], speed: 2.2 });
  b.npc({ id: 'fanta', char: 'enfant_fille', x: 79, y: 0, facing: -1, talk: async (g) => g.say('fanta', 'dlg.retour.enfants'), wander: [76, 81], speed: 2 });
  b.npc({ id: 'porteuse', char: 'porteuse', x: 82.6, y: 0, facing: -1, z: -0.5, wander: [80, 90] });
  b.npc({ id: 'grue', char: 'grue', x: 94, y: 0, facing: -1, wander: [92, 97], speed: 0.6 });

  // ---- la conteuse et le vieux sage, sur la place : révélation et fête
  const finale = async (g: Game): Promise<void> => {
    const stage = g.stage!;
    if (g.has('fete')) {
      const choice = await g.choose('conteuse', 'dlg.fete.encore', ['choice.stay', 'choice.end']);
      if (choice === 1) g.completeLevel();
      return;
    }
    await g.say('conteuse', 'dlg.fete.1');
    stage.player.forcedPose = 'cheer';
    g.sfx('chest');
    await g.say('narrateur', 'dlg.fete.2');
    await g.say('sorcier', 'dlg.fete.3');
    await g.say('conteuse', 'dlg.fete.4');
    g.setFlag('fete');
    lancerFete(g, stage, true);
    await g.say('conteuse', 'dlg.fete.5');
    await g.say('coumba', 'dlg.fete.6');
    stage.player.forcedPose = null;
    g.completeQuest('retour');
  };
  b.npc({ id: 'conteuse', char: 'mamie', x: 58.6, y: 0.05, facing: 1, z: -0.3, talk: finale });
  b.npc({ id: 'sorcier', char: 'sorcier', x: 60.9, y: 0, facing: -1, z: -0.45, talk: finale });

  b.def.setup = (g, stage) => {
    if (!g.progress.quests.retour) g.progress.quests.retour = 'active';
    if (g.has('fete')) lancerFete(g, stage, false);
  };
  b.def.objective = (g) => (g.has('fete') ? 'obj.7b' : 'obj.7a');
  return b.build();
}
