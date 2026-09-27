import { type ReactNode, useEffect, useRef } from "react";

// A button that repeats while held (pointer), and fires once per keyboard activation.

export function HoldButton({
  onPress,
  label,
  children,
  className = "",
  keyHint,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  keyHint?: string;
}) {
  const timer = useRef<number | null>(null);
  const fromPointer = useRef(false);
  const press = useRef(onPress);
  press.current = onPress;

  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const repeat = (delay: number) => {
    timer.current = window.setTimeout(() => {
      press.current();
      repeat(70);
    }, delay);
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={keyHint ? `${label} (${keyHint})` : label}
      className={`pad-btn ${className}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        fromPointer.current = true;
        press.current();
        repeat(380);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        if (fromPointer.current) {
          fromPointer.current = false;
          return;
        }
        press.current();
      }}
    >
      {children}
    </button>
  );
}
