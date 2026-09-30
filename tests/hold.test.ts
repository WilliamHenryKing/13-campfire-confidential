import { describe, expect, test } from "bun:test";
import { createHold, type HoldClock } from "../src/ui/hold";

function fixture(press?: () => void) {
  let now = 0;
  let id = 0;
  let presses = 0;
  const tasks = new Map<number, { at: number; fn: () => void }>();
  const clock: HoldClock = {
    set(fn, delay) {
      const next = ++id;
      tasks.set(next, { at: now + delay, fn });
      return next;
    },
    clear(timer) {
      tasks.delete(timer);
    },
  };
  const hold = createHold(() => {
    presses++;
    press?.();
  }, clock);
  return {
    hold,
    tasks,
    presses: () => presses,
    advance(ms: number) {
      const until = now + ms;
      for (;;) {
        const next = [...tasks.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        now = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
      now = until;
    },
  };
}

describe("held controls", () => {
  test("a tap is immediate; holding repeats after the deliberate delay, then stops on release", () => {
    const f = fixture();
    expect(f.hold.begin(1)).toBe(true);
    expect(f.presses()).toBe(1);
    f.advance(379);
    expect(f.presses()).toBe(1);
    f.advance(1);
    expect(f.presses()).toBe(2);
    f.advance(140);
    expect(f.presses()).toBe(4);
    f.hold.end(1);
    f.advance(10_000);
    expect(f.presses()).toBe(4);
    expect(f.tasks.size).toBe(0);
  });

  test("a second pointer cannot create an orphan loop or release the first hold", () => {
    const f = fixture();
    f.hold.begin(3);
    expect(f.hold.begin(4)).toBe(false);
    expect(f.hold.begin(3)).toBe(false);
    expect(f.tasks.size).toBe(1);
    f.hold.end(4);
    expect(f.hold.isActive(3)).toBe(true);
    f.advance(380);
    expect(f.presses()).toBe(2);
    f.hold.end(3);
    f.advance(1_000);
    expect(f.presses()).toBe(2);
  });

  test("blur, cancellation or a changed prop invalidates a tick already queued by the browser", () => {
    const f = fixture();
    f.hold.begin(1);
    const queued = [...f.tasks.values()][0]?.fn;
    expect(queued).toBeDefined();
    f.hold.cancel();
    f.hold.begin(2);
    queued?.();
    expect(f.presses()).toBe(2);
    expect(f.hold.isActive(2)).toBe(true);
    // The stale callback must also leave the new timer's handle intact.
    f.hold.cancel();
    expect(f.tasks.size).toBe(0);
    f.advance(10_000);
    expect(f.presses()).toBe(2);
  });

  test("cancellation during the first press prevents a future repeat", () => {
    const f = fixture(() => f.hold.cancel());
    f.hold.begin(1);
    expect(f.presses()).toBe(1);
    expect(f.tasks.size).toBe(0);
    f.advance(1_000);
    expect(f.presses()).toBe(1);
  });

  test("a press that changes phase or unmounts the control cannot reschedule itself", () => {
    const f = fixture(() => {
      if (f.presses() === 2) f.hold.cancel();
    });
    f.hold.begin(1);
    f.advance(2_000);
    expect(f.presses()).toBe(2);
    expect(f.tasks.size).toBe(0);
  });

  test("a cancelled gesture leaves the next gesture ready with a fresh hold delay", () => {
    const f = fixture();
    f.hold.begin(7);
    f.advance(300);
    f.hold.cancel();
    expect(f.hold.begin(8)).toBe(true);
    expect(f.presses()).toBe(2);
    f.advance(379);
    expect(f.presses()).toBe(2);
    f.advance(1);
    expect(f.presses()).toBe(3);
    f.hold.cancel();
  });
});
