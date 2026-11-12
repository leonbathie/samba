/**
 * Niveau 4 — La savane.
 * Ousmane retrouve son amie Coumba, qui lui confie son lance-pierre et l'accompagne à travers
 * les falaises. Hyènes qui poursuivent, phacochères qui chargent, courte échelle à deux.
 */
import type { LevelDef } from '../types';
import { LevelBuilder, THEMES } from './builder';

export function niveau4(): LevelDef {
  const b = new LevelBuilder('savane', 4, 'level.4', THEMES.savane, { width: 200, spawn: { x: 3, y: 0.05 } });

  // ---- terrain : plateaux, gouffres et rivière
  b.ground(0, 30).ground(30, 44, 2.0).ground(44, 58, 4.0);
  b.solid(59.4, 3.4, 2.8, 1.2, 'ile');
  b.ground(63.4, 82, 3.0).ground(82, 96, 0);
  b.water(96, 110, -1.2).mover(97.2, 0.5, 2.8, 'ile', 8, 0, 6);
  b.ground(110, 126, 1.5).ground(126, 150, 5.2);
  b.ground(150, 156, 3.4).ground(156, 162, 1.7).ground(162, 200, 0);

  // ---- décor
  b.acacia(12, 0, 6, -6).baobab(24, 0, 9, -9).acacia(37, 2, 5.5, -5).acacia(52, 4, 5, -7).baobab(70, 3, 9, -8);
  b.acacia(88, 0, 6.5, -5).acacia(116, 1.5, 5.5, -6).baobab(136, 5.2, 8.5, -7).acacia(146, 5.2, 5, -9);
  b.acacia(168, 0, 6, -6).baobab(182, 0, 9.5, -8).acacia(194, 0, 5.5, -5);
  b.dress(0, 30).dress(30, 44, 2).dress(44, 58, 4).dress(63.4, 82, 3).dress(82, 96).dress(110, 126, 1.5).dress(126, 150, 5.2).dress(162, 200);
  b.bird(40, 9).bird(120, 10, 'props/oiseau', 0.9, -6, 2.6, 30).bird(170, 8.5);
  b.lily(100, -1.2).lily(106, -1.2, 0.27);

  // ---- pièces et objets
  b.coins(12, 1.1, 5).arc(27.5, 31.5, 1.4, 1.6, 4).coins(34, 3.1, 4).arc(41.5, 45.5, 3.4, 1.6, 4).coins(47, 5.1, 3);
  b.arc(57.6, 63.8, 4.6, 1.2, 6).coins(67, 4.1, 4).coins(84, 1.1, 5).arc(96.5, 109.5, 1.6, 1.2, 8);
  b.coins(113, 2.6, 4).coins(125.2, 3.0, 4, 0, 0.9).coins(130, 6.3, 6).coins(152, 4.5, 2).coins(158, 2.8, 2).coins(166, 1.1, 6);
  b.item('pile', 16, 0.45).item('pile', 46, 4.45).item('heart', 60.8, 4.4).item('pile', 84.6, 0.45);
  b.item('pile', 112, 1.95).item('shield', 143, 5.9, { id: 's.bouclier' }).item('bunch', 163.4, 0.5);
  b.chest('s.coffre1', 90.4, 0, { coins: 6, heart: 1 });
  b.chest('s.coffre2', 146.6, 5.2, { coins: 8, gem: 1 });

  // ---- aides et points de sauvegarde
  b.sign(17.5, 0, 'sign.sling', ['switch', 'throw', 'up']);
  b.sign(41, 2.0, 'sign.hyena').sign(64.8, 3.0, 'sign.warthog');
  b.checkpoint(32, 2.0).checkpoint(65.8, 3.0).checkpoint(111.6, 1.5).checkpoint(128, 5.2).checkpoint(164);

  // ---- une cible pour essayer le lance-pierre
  b.target({ id: 'essai', x: 22.4, y: 4.3, size: 1.2 });

  // ---- animaux
  b.enemy('hyene', 52, 4.02, { x0: 45, x1: 57.2 });
  b.enemy('phaco', 75, 3.02, { x0: 66.5, x1: 81 });
  b.enemy('croc', 103, -1.2, { x0: 97, x1: 109 });
  b.enemy('hyene', 119, 1.52, { x0: 111.5, x1: 125 });
  b.enemy('phaco', 139, 5.22, { x0: 129, x1: 149 });
  b.enemy('serpent', 159, 1.72);
  b.enemy('hyene', 179, 0.02, { x0: 167, x1: 192 });

  // ---- Coumba : rencontre, lance-pierre, puis elle accompagne le héros
  b.npc({ id: 'coumba', char: 'amie', x: 9.4, y: 0, facing: -1, z: 0.05, when: (g) => !g.has('lancePierre') });
  b.def.companion = { x: 9.4, y: 0.05, when: (g) => g.has('lancePierre') };
  b.trigger('rencontre', 5.6, 12, async (g, stage) => {
    if (g.has('lancePierre')) return;
    await g.say('coumba', 'dlg.coumba.1');
    await g.say('ousmane', 'dlg.coumba.2');
    await g.say('coumba', 'dlg.coumba.3');
    g.give('sling');
    g.setFlag('lancePierre');
    g.toast('toast.sling');
    await g.say('coumba', 'dlg.coumba.4');
    stage.removeNpc('coumba');
    stage.addCompanion(9.4, 0.05);
    g.ui.hud();
  });
  b.trigger('cible', 15, 19, async (g, stage) => {
    if (stage.companion) await g.say('coumba', 'dlg.coumba.cible');
  });

  // ---- courte échelle au pied de la haute falaise
  b.npc({
    id: 'echelle', char: 'amie', ghost: true, x: 124.9, y: 1.5, promptY: 2.4, reach: 1.1, prompt: 'prompt.boost',
    talk: async (g) => {
      const stage = g.stage!;
      if (!g.has('echelleVue')) {
        g.setFlag('echelleVue');
        await g.say('coumba', 'dlg.coumba.echelle');
      }
      stage.companion?.celebrate(1.4);
      stage.player.boost(16.8);
    },
  });
  b.trigger('adieu', 186, 190, async (g, stage) => {
    if (!stage.companion) return;
    await g.say('coumba', 'dlg.coumba.fin1');
    await g.say('coumba', 'dlg.coumba.fin2');
    stage.removeCompanion();
  });

  b.def.setup = (g, stage) => {
    const target = stage.targets[0];
    if (target) {
      target.onHit = (tg) => {
        tg.setLit(true);
        g.sfx('target');
        if (!g.has('cibleEssai')) {
          g.setFlag('cibleEssai');
          for (let i = 0; i < 6; i++) stage.spawnPickup({ kind: 'coin', x: tg.x, y: tg.y - 0.6 }, { pop: true });
        }
      };
    }
  };
  b.exit(196, 0, (g) => g.has('lancePierre'), 'lock.coumba');
  b.def.objective = (g) => (g.has('lancePierre') ? 'obj.4b' : 'obj.4a');
  return b.build();
}
