/**
 * Chargement progressif des images du jeu.
 * Le manifeste (public/assets/manifest.json) est produit par tools/assets/build.py.
 * Une image absente ou illisible ne bloque pas le jeu : elle est remplacée par un repère visible
 * et signalée au joueur (liste `missing`).
 */
import * as THREE from 'three';

export interface ImageInfo {
  file: string;
  w: number;
  h: number;
  /** Position horizontale des pieds (0 à 1), calculée par l'outil de découpe pour les personnages. */
  fx?: number;
}

export class Assets {
  images: Record<string, ImageInfo> = {};
  readonly missing: string[] = [];
  readonly base: string;
  private textures = new Map<string, THREE.Texture>();
  private pending = new Map<string, Promise<void>>();
  private loader = new THREE.TextureLoader();
  private placeholder: THREE.Texture | null = null;
  maxAnisotropy = 1;
  private generated = new Set<string>();

  constructor(base = './assets/') {
    this.base = base;
  }

  async loadManifest(): Promise<void> {
    try {
      const res = await fetch(this.base + 'manifest.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = (await res.json()) as { images: Record<string, ImageInfo> };
      this.images = data.images ?? {};
    } catch (err) {
      console.error('[assets] manifeste illisible', err);
      this.missing.push('manifest.json');
      this.images = {};
    }
  }

  /** Enregistre une image dessinée par le code (nuages…) : elle s'utilise comme une image du manifeste. */
  register(id: string, tex: THREE.Texture, w: number, h: number): void {
    this.images[id] = { file: '', w, h };
    this.textures.set(id, tex);
    this.generated.add(id);
  }

  has(id: string): boolean {
    return !!this.images[id];
  }

  info(id: string): ImageInfo {
    return this.images[id] ?? { file: '', w: 256, h: 256 };
  }

  /** Rapport largeur / hauteur de l'image. */
  aspect(id: string): number {
    const i = this.info(id);
    return i.w / i.h;
  }

  url(id: string): string {
    const i = this.images[id];
    return i ? this.base + i.file : '';
  }

  private noteMissing(id: string): void {
    if (!this.missing.includes(id)) {
      this.missing.push(id);
      console.warn('[assets] ressource manquante : ' + id);
    }
  }

  /** Charge une liste d'images ; `onProgress` reçoit une valeur de 0 à 1. */
  async load(ids: Iterable<string>, onProgress?: (p: number) => void): Promise<void> {
    const list = [...new Set(ids)].filter((id) => !this.textures.has(id));
    let done = 0;
    const total = list.length;
    if (!total) {
      onProgress?.(1);
      return;
    }
    await Promise.all(
      list.map((id) =>
        this.loadOne(id).then(() => {
          done++;
          onProgress?.(done / total);
        }),
      ),
    );
  }

  private loadOne(id: string): Promise<void> {
    const running = this.pending.get(id);
    if (running) return running;
    const info = this.images[id];
    if (!info) {
      this.noteMissing(id);
      this.textures.set(id, this.getPlaceholder());
      return Promise.resolve();
    }
    const p = new Promise<void>((resolve) => {
      this.loader.load(
        this.base + info.file,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(4, this.maxAnisotropy);
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          this.textures.set(id, tex);
          resolve();
        },
        undefined,
        () => {
          this.noteMissing(id);
          this.textures.set(id, this.getPlaceholder());
          resolve();
        },
      );
    }).finally(() => this.pending.delete(id));
    this.pending.set(id, p);
    return p;
  }

  /** Texture déjà chargée, ou le repère de remplacement (le chargement est alors lancé en arrière-plan). */
  tex(id: string): THREE.Texture {
    const t = this.textures.get(id);
    if (t) return t;
    void this.loadOne(id);
    return this.getPlaceholder();
  }

  isLoaded(id: string): boolean {
    return this.textures.has(id);
  }

  /** Libère les textures qui ne font pas partie de la liste à conserver (changement de niveau). */
  release(keep: Set<string>): void {
    for (const [id, tex] of this.textures) {
      if (keep.has(id) || tex === this.placeholder || this.generated.has(id)) continue;
      tex.dispose();
      this.textures.delete(id);
    }
  }

  private getPlaceholder(): THREE.Texture {
    if (this.placeholder) return this.placeholder;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 ? '#ff4fd8' : '#3a1040';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    g.fillStyle = '#fff';
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 32, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.placeholder = tex;
    return tex;
  }
}
