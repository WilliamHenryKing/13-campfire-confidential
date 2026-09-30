export interface HoldClock {
  set(fn: () => void, delay: number): number;
  clear(id: number): void;
}

/** A single cancellable pointer hold. Cancellation also invalidates an already queued tick. */
export function createHold(press: () => void, clock: HoldClock) {
  let pointer: number | null = null;
  let timer: number | null = null;
  let generation = 0;

  const cancel = () => {
    generation++;
    pointer = null;
    if (timer !== null) clock.clear(timer);
    timer = null;
  };

  const repeat = (run: number, delay: number) => {
    timer = clock.set(() => {
      if (run !== generation || pointer === null) return;
      timer = null;
      press();
      if (run === generation && pointer !== null) repeat(run, 70);
    }, delay);
  };

  return {
    begin(id: number) {
      if (pointer !== null) return false;
      pointer = id;
      const run = ++generation;
      press();
      if (run === generation && pointer !== null) repeat(run, 380);
      return true;
    },
    end(id: number) {
      if (pointer === id) cancel();
    },
    isActive(id: number) {
      return pointer === id;
    },
    cancel,
  };
}
