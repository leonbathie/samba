/**
 * Chaque niveau et chaque intérieur doit pouvoir être terminé avec la vraie physique du jeu :
 * sortie, portes, habitants, coffres, points de sauvegarde et objets importants atteignables.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS, ROOMS } from '../../src/game/levels';
import { explore } from './reach';

const describeGoals = (list: { kind: string; label: string }[]): string[] => list.map((g) => `${g.kind} : ${g.label}`);

describe('accessibilité des niveaux', () => {
  LEVELS.forEach((make, i) => {
    it(`niveau ${i + 1} : départ, sortie, habitants, coffres et objets importants sont atteignables`, () => {
      const def = make();
      const r = explore(def);
      expect(r.spawnOk, 'le héros doit commencer sur un sol').toBe(true);
      expect(describeGoals(r.unreached.filter((g) => g.required))).toEqual([]);
      // Objets facultatifs (pièces, munitions) : tous doivent aussi être atteignables.
      const optional = r.goals.filter((g) => !g.required);
      const missed = optional.filter((g) => !g.reached);
      expect(describeGoals(missed)).toEqual([]);
    });
  });

  for (const [id, make] of Object.entries(ROOMS)) {
    it(`intérieur « ${id} » : tout ce qui compte est atteignable`, () => {
      const def = make();
      const r = explore(def, { activateHidden: true });
      expect(r.spawnOk).toBe(true);
      expect(describeGoals(r.unreached.filter((g) => g.required))).toEqual([]);
    });
  }

  it('le coffre du temple ne peut être atteint qu’après avoir résolu l’énigme', () => {
    const r = explore(ROOMS.temple(), { activateHidden: false });
    const chest = r.goals.find((g) => g.kind === 'coffre');
    expect(chest?.reached).toBe(false);
  });

  it('chaque niveau a une fin : une sortie ou un personnage qui termine le niveau', () => {
    for (const make of LEVELS) {
      const def = make();
      const ends = !!def.exit || def.npcs.some((n) => n.talk) || def.doors.length > 0;
      expect(ends, def.id).toBe(true);
    }
  });
});
