import { afterEach, expect, test } from "bun:test";
import { createSoundEngine } from "../src/audio/engine";
import { AudioLifetime } from "../src/audio/lifetime";

class AudioWindow extends EventTarget {
  readonly timers = new Map<number, () => void>();
  readonly localStorage = { getItem: () => null, setItem: () => {} };
  readonly contexts: AudioContextStub[] = [];
  private timerId = 0;
  AudioContext = class extends AudioContextStub {
    constructor() {
      super();
      audioWindow.contexts.push(this);
    }
  };
  setTimeout(callback: () => void) {
    const id = ++this.timerId;
    this.timers.set(id, callback);
    return id;
  }
  clearTimeout(id: number) {
    this.timers.delete(id);
  }
}

class AudioNodeStub {
  disconnects = 0;
  connect(node: unknown) {
    return node;
  }
  disconnect() {
    this.disconnects++;
  }
}
class SourceStub extends AudioNodeStub {
  stops = 0;
  onended: (() => void) | null = null;
  stop() {
    this.stops++;
  }
}
class AudioContextStub {
  readonly destination = new AudioNodeStub();
  readonly decodes: ((buffer: AudioBuffer) => void)[] = [];
  currentTime = 0;
  state = "running";
  closes = 0;
  sources = 0;
  createGain() {
    return Object.assign(new AudioNodeStub(), {
      gain: { value: 0, setTargetAtTime: () => {} },
    });
  }
  decodeAudioData() {
    return new Promise<AudioBuffer>((resolve) => this.decodes.push(resolve));
  }
  createBufferSource() {
    this.sources++;
    return new SourceStub();
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  close() {
    this.closes++;
    this.state = "closed";
    return Promise.resolve();
  }
}

let audioWindow: AudioWindow;
const restorers: (() => void)[] = [];
function replaceGlobal(key: string, value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  restorers.push(() => {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  });
}
function fixture() {
  audioWindow = new AudioWindow();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  replaceGlobal("window", audioWindow);
  replaceGlobal("document", doc);
  return { window: audioWindow, document: doc };
}
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
afterEach(() => {
  for (const restore of restorers.splice(0).reverse()) restore();
});

test("audio teardown stops live sources, disconnects auxiliaries and closes exactly once", () => {
  fixture();
  const life = new AudioLifetime();
  const finished = new SourceStub();
  const live = new SourceStub();
  const finishedGain = new AudioNodeStub();
  const liveGain = new AudioNodeStub();
  const context = new AudioContextStub();
  life.source(
    finished as unknown as AudioScheduledSourceNode,
    finishedGain as unknown as AudioNode,
  );
  life.source(live as unknown as AudioScheduledSourceNode, liveGain as unknown as AudioNode);
  finished.onended?.();
  life.dispose(context as unknown as AudioContext);
  life.dispose(context as unknown as AudioContext);
  expect(finished.stops).toBe(0);
  expect(finished.disconnects).toBe(1);
  expect(finishedGain.disconnects).toBe(1);
  expect(live.stops).toBe(1);
  expect(live.disconnects).toBe(1);
  expect(liveGain.disconnects).toBe(1);
  expect(context.closes).toBe(1);
  expect(life.signal.aborted).toBe(true);
});

test("a queued gust cannot reschedule itself after audio disposal", () => {
  const { window } = fixture();
  const life = new AudioLifetime();
  let gusts = 0;
  const gust = () => {
    gusts++;
    life.later(gust, 100);
  };
  life.later(gust, 100);
  const alreadyQueued = [...window.timers.values()];
  life.dispose(null);
  for (const callback of alreadyQueued) callback();
  life.later(gust, 100);
  expect(gusts).toBe(0);
  expect(window.timers.size).toBe(0);
});

test("disposing before the first gesture removes the context-creation listeners", () => {
  const { window, document } = fixture();
  const engine = createSoundEngine(false);
  let notifications = 0;
  engine.subscribe(() => notifications++);
  engine.begin();
  engine.dispose();
  engine.dispose();
  window.dispatchEvent(new Event("pointerdown"));
  window.dispatchEvent(new Event("keydown"));
  document.dispatchEvent(new Event("visibilitychange"));
  engine.setMuted(true);
  expect(window.contexts).toHaveLength(0);
  expect(notifications).toBe(0);
});

test("late decoded files cannot start beds after the campsite is closed", async () => {
  const { window, document } = fixture();
  const requests: AbortSignal[] = [];
  replaceGlobal("fetch", async (_url: unknown, options: RequestInit) => {
    if (options.signal) requests.push(options.signal);
    return { arrayBuffer: async () => new ArrayBuffer(4) };
  });
  const engine = createSoundEngine(false);
  engine.begin();
  window.dispatchEvent(new Event("pointerdown"));
  await flush();
  const context = window.contexts[0];
  if (!context) throw new Error("Audio gesture did not create a context");
  expect(context.decodes.length).toBeGreaterThan(0);
  engine.dispose();
  for (const decoded of context.decodes) decoded({ duration: 3 } as AudioBuffer);
  await flush();
  window.dispatchEvent(new Event("pointerdown"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(requests.every((signal) => signal.aborted)).toBe(true);
  expect(context.sources).toBe(0);
  expect(context.closes).toBe(1);
  expect(window.contexts).toHaveLength(1);
  expect(window.timers.size).toBe(0);
});
