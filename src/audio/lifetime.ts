/** Timers, decodes and sources owned by one visit to the campsite. */
export class AudioLifetime {
  private readonly abort = new AbortController();
  private readonly timers = new Set<number>();
  private readonly sources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  disposed = false;

  get signal() {
    return this.abort.signal;
  }

  later(callback: () => void, delay: number) {
    if (this.disposed) return;
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (!this.disposed) callback();
    }, delay);
    this.timers.add(timer);
  }

  source<T extends AudioScheduledSourceNode>(source: T, ...nodes: AudioNode[]): T {
    this.sources.set(source, nodes);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
    return source;
  }

  dispose(context: AudioContext | null) {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    for (const [source, nodes] of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // A source may already have reached its scheduled end.
      }
      source.disconnect();
      for (const node of nodes) node.disconnect();
    }
    this.sources.clear();
    if (context) void context.close().catch(() => undefined);
  }
}
