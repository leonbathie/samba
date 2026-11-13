import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Catalogue des modèles 3D : chaque entrée doit exister, être un GLB valide et déclarer ses animations. */
const DOSSIER = fileURLToPath(new URL('../../public/assets/models/', import.meta.url));

interface Entree {
  file: string;
  animations?: Record<string, string>;
  retournement?: 'miroir' | 'pivot';
  centrer?: boolean;
}

const catalogue = JSON.parse(readFileSync(DOSSIER + 'models.json', 'utf8')) as { characters: Record<string, Entree> };

/** Noms des animations d'un GLB, lus dans son en-tête JSON (format GLB 2.0). */
function animationsDuGlb(chemin: string): string[] {
  const octets = readFileSync(chemin);
  expect(octets.subarray(0, 4).toString('ascii')).toBe('glTF');
  expect(octets.readUInt32LE(4)).toBe(2);
  const longueur = octets.readUInt32LE(12);
  const doc = JSON.parse(octets.subarray(20, 20 + longueur).toString('utf8')) as {
    animations?: { name?: string }[];
  };
  return (doc.animations ?? []).map((a) => a.name ?? '');
}

const POSES_DU_JEU = ['idle', 'walk', 'run', 'chat', 'listen', 'dance'];

describe('modèles 3D des villageoises', () => {
  it('le catalogue décrit au moins les deux personnages générés par Blender', () => {
    expect(Object.keys(catalogue.characters)).toEqual(expect.arrayContaining(['femme_bleue', 'femme_rose']));
  });

  for (const [id, entree] of Object.entries(catalogue.characters)) {
    it(`${id} : le fichier GLB existe et contient les animations déclarées`, () => {
      const chemin = DOSSIER + entree.file;
      expect(existsSync(chemin)).toBe(true);
      const clips = animationsDuGlb(chemin);
      for (const nom of Object.values(entree.animations ?? {})) {
        expect(clips).toContain(nom);
      }
    });

    it(`${id} : chaque pose du jeu a une animation`, () => {
      for (const pose of POSES_DU_JEU) {
        expect(entree.animations?.[pose], `pose « ${pose} »`).toBeDefined();
      }
    });

    it(`${id} : le retournement est en miroir et l'origine reste aux pieds`, () => {
      expect(entree.retournement).toBe('miroir');
      expect(entree.centrer).toBe(false);
    });
  }
});
