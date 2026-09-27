import { useSyncExternalStore } from "react";
import type { SoundEngine } from "../audio/engine";

// Persistent sound toggle (also M). Sits in the top-right corner in every phase.

export function MuteButton({ sound }: { sound: SoundEngine }) {
  const muted = useSyncExternalStore(
    sound.subscribe,
    () => sound.muted,
    () => sound.muted,
  );
  return (
    <button
      type="button"
      className="mute"
      aria-pressed={muted}
      aria-label={muted ? "Sound off. Turn sound on (M)" : "Sound on. Mute (M)"}
      title={muted ? "Unmute (M)" : "Mute (M)"}
      onClick={() => sound.setMuted(!muted)}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" fill="none" />
        ) : (
          <path
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
