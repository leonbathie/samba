/**
 * Vue du jeu : moteur de rendu Three.js, scène et caméra de côté.
 * La caméra est en perspective : les plans placés à différentes profondeurs (z) défilent à des
 * vitesses différentes, ce qui donne le relief du décor. Le plan de jeu est z = 0.
 */
import * as THREE from 'three';

const FOV = 30;

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** Hauteur visible du plan de jeu, en unités du monde. */
  viewH = 10.5;
  aspect = 16 / 9;
  camX = 0;
  camY = 0;
  private wantedH = 10.5;
  private minW = 13;
  private canvas: HTMLCanvasElement;
  private shakeT = 0;
  private shakeAmp = 0;
  ok = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch (err) {
      this.ok = false;
      throw err;
    }
    this.renderer = renderer;
    renderer.setClearColor(0x1a1020, 1);
    renderer.sortObjects = true;
    this.camera = new THREE.PerspectiveCamera(FOV, this.aspect, 0.5, 400);
    // Lumières : elles n'agissent que sur les futurs modèles 3D (les images provisoires ne sont pas éclairées).
    this.scene.add(new THREE.HemisphereLight(0xfff2d8, 0x6b4a2e, 1.25));
    const sun = new THREE.DirectionalLight(0xffe2b0, 1.6);
    sun.position.set(-4, 9, 8);
    this.scene.add(sun);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 200));
  }

  get maxAnisotropy(): number {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  /** Distance de la caméra au plan de jeu. */
  get dist(): number {
    return this.viewH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  }

  get halfW(): number {
    return (this.viewH * this.aspect) / 2;
  }

  get halfH(): number {
    return this.viewH / 2;
  }

  /** Hauteur de vue souhaitée ; `minW` garantit une largeur visible minimale sur les écrans étroits. */
  setViewHeight(h: number, minW = 13): void {
    this.wantedH = h;
    this.minW = minW;
    this.applyViewHeight();
  }

  private applyViewHeight(): void {
    this.viewH = Math.max(this.wantedH, this.minW / this.aspect);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.place();
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.aspect = w / h;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.applyViewHeight();
  }

  setCamera(x: number, y: number): void {
    this.camX = x;
    this.camY = y;
    this.place();
  }

  shake(amp: number, time = 0.25): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, time);
  }

  private place(): void {
    let ox = 0;
    let oy = 0;
    if (this.shakeT > 0) {
      ox = (Math.random() - 0.5) * 2 * this.shakeAmp;
      oy = (Math.random() - 0.5) * 2 * this.shakeAmp;
    }
    this.camera.position.set(this.camX + ox, this.camY + oy, this.dist);
    this.camera.lookAt(this.camX + ox, this.camY + oy, 0);
  }

  update(dt: number): void {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeAmp = 0;
      this.place();
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Position à l'écran (pixels CSS) d'un point du plan de jeu : sert aux bulles et aux aides. */
  toScreen(x: number, y: number): { x: number; y: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: w / 2 + ((x - this.camX) / this.halfW) * (w / 2),
      y: h / 2 - ((y - this.camY) / this.halfH) * (h / 2),
    };
  }

  /** Taille visible (largeur, hauteur) d'un plan situé à la profondeur z. */
  sizeAt(z: number): { w: number; h: number } {
    const k = (this.dist - z) / this.dist;
    return { w: this.viewH * this.aspect * k, h: this.viewH * k };
  }
}
