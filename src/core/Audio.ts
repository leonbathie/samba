/**
 * Moteur sonore entièrement synthétisé (Web Audio) : aucune piste ni aucun échantillon externe.
 * Les musiques sont des compositions originales générées par un petit séquenceur
 * (balafon, kora, basse, djembé, cloche, shaker) ; les ambiances et les bruitages sont
 * produits par des oscillateurs et du bruit filtré. Musique et effets ont des volumes séparés.
 */
import { rng } from './math';

export type MusicTheme = 'menu' | 'village' | 'arbres' | 'riviere' | 'savane' | 'mangrove' | 'grotte' | 'fete';
export type Ambience = 'vent' | 'eau' | 'cascade' | 'oiseaux' | 'village' | 'nuit' | 'grotte' | 'fete';
export type Sfx =
  | 'jump' | 'land' | 'coin' | 'pickup' | 'heart' | 'gem' | 'key' | 'throw' | 'sling' | 'hit' | 'bonk' | 'hurt'
  | 'guard' | 'deflect' | 'splash' | 'chest' | 'checkpoint' | 'door' | 'blip' | 'click' | 'quest' | 'levelEnd'
  | 'defeat' | 'monkey' | 'hiss' | 'snap' | 'laugh' | 'snort' | 'alert' | 'target' | 'wrong' | 'secret' | 'step'
  | 'feather' | 'grab';

interface Track {
  inst: 'balafon' | 'kora' | 'bass' | 'pad' | 'drum' | 'bell' | 'shaker' | 'clap';
  /** Une chaîne par mesure. Mélodie : chiffre = degré de la gamme, lettre a-e = degrés 10-14, '.' = silence.
   *  Percussion : B = basse, T = ton, S = claqué, x = frappe légère. */
  bars: string[];
  octave?: number;
  vol?: number;
}

interface Song {
  bpm: number;
  /** Pas par mesure (12 = mesure ternaire, 16 = binaire). */
  steps: number;
  /** Demi-tons de la gamme à partir de la tonique. */
  scale: number[];
  /** Note MIDI de la tonique. */
  root: number;
  tracks: Track[];
}

const PENTA_MAJ = [0, 2, 4, 7, 9];
const PENTA_MIN = [0, 3, 5, 7, 10];
const HEPTA = [0, 2, 3, 5, 7, 9, 10];

const SONGS: Record<MusicTheme, Song> = {
  menu: {
    bpm: 88, steps: 12, scale: PENTA_MAJ, root: 62,
    tracks: [
      { inst: 'kora', octave: 0, vol: 0.5, bars: ['0.2.4.7.4.2.', '0.2.4.7.9.7.', '2.4.7.9.7.4.', '0.2.4.2.0...'] },
      { inst: 'balafon', octave: 1, vol: 0.32, bars: ['....7.....9.', '....7...4...', '....9.....7.', '....4.......'] },
      { inst: 'bass', octave: -2, vol: 0.5, bars: ['0.....0.....', '0.....4.....', '2.....2.....', '0.....0.....'] },
      { inst: 'shaker', vol: 0.12, bars: ['x.xx.xx.xx.x'] },
    ],
  },
  village: {
    bpm: 108, steps: 12, scale: PENTA_MAJ, root: 60,
    tracks: [
      { inst: 'balafon', octave: 1, vol: 0.42, bars: ['0.2.4.2.0.4.', '5.4.2.4.2...', '0.2.4.5.7.5.', '4.2.0.2.0...'] },
      { inst: 'kora', octave: 0, vol: 0.3, bars: ['0.4.7.0.4.7.', '2.5.9.2.5.9.', '0.4.7.0.4.7.', '4.7.9.4.2.0.'] },
      { inst: 'bass', octave: -2, vol: 0.5, bars: ['0.....4..4..', '2.....5..5..', '0.....4..4..', '4.....0.....'] },
      { inst: 'drum', vol: 0.5, bars: ['B..T.TB.ST.T', 'B..T.TB.STST'] },
      { inst: 'bell', vol: 0.14, bars: ['x.x.xx.x.x.x'] },
      { inst: 'shaker', vol: 0.1, bars: ['xxxxxxxxxxxx'] },
    ],
  },
  arbres: {
    bpm: 120, steps: 12, scale: PENTA_MAJ, root: 65,
    tracks: [
      { inst: 'balafon', octave: 1, vol: 0.42, bars: ['0.4.2.5.4.7.', '5.4.2.0.2...', '0.4.2.5.4.7.', '9.7.5.4.2.0.'] },
      { inst: 'kora', octave: 0, vol: 0.26, bars: ['0..4..7..4..', '2..5..9..5..'] },
      { inst: 'bass', octave: -2, vol: 0.46, bars: ['0.....0..2..', '4.....4..2..'] },
      { inst: 'drum', vol: 0.42, bars: ['B.TT.SB.T.S.', 'B.TT.SB.TTS.'] },
      { inst: 'shaker', vol: 0.1, bars: ['x.xx.xx.xx.x'] },
    ],
  },
  riviere: {
    bpm: 96, steps: 12, scale: HEPTA, root: 57,
    tracks: [
      { inst: 'kora', octave: 0, vol: 0.46, bars: ['0.2.4.7.4.2.', '1.3.5.8.5.3.', '0.2.4.7.9.7.', '6.4.2.4.2.0.'] },
      { inst: 'balafon', octave: 1, vol: 0.3, bars: ['....4.....7.', '....5.....3.', '....7.....9.', '....4.....0.'] },
      { inst: 'bass', octave: -2, vol: 0.46, bars: ['0.....0.....', '1.....1.....', '0.....4.....', '6.....0.....'] },
      { inst: 'drum', vol: 0.3, bars: ['B....TB..T..'] },
      { inst: 'shaker', vol: 0.1, bars: ['x..x..x..x..'] },
    ],
  },
  savane: {
    bpm: 126, steps: 16, scale: PENTA_MIN, root: 57,
    tracks: [
      { inst: 'balafon', octave: 1, vol: 0.4, bars: ['0..3.4..7..4.3..', '0..3.4..7.9.7.4.', '5..4.3..0..3.4..', '7..5.4..3.0.....'] },
      { inst: 'bass', octave: -2, vol: 0.52, bars: ['0...0..0..3.4...', '0...0..0..7.5...'] },
      { inst: 'drum', vol: 0.55, bars: ['B.xTB.T.B.xTBST.', 'B.xTB.T.BSTSBSTS'] },
      { inst: 'bell', vol: 0.12, bars: ['x...x..x..x.x...'] },
      { inst: 'shaker', vol: 0.1, bars: ['x.x.x.x.x.x.x.x.'] },
    ],
  },
  mangrove: {
    bpm: 84, steps: 12, scale: PENTA_MIN, root: 55,
    tracks: [
      { inst: 'kora', octave: 0, vol: 0.4, bars: ['0...3.4...7.', '5...4.3...0.', '0...3.4...7.', '9...7.5...4.'] },
      { inst: 'pad', octave: -1, vol: 0.16, bars: ['0...........', '3...........', '0...........', '4...........'] },
      { inst: 'bass', octave: -2, vol: 0.42, bars: ['0.....0.....', '3.....3.....', '0.....0.....', '4.....4.....'] },
      { inst: 'drum', vol: 0.3, bars: ['B.....T..T..', 'B..T..T.....'] },
      { inst: 'shaker', vol: 0.08, bars: ['x..x.xx..x.x'] },
    ],
  },
  grotte: {
    bpm: 72, steps: 16, scale: PENTA_MIN, root: 50,
    tracks: [
      { inst: 'balafon', octave: 1, vol: 0.3, bars: ['0.....3...4.....', '7.....5...4.....', '0.....3...4...7.', '5...4...3.......'] },
      { inst: 'pad', octave: -1, vol: 0.2, bars: ['0...............', '3...............', '0...............', '4...............'] },
      { inst: 'bass', octave: -2, vol: 0.4, bars: ['0.......0.......', '3.......3.......'] },
      { inst: 'drum', vol: 0.28, bars: ['B.......T.....T.', 'B.....B.T.......'] },
    ],
  },
  fete: {
    bpm: 132, steps: 12, scale: PENTA_MAJ, root: 62,
    tracks: [
      { inst: 'balafon', octave: 1, vol: 0.46, bars: ['0.2.4.7.4.2.', '4.7.9.7.4.2.', '0.2.4.7.9.a.', '9.7.4.2.0.0.'] },
      { inst: 'kora', octave: 0, vol: 0.32, bars: ['0.4.7.4.0.4.', '2.5.9.5.2.5.', '0.4.7.4.0.4.', '4.7.9.7.4.0.'] },
      { inst: 'bass', octave: -2, vol: 0.55, bars: ['0..0..4..4..', '2..2..5..5..', '0..0..4..4..', '4..4..0..0..'] },
      { inst: 'drum', vol: 0.62, bars: ['B.TTSTB.TTST', 'BSTTSTBSTSTS'] },
      { inst: 'bell', vol: 0.16, bars: ['x.x.xx.x.x.x'] },
      { inst: 'shaker', vol: 0.12, bars: ['xxxxxxxxxxxx'] },
      { inst: 'clap', vol: 0.2, bars: ['...x.....x..'] },
    ],
  },
};

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private musicOn = true;
  private sfxOn = true;
  private musicVol = 0.6;
  private sfxVol = 0.8;

  private theme: MusicTheme | null = null;
  private wanted: MusicTheme | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;

  private ambWanted: Ambience[] = [];
  private ambNodes = new Map<Ambience, { stop: () => void }>();
  private ambTimers: number[] = [];
  private rand = rng(20261112);
  private lastSfx = new Map<string, number>();

  /** À appeler lors d'un geste de l'utilisateur (clic, touche) : les navigateurs l'exigent. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.ambBus = ctx.createGain();
      // Petit écho commun à la musique : donne de l'espace sans réverbération coûteuse.
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.19;
      const fb = ctx.createGain();
      fb.gain.value = 0.22;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      this.musicBus.connect(this.master);
      this.musicBus.connect(delay);
      delay.connect(lp).connect(fb).connect(delay);
      lp.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambBus.connect(this.master);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      const r = rng(7);
      for (let i = 0; i < len; i++) data[i] = r() * 2 - 1;
      this.applyVolumes();
      if (this.wanted) this.startMusic(this.wanted);
      this.refreshAmbience();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  configure(o: { musicOn: boolean; sfxOn: boolean; musicVol: number; sfxVol: number }): void {
    this.musicOn = o.musicOn;
    this.sfxOn = o.sfxOn;
    this.musicVol = o.musicVol;
    this.sfxVol = o.sfxVol;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicOn ? this.musicVol * 0.55 : 0, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? this.sfxVol * 0.8 : 0, now, 0.03);
    this.ambBus.gain.setTargetAtTime(this.sfxOn ? this.sfxVol * 0.5 : 0, now, 0.2);
  }

  /** Met le son en sourdine quand le jeu est en pause ou l'onglet masqué. */
  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(paused ? 0.25 : 0.9, this.ctx.currentTime, 0.08);
  }

  suspend(on: boolean): void {
    if (!this.ctx) return;
    if (on) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  // ------------------------------------------------------------------ musique

  playMusic(theme: MusicTheme | null): void {
    this.wanted = theme;
    if (!this.ctx) return;
    if (theme === this.theme) return;
    this.startMusic(theme);
  }

  private startMusic(theme: MusicTheme | null): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.theme = theme;
    if (!theme || !this.ctx) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.12;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.theme) return;
    const song = SONGS[this.theme];
    const stepDur = (60 / song.bpm) * (song.steps === 12 ? 1 / 3 : 1 / 4);
    // Après une longue mise en veille de l'onglet, on repart du présent au lieu de rattraper le retard.
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.14) {
      const bar = Math.floor(this.step / song.steps);
      const pos = this.step % song.steps;
      for (const tr of song.tracks) {
        const ch = tr.bars[bar % tr.bars.length][pos];
        if (!ch || ch === '.') continue;
        this.playNote(song, tr, ch, this.nextTime, stepDur);
      }
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playNote(song: Song, tr: Track, ch: string, time: number, stepDur: number): void {
    const vol = tr.vol ?? 0.4;
    const out = this.musicBus;
    if (tr.inst === 'drum') {
      if (ch === 'B') this.drumBass(time, vol, out);
      else if (ch === 'T') this.drumTone(time, vol * 0.8, out, 300);
      else if (ch === 'S') this.drumSlap(time, vol * 0.7, out);
      else this.drumTone(time, vol * 0.35, out, 380);
      return;
    }
    if (tr.inst === 'shaker') return this.noiseHit(time, vol, out, 6500, 0.035, 'highpass');
    if (tr.inst === 'clap') return this.clap(time, vol, out);
    if (tr.inst === 'bell') return this.bell(time, vol, out);
    const degree = ch >= 'a' && ch <= 'e' ? 10 + ch.charCodeAt(0) - 97 : Number(ch);
    if (!isFinite(degree)) return;
    const n = song.scale.length;
    const note = song.root + (tr.octave ?? 0) * 12 + song.scale[degree % n] + 12 * Math.floor(degree / n);
    const f = midi(note);
    if (tr.inst === 'balafon') this.balafon(f, time, vol, out);
    else if (tr.inst === 'kora') this.kora(f, time, vol, out);
    else if (tr.inst === 'bass') this.tone(f, time, 0.34, vol, out, 'sine', 0.008);
    else if (tr.inst === 'pad') this.pad(f, time, stepDur * song.steps * 0.98, vol, out);
  }

  // ------------------------------------------------------------------ instruments

  private env(time: number, attack: number, decay: number, peak: number, dest: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
    g.connect(dest);
    return g;
  }

  private tone(
    f: number, time: number, dur: number, vol: number, dest: AudioNode,
    type: OscillatorType = 'sine', attack = 0.004, f2?: number,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, time);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), time + dur);
    o.connect(this.env(time, attack, dur, vol, dest));
    o.start(time);
    o.stop(time + attack + dur + 0.05);
  }

  private noiseHit(
    time: number, vol: number, dest: AudioNode, freq: number, dur: number,
    type: BiquadFilterType = 'bandpass', q = 0.8, freq2?: number,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, time);
    if (freq2) filt.frequency.exponentialRampToValueAtTime(Math.max(30, freq2), time + dur);
    filt.Q.value = q;
    src.connect(filt).connect(this.env(time, 0.003, dur, vol, dest));
    src.start(time, this.rand() * 0.9);
    src.stop(time + dur + 0.08);
  }

  private balafon(f: number, time: number, vol: number, dest: AudioNode): void {
    this.tone(f, time, 0.3, vol, dest, 'sine', 0.002);
    this.tone(f * 4.02, time, 0.07, vol * 0.3, dest, 'sine', 0.001);
    this.noiseHit(time, vol * 0.25, dest, 2400, 0.015, 'bandpass', 1.5);
  }

  private kora(f: number, time: number, vol: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(6000, f * 6), time);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), time + 0.5);
    lp.connect(dest);
    this.tone(f, time, 0.6, vol, lp, 'triangle', 0.002);
    this.tone(f * 2.003, time, 0.3, vol * 0.35, lp, 'sawtooth', 0.002);
  }

  private pad(f: number, time: number, dur: number, vol: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, time + dur);
    g.connect(dest);
    for (const mul of [1, 1.5, 2.005]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const og = ctx.createGain();
      og.gain.value = mul === 1 ? 1 : 0.35;
      o.connect(og).connect(g);
      o.start(time);
      o.stop(time + dur + 0.05);
    }
  }

  private drumBass(time: number, vol: number, dest: AudioNode): void {
    this.tone(110, time, 0.22, vol, dest, 'sine', 0.002, 52);
    this.noiseHit(time, vol * 0.2, dest, 300, 0.03, 'lowpass');
  }

  private drumTone(time: number, vol: number, dest: AudioNode, f: number): void {
    this.tone(f, time, 0.11, vol, dest, 'triangle', 0.002, f * 0.78);
  }

  private drumSlap(time: number, vol: number, dest: AudioNode): void {
    this.noiseHit(time, vol, dest, 1900, 0.06, 'bandpass', 1.2);
    this.tone(520, time, 0.05, vol * 0.5, dest, 'triangle', 0.001, 380);
  }

  private bell(time: number, vol: number, dest: AudioNode): void {
    this.tone(1180, time, 0.09, vol, dest, 'square', 0.001);
    this.tone(1770, time, 0.06, vol * 0.6, dest, 'square', 0.001);
  }

  private clap(time: number, vol: number, dest: AudioNode): void {
    for (let i = 0; i < 3; i++) this.noiseHit(time + i * 0.012, vol, dest, 1500, 0.05, 'bandpass', 0.9);
  }

  // ------------------------------------------------------------------ ambiances

  setAmbience(list: Ambience[]): void {
    this.ambWanted = [...list];
    this.refreshAmbience();
  }

  private refreshAmbience(): void {
    if (!this.ctx) return;
    for (const [kind, node] of this.ambNodes) {
      if (!this.ambWanted.includes(kind)) {
        node.stop();
        this.ambNodes.delete(kind);
      }
    }
    for (const kind of this.ambWanted) {
      if (!this.ambNodes.has(kind)) this.ambNodes.set(kind, this.startAmbience(kind));
    }
  }

  private loopNoise(freq: number, q: number, vol: number, type: BiquadFilterType, lfoRate: number, lfoDepth: number): { stop: () => void } {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.8);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = lfoRate;
    const lg = ctx.createGain();
    lg.gain.value = vol * lfoDepth;
    lfo.connect(lg).connect(g.gain);
    src.connect(filt).connect(g).connect(this.ambBus);
    src.start();
    lfo.start();
    return {
      stop: () => {
        g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
        window.setTimeout(() => {
          try {
            src.stop();
            lfo.stop();
          } catch {
            /* déjà arrêté */
          }
        }, 1200);
      },
    };
  }

  private every(minMs: number, maxMs: number, fn: () => void): { stop: () => void } {
    let alive = true;
    const tick = (): void => {
      if (!alive) return;
      if (this.ctx && this.ctx.state === 'running' && !document.hidden) fn();
      const id = window.setTimeout(tick, minMs + this.rand() * (maxMs - minMs));
      this.ambTimers.push(id);
    };
    const first = window.setTimeout(tick, minMs * this.rand());
    this.ambTimers.push(first);
    return { stop: () => (alive = false) };
  }

  private startAmbience(kind: Ambience): { stop: () => void } {
    const ctx = this.ctx!;
    const bus = this.ambBus;
    switch (kind) {
      case 'vent':
        return this.loopNoise(420, 0.4, 0.1, 'lowpass', 0.11, 0.6);
      case 'eau':
        return this.loopNoise(950, 0.5, 0.075, 'bandpass', 0.23, 0.35);
      case 'cascade': {
        const a = this.loopNoise(600, 0.3, 0.14, 'bandpass', 0.31, 0.15);
        const b = this.loopNoise(2600, 0.4, 0.05, 'highpass', 0.17, 0.3);
        return { stop: () => (a.stop(), b.stop()) };
      }
      case 'oiseaux':
        return this.every(900, 4200, () => {
          const t0 = ctx.currentTime + 0.02;
          const base = 2300 + this.rand() * 1900;
          const n = 2 + Math.floor(this.rand() * 4);
          for (let i = 0; i < n; i++) {
            const t = t0 + i * (0.07 + this.rand() * 0.05);
            this.tone(base * (1 + this.rand() * 0.25), t, 0.07, 0.05 + this.rand() * 0.04, bus, 'sine', 0.005, base * (0.8 + this.rand() * 0.5));
          }
        });
      case 'village': {
        // Voix lointaines : bruit filtré autour des formants de la voix, découpé en « syllabes ».
        const murmur = this.loopNoise(520, 2.2, 0.03, 'bandpass', 3.7, 0.9);
        const calls = this.every(2500, 7000, () => {
          const t0 = ctx.currentTime + 0.02;
          const f = 380 + this.rand() * 260;
          for (let i = 0; i < 3; i++) this.noiseHit(t0 + i * 0.16, 0.035, bus, f * (1 + i * 0.12), 0.12, 'bandpass', 5);
        });
        return { stop: () => (murmur.stop(), calls.stop()) };
      }
      case 'nuit':
        return this.every(350, 900, () => {
          const t0 = ctx.currentTime + 0.02;
          const f = 4100 + this.rand() * 500;
          for (let i = 0; i < 5; i++) this.tone(f, t0 + i * 0.045, 0.025, 0.018, bus, 'sine', 0.004);
        });
      case 'grotte': {
        const drone = this.loopNoise(140, 1.2, 0.09, 'lowpass', 0.07, 0.5);
        const drips = this.every(700, 3200, () => {
          const t0 = ctx.currentTime + 0.02;
          const f = 1100 + this.rand() * 1300;
          this.tone(f, t0, 0.12, 0.06, bus, 'sine', 0.002, f * 1.6);
          this.tone(f, t0 + 0.21, 0.1, 0.02, bus, 'sine', 0.002, f * 1.6);
        });
        return { stop: () => (drone.stop(), drips.stop()) };
      }
      case 'fete':
        return this.every(1800, 5200, () => {
          const t0 = ctx.currentTime + 0.02;
          for (let i = 0; i < 6; i++) this.clap(t0 + i * 0.09 + this.rand() * 0.03, 0.05, bus);
          this.noiseHit(t0, 0.03, bus, 700, 0.6, 'bandpass', 1.5, 1100);
        });
    }
  }

  // ------------------------------------------------------------------ bruitages

  sfx(name: Sfx, gain = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || ctx.state !== 'running') return;
    // Évite l'empilement du même son dans la même image (pièces ramassées en rafale…).
    const last = this.lastSfx.get(name) ?? -1;
    if (ctx.currentTime - last < 0.035) return;
    this.lastSfx.set(name, ctx.currentTime);
    const t = ctx.currentTime + 0.005;
    const d = this.sfxBus;
    const v = gain;
    const seq = (notes: number[], step: number, dur: number, vol: number, type: OscillatorType = 'sine'): void => {
      notes.forEach((n, i) => this.tone(midi(n), t + i * step, dur, vol * v, d, type, 0.003));
    };
    switch (name) {
      case 'jump': this.tone(300, t, 0.14, 0.2 * v, d, 'sine', 0.004, 620); break;
      case 'land': this.noiseHit(t, 0.16 * v, d, 260, 0.07, 'lowpass'); break;
      case 'step': this.noiseHit(t, 0.05 * v, d, 900, 0.03, 'bandpass', 1.2); break;
      case 'coin': seq([88, 93], 0.06, 0.12, 0.16, 'square'); break;
      case 'pickup': seq([76, 81], 0.05, 0.09, 0.16, 'triangle'); break;
      case 'heart': seq([72, 76, 79], 0.07, 0.16, 0.2); break;
      case 'gem': seq([79, 83, 86, 91], 0.06, 0.22, 0.18); break;
      case 'feather': seq([84, 88, 91], 0.05, 0.25, 0.14); break;
      case 'key': seq([74, 78, 81, 86], 0.08, 0.3, 0.2, 'triangle'); break;
      case 'throw': this.noiseHit(t, 0.16 * v, d, 700, 0.14, 'bandpass', 1.4, 2400); break;
      case 'sling':
        this.tone(190, t, 0.12, 0.24 * v, d, 'sawtooth', 0.002, 90);
        this.noiseHit(t + 0.02, 0.14 * v, d, 1500, 0.1, 'bandpass', 1.4, 3600);
        break;
      case 'hit': this.tone(520, t, 0.09, 0.24 * v, d, 'square', 0.002, 180); this.noiseHit(t, 0.14 * v, d, 1200, 0.05); break;
      case 'bonk': this.tone(240, t, 0.1, 0.22 * v, d, 'triangle', 0.002, 120); break;
      case 'hurt': this.tone(440, t, 0.22, 0.24 * v, d, 'square', 0.004, 150); break;
      case 'guard': this.noiseHit(t, 0.14 * v, d, 500, 0.12, 'bandpass', 1, 1600); break;
      case 'deflect': seq([91, 98], 0.03, 0.1, 0.16, 'square'); break;
      case 'splash': this.noiseHit(t, 0.3 * v, d, 1800, 0.35, 'lowpass', 0.7, 300); break;
      case 'chest': seq([60, 64, 67, 72, 76, 79], 0.07, 0.3, 0.2, 'triangle'); break;
      case 'checkpoint': seq([67, 72, 76], 0.09, 0.3, 0.18); break;
      case 'door': this.tone(160, t, 0.18, 0.2 * v, d, 'triangle', 0.01, 110); this.noiseHit(t, 0.08 * v, d, 400, 0.15, 'lowpass'); break;
      case 'blip': this.tone(660 + this.rand() * 160, t, 0.035, 0.07 * v, d, 'triangle', 0.002); break;
      case 'click': this.tone(520, t, 0.05, 0.14 * v, d, 'triangle', 0.002, 700); break;
      case 'quest': seq([67, 71, 74, 79], 0.1, 0.35, 0.2, 'triangle'); break;
      case 'levelEnd': seq([60, 64, 67, 72, 67, 72, 76], 0.13, 0.4, 0.22, 'triangle'); break;
      case 'defeat': seq([67, 64, 60, 55], 0.16, 0.4, 0.18); break;
      case 'monkey':
        for (let i = 0; i < 4; i++) this.tone(900 + this.rand() * 500, t + i * 0.06, 0.05, 0.1 * v, d, 'square', 0.003, 1400 + this.rand() * 400);
        break;
      case 'hiss': this.noiseHit(t, 0.16 * v, d, 5200, 0.4, 'highpass', 0.6); break;
      case 'snap': this.tone(140, t, 0.12, 0.3 * v, d, 'square', 0.002, 60); this.noiseHit(t, 0.2 * v, d, 800, 0.08); break;
      case 'laugh':
        for (let i = 0; i < 5; i++) this.tone(500 + i * 70, t + i * 0.09, 0.07, 0.11 * v, d, 'sawtooth', 0.004, 760 + i * 70);
        break;
      case 'snort': this.noiseHit(t, 0.24 * v, d, 220, 0.2, 'lowpass', 2); this.noiseHit(t + 0.22, 0.2 * v, d, 260, 0.16, 'lowpass', 2); break;
      case 'alert': seq([81, 81], 0.09, 0.07, 0.14, 'square'); break;
      case 'target': seq([72, 79, 84], 0.06, 0.3, 0.2, 'triangle'); break;
      case 'wrong': seq([58, 54], 0.13, 0.2, 0.18, 'sawtooth'); break;
      case 'secret': seq([64, 69, 73, 76, 81], 0.08, 0.4, 0.18); break;
      case 'grab': this.noiseHit(t, 0.1 * v, d, 700, 0.05, 'bandpass', 1.5); break;
    }
  }
}
