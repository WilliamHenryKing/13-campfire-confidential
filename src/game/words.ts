import type { Advice } from "./hints";
import { PROPS } from "./props";
import type { PropKind } from "./types";

// Plain-language feedback. Kept with the rules so it can be tested without a DOM.

/** Display names, numbering twins ("Spoon 1", "Spoon 2"). */
export function propNames(kinds: readonly PropKind[]): string[] {
  return kinds.map((kind, i) => {
    const twins = kinds.filter((k) => k === kind).length;
    if (twins < 2) return PROPS[kind].name;
    const n = kinds.slice(0, i + 1).filter((k) => k === kind).length;
    return `${PROPS[kind].name} ${n}`;
  });
}

function direction(dx: number, dy: number): string {
  const v = dy > 0 ? "up" : dy < 0 ? "down" : "";
  const h = dx > 0 ? "right" : dx < 0 ? "left" : "";
  if (v && h) return `${v} and to the ${h}`;
  return v || h || "a touch";
}

export function adviceText(advice: Advice, names: readonly string[]): string {
  const name = "index" in advice ? (names[advice.index] ?? "prop").toLowerCase() : "";
  switch (advice.kind) {
    case "offwall":
      return `The ${name}'s shadow has slipped off the tent. Bring it back toward the middle.`;
    case "overlap":
      return `The ${name}'s shadow is hidden behind the others. Move it aside so it adds to the figure.`;
    case "size":
      return advice.grow
        ? `The ${name}'s shadow wants to be bigger: bring it toward the lamp.`
        : `The ${name}'s shadow is too big: push it back toward the tent.`;
    case "turn":
      return `The ${name} shows the wrong outline. Try turning or tilting it.`;
    case "move":
      return `Move the ${name}'s shadow ${direction(advice.dx, advice.dy)}, next to the others.`;
    case "close":
      return "The pieces are all in place. Tiny nudges now.";
  }
}

export function likenessWord(score: number, pass: number): string {
  if (score >= pass) return "That's it!";
  if (score >= pass - 0.08) return "So close";
  if (score >= pass - 0.2) return "Taking shape";
  if (score >= 0.3) return "A mystery blob";
  return "Just shadows";
}
