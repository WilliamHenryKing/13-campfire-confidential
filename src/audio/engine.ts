// Web Audio engine: music, ambience and SFX buses under one master gain. The context is
// created on the first user gesture, mute persists in localStorage, and everything is
// suspended while the tab is hidden.
import { AudioLifetime } from "./lifetime";

export type Sfx =
  | "grab"
  | "settle"
  | "tick"
  | "depth"
  | "turn"
  | "tilt"
  | "pick-metal"
  | "pick-wood"
  | "pick-leather"
  | "pick-enamel"
  | "hint"
  | "trace"
  | "reset"
  | "close"
  | "told"
  | "finale"
  | "page"
  | "lamp"
  | "click"
  | "paint";

const SFX: readonly Sfx[] = [
  "grab",
  "settle",
  "tick",
  "depth",
  "turn",
  "tilt",
  "pick-metal",
  "pick-wood",
  "pick-leather",
  "pick-enamel",
  "hint",
  "trace",
  "reset",
  "close",
  "told",
  "finale",
  "page",
  "lamp",
  "click",
  "paint",
];

/** Relative loudness per cue, so the mix is set here rather than in the files. */
const LEVEL: Partial<Record<Sfx, number>> = {
  tick: 0.35,
  depth: 0.35,
  grab: 0.5,
  settle: 0.45,
  turn: 0.5,
  tilt: 0.45,
  click: 0.4,
  close: 0.6,
  told: 0.75,
  finale: 0.8,
  lamp: 0.6,
  page: 0.6,
  paint: 0.45,
};

const MUTE_KEY = "campfire-confidential:muted";
const base = `${import.meta.env.BASE_URL}audio/`;

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export interface SoundEngine {
  dispose(): void;
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  subscribe(fn: () => void): () => void;
  /** Start music and ambience (after the first gesture); safe to call repeatedly. */
  begin(): void;
  play(name: Sfx, opts?: { rate?: number; gain?: number; jitter?: number }): void;
  /** 0..1 lamp brightness, used to dim the beds for the closing scene. */
  setMood(level: number): void;
  owl(): void;
}

export function createSoundEngine(reducedMotion: boolean): SoundEngine {
  const life = new AudioLifetime();
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let ambBus: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let muted = readMuted();
  let begun = false;
  let wantBegin = false;
  const buffers = new Map<string, AudioBuffer>();
  const pending = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();

  const load = (name: string): Promise<void> => {
    if (life.disposed || !ctx || buffers.has(name)) return Promise.resolve();
    const existing = pending.get(name);
    if (existing) return existing;
    const context = ctx;
    const job = (async () => {
      try {
        const res = await fetch(`${base}${name}.mp3`, { signal: life.signal });
        const data = await res.arrayBuffer();
        if (life.disposed) return;
        const buffer = await context.decodeAudioData(data);
        if (!life.disposed && ctx === context) buffers.set(name, buffer);
      } catch {
        // Missing files and cancelled visits stay silent.
      }
    })().finally(() => pending.delete(name));
    pending.set(name, job);
    return job;
  };

  const loop = (name: string, bus: GainNode, gain: number, fadeIn: number) => {
    const buf = buffers.get(name);
    if (life.disposed || !ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    // MP3 frames pad both ends; loop inside them to avoid a click.
    src.loopStart = Math.min(0.06, buf.duration / 4);
    src.loopEnd = Math.max(src.loopStart + 0.1, buf.duration - 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + fadeIn);
    src.connect(g).connect(bus);
    life.source(src, g);
    src.start(ctx.currentTime, src.loopStart);
    return g;
  };

  /** Soft filtered-noise bed: lantern hiss. Tiny and procedural. */
  const hiss = (bus: GainNode) => {
    if (life.disposed || !ctx) return;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 4200;
    band.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    if (!reducedMotion) {
      // Flicker: a slow wobble on the hiss level.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const depth = ctx.createGain();
      depth.gain.value = 0.004;
      lfo.connect(depth).connect(g.gain);
      life.source(lfo, depth);
      lfo.start();
    }
    src.connect(band).connect(g).connect(bus);
    life.source(src, band, g);
    src.start();
  };

  const startBeds = async () => {
    if (!ctx || !musicBus || !ambBus) return;
    await Promise.all(["amb-crickets", "amb-fire", "amb-wind"].map(load));
    if (life.disposed || !ctx || !ambBus || !musicBus) return;
    loop("amb-crickets", ambBus, 0.55, 3);
    loop("amb-fire", ambBus, 0.35, 4);
    const wind = loop("amb-wind", ambBus, 0.12, 6);
    if (wind && !reducedMotion) {
      // Canvas-wind gusts: slow random swells on the wind layer.
      const gust = () => {
        if (life.disposed || !ctx) return;
        const t = ctx.currentTime;
        wind.gain.cancelScheduledValues(t);
        wind.gain.setValueAtTime(wind.gain.value, t);
        wind.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.22, t + 2 + Math.random() * 3);
        life.later(gust, 5000 + Math.random() * 7000);
      };
      life.later(gust, 6000);
    }
    hiss(ambBus);
    await load("music-meadow-thoughts");
    if (life.disposed || !ctx || !musicBus) return;
    loop("music-meadow-thoughts", musicBus, 0.5, 5);
    const hoot = () => {
      engine.owl();
      life.later(hoot, 35000 + Math.random() * 40000);
    };
    life.later(hoot, 20000 + Math.random() * 15000);
  };

  const init = () => {
    if (life.disposed || ctx) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    ambBus = ctx.createGain();
    sfxBus = ctx.createGain();
    for (const bus of [musicBus, ambBus, sfxBus]) bus.connect(master);
    for (const name of SFX) void load(`sfx-${name}`);
    if (document.hidden || muted) void ctx.suspend();
    if (wantBegin) engine.begin();
  };

  const onGesture = () => {
    init();
    if (ctx && !muted && !document.hidden) void ctx.resume();
  };
  window.addEventListener("pointerdown", onGesture, { capture: true });
  window.addEventListener("keydown", onGesture, { capture: true });

  const onVisibility = () => {
    if (!ctx) return;
    if (document.hidden || muted) void ctx.suspend();
    else void ctx.resume();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const engine: SoundEngine = {
    dispose() {
      if (life.disposed) return;
      window.removeEventListener("pointerdown", onGesture, { capture: true });
      window.removeEventListener("keydown", onGesture, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      life.dispose(ctx);
      ctx = null;
      master = musicBus = ambBus = sfxBus = null;
      listeners.clear();
      pending.clear();
      buffers.clear();
    },
    get muted() {
      return muted;
    },
    setMuted(next) {
      if (life.disposed) return;
      muted = next;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        // Not persisted in private mode; the toggle still works for this visit.
      }
      if (ctx && master) {
        master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.05);
        if (next)
          life.later(() => {
            if (muted) void ctx?.suspend();
          }, 200);
        else if (!document.hidden) void ctx.resume();
      }
      for (const fn of listeners) fn();
    },
    subscribe(fn) {
      if (life.disposed) return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    begin() {
      if (life.disposed) return;
      wantBegin = true;
      if (!ctx || begun) return;
      begun = true;
      void startBeds();
    },
    play(name, opts = {}) {
      if (life.disposed || !ctx || !sfxBus || muted || ctx.state !== "running") return;
      const buf = buffers.get(`sfx-${name}`);
      if (!buf) {
        // Still decoding right after the first gesture: play it if it arrives promptly.
        const asked = performance.now();
        void load(`sfx-${name}`).then(() => {
          if (buffers.has(`sfx-${name}`) && performance.now() - asked < 500)
            engine.play(name, opts);
        });
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const jitter = opts.jitter ?? 0.04;
      src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jitter);
      const g = ctx.createGain();
      g.gain.value = (LEVEL[name] ?? 0.55) * (opts.gain ?? 1);
      src.connect(g).connect(sfxBus);
      life.source(src, g);
      src.start();
    },
    setMood(level) {
      if (!ctx || !musicBus || !ambBus) return;
      musicBus.gain.setTargetAtTime(0.55 + 0.45 * level, ctx.currentTime, 1.2);
      ambBus.gain.setTargetAtTime(0.7 + 0.3 * level, ctx.currentTime, 1.2);
    },
    owl() {
      // A distant tawny-owl "hoo … hoo-hoo", synthesised: two gliding sines through a
      // lowpass, quiet and far away.
      if (!ctx || !ambBus || muted || ctx.state !== "running") return;
      const t0 = ctx.currentTime + 0.05;
      const notes: [number, number, number][] = [
        [0, 0.55, 1],
        [0.95, 0.22, 0.7],
        [1.25, 0.6, 0.9],
      ];
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const out = ctx.createGain();
      out.gain.value = 0.06;
      lp.connect(out).connect(ambBus);
      for (const [at, dur, amp] of notes) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(420, t0 + at);
        o.frequency.linearRampToValueAtTime(360, t0 + at + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0 + at);
        g.gain.linearRampToValueAtTime(amp, t0 + at + 0.06);
        g.gain.setTargetAtTime(0, t0 + at + dur * 0.6, dur * 0.25);
        o.connect(g).connect(lp);
        life.source(o, g, ...(at === 1.25 ? [lp, out] : []));
        o.start(t0 + at);
        o.stop(t0 + at + dur + 0.6);
      }
    },
  };
  return engine;
}
