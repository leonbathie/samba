/**
 * Partie en cours : enchaînement des niveaux et des intérieurs, inventaire, missions, dialogues,
 * points de sauvegarde, chutes et défaites. Les scripts des niveaux n'utilisent que cette classe.
 */
import type { View } from '../render/View';
import type { Assets } from '../core/Assets';
import type { AudioEngine, Sfx } from '../core/Audio';
import type { Action, Input } from '../core/Input';
import type { Progress, SaveManager, Weapon } from '../core/Save';
import type { ModelRegistry } from '../render/characters';
import type { DoorDef, ItemDef, LevelDef } from './types';
import { Stage, solidImage } from './Stage';
import { CHARACTERS, ENEMIES, HERO, AMIE, characterImages } from './characterDefs';
import { itemImage } from './entities';
import { LEVELS, ROOMS } from './levels';
import { QUESTS, SPEAKERS } from './story';
import { t } from '../i18n';

export interface LevelStats {
  number: number;
  name: string;
  time: number;
  coins: number;
  score: number;
  bonus: number;
  hearts: number;
  last: boolean;
}

/** Ce que le jeu demande à l'interface (HUD, dialogues, écrans). Implémenté dans ui/Ui.ts. */
export interface UiBridge {
  hud(): void;
  prompt(pos: { x: number; y: number } | null, label?: string): void;
  hint(text: string | null, keys?: Action[]): void;
  toast(text: string, icon?: string): void;
  banner(title: string, sub?: string): void;
  dialogue(speaker: string, portrait: string | null, text: string, choices?: string[]): Promise<number>;
  fade(dark: boolean, ms?: number): Promise<void>;
  loading(p: number | null): void;
  levelEnd(stats: LevelStats): Promise<void>;
  adventureEnd(stats: { score: number; coins: number; time: number; gems: number }): Promise<void>;
  defeat(): Promise<void>;
  setPlaying(on: boolean): void;
  reportMissing(ids: string[]): void;
}

export type GameMode = 'idle' | 'play' | 'script' | 'transition';

const MAX_BANANAS = 20;
const MAX_STONES = 30;

export class Game {
  stage: Stage | null = null;
  mode: GameMode = 'idle';
  levelIndex = 0;
  stats = { time: 0, coins: 0, score0: 0 };
  /** Appelé quand la partie se termine ou que le joueur revient au menu. */
  onQuit: (() => void) | null = null;
  private levelStage: Stage | null = null;
  private scripts = 0;
  private saveT = 0;

  constructor(
    readonly view: View,
    readonly assets: Assets,
    readonly audio: AudioEngine,
    readonly input: Input,
    readonly save: SaveManager,
    readonly models: ModelRegistry,
    readonly ui: UiBridge,
  ) {}

  get progress(): Progress {
    return this.save.progress;
  }

  get inRoom(): boolean {
    return !!this.levelStage;
  }

  /** Description du niveau en cours (jamais celle de l'intérieur visité). */
  get level(): LevelDef | null {
    return (this.levelStage ?? this.stage)?.def ?? null;
  }

  // ------------------------------------------------------------------ drapeaux, missions, inventaire

  flag(name: string): number {
    return this.progress.flags[name] ?? 0;
  }

  has(name: string): boolean {
    return this.flag(name) > 0;
  }

  setFlag(name: string, value = 1): void {
    this.progress.flags[name] = value;
  }

  addFlag(name: string, n = 1): number {
    const v = this.flag(name) + n;
    this.progress.flags[name] = v;
    return v;
  }

  questActive(id: string): boolean {
    return this.progress.quests[id] === 'active';
  }

  questDone(id: string): boolean {
    return this.progress.quests[id] === 'done';
  }

  startQuest(id: string): void {
    if (this.progress.quests[id]) return;
    this.progress.quests[id] = 'active';
    const q = QUESTS[id];
    this.audio.sfx('quest');
    this.ui.toast(t(q?.main ? 'toast.questMain' : 'toast.questNew', { name: t(q?.title ?? id) }), 'items/parchemin');
    this.ui.hud();
    this.save.saveProgress();
  }

  completeQuest(id: string): void {
    if (this.progress.quests[id] === 'done') return;
    this.progress.quests[id] = 'done';
    const q = QUESTS[id];
    this.audio.sfx('quest');
    this.addScore(200);
    this.ui.toast(t('toast.questDone', { name: t(q?.title ?? id) }), 'items/parchemin');
    this.ui.hud();
    this.save.saveProgress();
  }

  addScore(n: number): void {
    this.progress.score += n;
    this.ui.hud();
  }

  addCoins(n: number): void {
    this.progress.coins = Math.max(0, this.progress.coins + n);
    if (n > 0) this.stats.coins += n;
    this.ui.hud();
  }

  heal(n: number): void {
    const p = this.progress;
    p.hearts = Math.min(p.maxHearts, p.hearts + n);
    this.ui.hud();
  }

  /** Donne des munitions ou un objet depuis un script (cadeau d'un habitant). */
  give(kind: 'bananas' | 'stones' | 'feather' | 'heartMax' | 'sling' | 'shield', n = 1): void {
    const p = this.progress;
    if (kind === 'bananas') p.bananas = Math.min(MAX_BANANAS, p.bananas + n);
    else if (kind === 'stones') p.stones = Math.min(MAX_STONES, p.stones + n);
    else if (kind === 'feather') p.feathers += n;
    else if (kind === 'shield') p.shield = true;
    else if (kind === 'heartMax') {
      p.maxHearts = Math.min(6, p.maxHearts + n);
      p.hearts = p.maxHearts;
    } else if (kind === 'sling') {
      p.hasSling = true;
      p.equipped = 'sling';
      p.stones = Math.min(MAX_STONES, p.stones + 10);
    }
    this.audio.sfx(kind === 'sling' || kind === 'heartMax' ? 'key' : 'pickup');
    this.ui.hud();
  }

  cycleWeapon(): void {
    const p = this.progress;
    const order: Weapon[] = p.hasSling ? ['banana', 'stone', 'sling'] : ['banana', 'stone'];
    p.equipped = order[(order.indexOf(p.equipped) + 1) % order.length];
    this.audio.sfx('click');
    this.ui.hud();
  }

  isCollected(level: string, id: string): boolean {
    return !!this.progress.collected[level]?.includes(id);
  }

  markCollected(level: string, id: string): void {
    const list = (this.progress.collected[level] ??= []);
    if (!list.includes(id)) list.push(id);
  }

  /** Le héros ramasse un objet. Renvoie faux si l'objet doit rester en place. */
  collect(def: ItemDef, x: number, y: number): boolean {
    const p = this.progress;
    const st = this.stage!;
    let color = 0xffe9a0;
    switch (def.kind) {
      case 'coin':
        this.addCoins(1);
        p.score += 10;
        this.audio.sfx('coin');
        break;
      case 'banana':
      case 'bunch':
        if (p.bananas >= MAX_BANANAS) return false;
        p.bananas = Math.min(MAX_BANANAS, p.bananas + (def.kind === 'bunch' ? 5 : 1));
        this.audio.sfx('pickup');
        this.firstTime('banana', 'toast.firstBanana');
        if (p.stones === 0 && p.equipped !== 'banana') p.equipped = 'banana';
        break;
      case 'stone':
      case 'pile':
        if (p.stones >= MAX_STONES) return false;
        p.stones = Math.min(MAX_STONES, p.stones + (def.kind === 'pile' ? 5 : 1));
        this.audio.sfx('pickup');
        this.firstTime('stone', 'toast.firstStone');
        if (p.bananas === 0 && p.equipped === 'banana') p.equipped = 'stone';
        break;
      case 'heart':
        if (p.hearts >= p.maxHearts) p.score += 25;
        p.hearts = Math.min(p.maxHearts, p.hearts + 1);
        this.audio.sfx('heart');
        color = 0xff8fa0;
        break;
      case 'gourd':
        p.hearts = p.maxHearts;
        this.audio.sfx('heart');
        this.ui.toast(t('toast.gourd'), 'items/gourde');
        color = 0xff8fa0;
        break;
      case 'gem':
        this.addFlag('gems');
        p.score += 100;
        this.audio.sfx('gem');
        this.ui.toast(t('toast.gem'), 'items/gemme');
        color = def.tint ?? 0xff9a5a;
        break;
      case 'feather':
        p.feathers += 1;
        p.score += 50;
        this.audio.sfx('feather');
        this.firstTime('feather', 'toast.firstFeather', 'items/plume');
        break;
      case 'key':
        this.addFlag('smallKey');
        this.audio.sfx('key');
        this.ui.toast(t('toast.smallKey'), 'items/cle');
        break;
      case 'shield':
        p.shield = true;
        this.audio.sfx('key');
        this.ui.toast(t('toast.shield'), 'items/bouclier');
        break;
      case 'quest':
        if (def.flag) this.addFlag(def.flag);
        this.audio.sfx('secret');
        break;
    }
    if (def.id) this.markCollected(st.def.id, def.id);
    st.fx.spark.burst({ x, y, count: def.kind === 'coin' ? 5 : 10, speed: 2.5, life: 0.45, size: 0.22, color });
    this.ui.hud();
    return true;
  }

  private firstTime(key: string, text: string, icon?: string): void {
    if (this.has('seen.' + key)) return;
    this.setFlag('seen.' + key);
    this.ui.toast(t(text), icon);
  }

  onMonkeyFriend(): void {
    if (this.addFlag('monkeyFriends') === 1) this.ui.toast(t('toast.monkeyFriend'), 'npc/singe_ami');
  }

  // ------------------------------------------------------------------ dialogues et scripts

  toast(key: string, params?: Record<string, string | number>, icon?: string): void {
    this.ui.toast(t(key, params), icon);
  }

  sfx(name: Sfx): void {
    this.audio.sfx(name);
  }

  /**
   * Exécute un script d'histoire : le jeu est suspendu (plus rien ne bouge ni ne blesse)
   * jusqu'à la fin du script.
   */
  async runScript(fn: () => Promise<void>): Promise<void> {
    if (this.mode !== 'play' && this.mode !== 'script') return;
    this.mode = 'script';
    this.scripts++;
    this.stage?.player.lock(true);
    this.ui.hint(null);
    try {
      await fn();
    } catch (err) {
      console.error('[script]', err);
    } finally {
      this.scripts--;
      if (this.scripts === 0 && this.mode === 'script') {
        this.mode = 'play';
        this.stage?.player.lock(false);
        this.input.endStep();
        this.ui.hud();
      }
    }
  }

  /** Une réplique. `who` est une clé de SPEAKERS (story.ts). */
  async say(who: string, key: string, params?: Record<string, string | number>): Promise<void> {
    const sp = SPEAKERS[who];
    await this.ui.dialogue(t(sp?.name ?? who), sp ? this.assets.url(sp.img) : null, t(key, params));
  }

  /** Une question à choix ; renvoie l'index de la réponse. */
  async choose(who: string, key: string, options: string[]): Promise<number> {
    const sp = SPEAKERS[who];
    return this.ui.dialogue(t(sp?.name ?? who), sp ? this.assets.url(sp.img) : null, t(key), options.map((o) => t(o)));
  }

  // ------------------------------------------------------------------ niveaux et intérieurs

  private collectAssets(def: LevelDef, out = new Set<string>()): Set<string> {
    out.add(def.painting ?? def.theme.backdrop);
    for (const img of characterImages(HERO)) out.add(img);
    for (const s of [...def.solids, ...def.movers]) {
      const img = solidImage(s.style);
      if (img) out.add(img);
    }
    for (const d of def.decor) out.add(d.img);
    for (const it of def.items) out.add(itemImage(it));
    for (const n of def.npcs) if (!n.ghost) for (const img of characterImages(CHARACTERS[n.char])) out.add(img);
    for (const e of def.enemies) for (const img of characterImages(ENEMIES[e.kind])) out.add(img);
    if (def.companion) for (const img of characterImages(AMIE)) out.add(img);
    if (def.climbs.some((c) => c.style === 'liane') || def.checkpoints.length) out.add('props/liane');
    if (def.targets.length) out.add('props/cible');
    for (const id of ['items/piece', 'items/banane', 'items/pierre', 'items/coeur', 'items/coffre', 'items/lanterne',
      'items/parchemin', 'items/gemme', 'items/plume', 'items/cle', 'items/bouclier', 'items/gourde']) out.add(id);
    for (const d of def.doors) {
      if (d.hut) out.add('props/case');
      const room = ROOMS[d.to];
      if (room) this.collectAssets(room(), out);
    }
    return out;
  }

  private applyTheme(def: LevelDef): void {
    this.view.renderer.setClearColor(def.theme.sky, 1);
    this.audio.playMusic(def.theme.music);
    this.audio.setAmbience(def.theme.ambience);
    if (def.kind === 'room') {
      this.view.setViewFit(def.bounds.maxX - def.bounds.minX, def.bounds.maxY - def.bounds.minY);
    } else {
      this.view.setViewHeight(def.viewH);
    }
  }

  private clearStages(): void {
    this.stage?.dispose();
    this.levelStage?.dispose();
    this.stage = null;
    this.levelStage = null;
  }

  /** Démarre un niveau depuis son début, ou depuis le dernier point de sauvegarde. */
  async startLevel(index: number, fromCheckpoint = false): Promise<void> {
    const p = this.progress;
    this.mode = 'transition';
    this.ui.prompt(null);
    this.ui.hint(null);
    await this.ui.fade(true, 250);
    this.clearStages();
    this.levelIndex = index;
    const def = LEVELS[index]();
    this.ui.loading(0);
    const ids = this.collectAssets(def);
    await this.assets.load(ids, (v) => this.ui.loading(v));
    this.assets.release(ids);
    this.ui.loading(null);
    if (this.assets.missing.length) this.ui.reportMissing(this.assets.missing);

    p.started = true;
    if (p.level !== index || !fromCheckpoint) p.checkpoint = -1;
    p.level = index;
    p.unlocked = Math.max(p.unlocked, index + 1);
    p.hearts = p.maxHearts;
    this.stats = { time: 0, coins: 0, score0: p.score };

    this.stage = new Stage(this, def);
    this.view.scene.add(this.stage.root);
    this.applyTheme(def);
    if (p.checkpoint >= 0 && def.checkpoints[p.checkpoint]) {
      const c = def.checkpoints[p.checkpoint];
      this.stage.player.place(c.x, c.y + 0.05);
      this.stage.checkpoints.forEach((cp) => cp.index <= p.checkpoint && cp.light(true));
      if (this.stage.companion) {
        this.stage.companion.body.x = c.x - 1;
        this.stage.companion.body.y = c.y + 0.05;
      }
    }
    this.stage.updateCamera(0, true);
    this.save.saveProgress();
    this.ui.setPlaying(true);
    this.ui.hud();
    this.mode = 'play';
    this.stage.update(1 / 60, false);
    await this.ui.fade(false, 350);
    this.ui.banner(t('hud.level', { n: def.number }), t(def.name));
  }

  async useDoor(door: DoorDef): Promise<void> {
    if (this.mode !== 'play' || !this.stage) return;
    if (door.to === 'exit') return this.leaveRoom();
    const factory = ROOMS[door.to];
    if (!factory) return;
    this.mode = 'transition';
    this.ui.prompt(null);
    this.ui.hint(null);
    await this.ui.fade(true, 220);
    const def = factory();
    await this.assets.load(this.collectAssets(def));
    this.levelStage = this.stage;
    this.view.scene.remove(this.levelStage.root);
    this.stage = new Stage(this, def);
    this.view.scene.add(this.stage.root);
    this.applyTheme(def);
    this.stage.updateCamera(0, true);
    this.stage.update(1 / 60, false);
    this.ui.hud();
    await this.ui.fade(false, 300);
    this.mode = 'play';
    this.ui.banner(t(def.name));
    if (door.onEnter) await this.runScript(async () => door.onEnter!(this));
  }

  private async leaveRoom(): Promise<void> {
    if (!this.levelStage || !this.stage) return;
    this.mode = 'transition';
    this.ui.prompt(null);
    this.ui.hint(null);
    await this.ui.fade(true, 220);
    this.stage.dispose();
    this.stage = this.levelStage;
    this.levelStage = null;
    this.view.scene.add(this.stage.root);
    this.applyTheme(this.stage.def);
    this.stage.player.lock(false);
    this.stage.updateCamera(0, true);
    this.stage.update(1 / 60, false);
    this.save.saveProgress();
    this.ui.hud();
    await this.ui.fade(false, 300);
    this.mode = 'play';
  }

  onCheckpoint(index: number): void {
    const p = this.progress;
    if (this.inRoom) return;
    if (index > p.checkpoint) p.checkpoint = index;
    this.save.saveProgress();
    this.ui.toast(t('toast.checkpoint'), 'items/lanterne');
  }

  /** Position de retour : dernier point de sauvegarde, sinon début du niveau ou de la pièce. */
  private respawnPoint(): { x: number; y: number } {
    const st = this.stage!;
    const def = st.def;
    const cp = def.kind === 'level' ? def.checkpoints[this.progress.checkpoint] : undefined;
    return cp ? { x: cp.x, y: cp.y + 0.05 } : { ...def.spawn };
  }

  private async bringBack(point: { x: number; y: number }, sparkle: boolean): Promise<void> {
    const st = this.stage;
    if (!st) return;
    await this.ui.fade(true, 220);
    st.player.place(point.x, point.y);
    st.player.invuln = 1.6;
    if (st.companion) {
      st.companion.body.x = point.x - 1;
      st.companion.body.y = point.y;
      st.companion.body.vx = st.companion.body.vy = 0;
    }
    st.resetFall();
    st.updateCamera(0, true);
    if (sparkle) st.fx.spark.burst({ x: point.x, y: point.y + 0.8, count: 16, speed: 3, life: 0.8, size: 0.26, color: 0xbfe9ff });
    this.ui.hud();
    await this.ui.fade(false, 260);
    if (this.mode === 'transition') this.mode = 'play';
  }

  /** Chute dans l'eau ou dans le vide. */
  onFall(): void {
    const st = this.stage;
    if (!st || this.mode !== 'play') return;
    const p = this.progress;
    this.mode = 'transition';
    st.player.state = 'gone';
    st.player.view.setOpacity(0);
    if (p.feathers > 0) {
      // Une plume de grue rattrape la chute : retour sur la dernière terre ferme, sans perdre de cœur.
      p.feathers -= 1;
      this.audio.sfx('feather');
      this.ui.toast(t('toast.featherSave'), 'items/plume');
      void this.bringBack({ x: st.player.lastSafe.x, y: st.player.lastSafe.y + 0.05 }, true);
      return;
    }
    p.hearts = Math.max(0, p.hearts - 1);
    this.audio.sfx('hurt');
    this.ui.hud();
    if (p.hearts <= 0) {
      void this.defeatSequence();
      return;
    }
    void this.bringBack(this.respawnPoint(), false);
  }

  /** Le héros n'a plus de cœur. */
  onDefeat(): void {
    if (this.mode === 'transition') return;
    this.mode = 'transition';
    void this.defeatSequence();
  }

  private async defeatSequence(): Promise<void> {
    const st = this.stage;
    if (!st) return;
    this.audio.sfx('defeat');
    st.player.state = 'gone';
    await this.ui.defeat();
    this.progress.hearts = this.progress.maxHearts;
    await this.bringBack(this.respawnPoint(), false);
  }

  /** Fin du niveau : bilan, sauvegarde, puis niveau suivant ou fin de l'aventure. */
  completeLevel(): void {
    if ((this.mode !== 'play' && this.mode !== 'script') || !this.stage) return;
    void this.finishLevel();
  }

  private async finishLevel(): Promise<void> {
    const p = this.progress;
    const def = this.level!;
    this.mode = 'transition';
    this.stage!.player.lock(true);
    this.ui.prompt(null);
    this.ui.hint(null);
    this.audio.sfx('levelEnd');
    const last = this.levelIndex >= LEVELS.length - 1;
    const bonus = p.hearts * 50 + Math.max(0, 300 - Math.floor(this.stats.time));
    p.score += bonus;
    p.unlocked = Math.min(LEVELS.length, Math.max(p.unlocked, this.levelIndex + 2));
    if (!last) {
      p.level = this.levelIndex + 1;
      p.checkpoint = -1;
    } else {
      p.finished = true;
    }
    this.save.saveProgress();
    await this.ui.levelEnd({
      number: def.number, name: t(def.name), time: this.stats.time, coins: this.stats.coins,
      score: p.score, bonus, hearts: p.hearts, last,
    });
    if (!last) {
      await this.startLevel(this.levelIndex + 1);
    } else {
      await this.ui.adventureEnd({ score: p.score, coins: p.coins, time: p.playTime, gems: this.flag('gems') });
      this.quit();
    }
  }

  /** Retour au menu : la progression est conservée. */
  quit(): void {
    this.save.saveProgress();
    this.mode = 'idle';
    this.clearStages();
    this.ui.prompt(null);
    this.ui.hint(null);
    this.ui.setPlaying(false);
    this.onQuit?.();
  }

  /** Mission principale à afficher. */
  objective(): string {
    const def = this.level;
    return def?.objective ? def.objective(this) : '';
  }

  /** Un pas de simulation. */
  update(dt: number): void {
    const st = this.stage;
    if (!st) return;
    const playing = this.mode === 'play';
    st.update(dt, playing);
    if (playing) {
      this.stats.time += dt;
      this.progress.playTime += dt;
      this.saveT += dt;
      if (this.saveT > 30) {
        this.saveT = 0;
        this.save.saveProgress();
      }
    }
  }
}
