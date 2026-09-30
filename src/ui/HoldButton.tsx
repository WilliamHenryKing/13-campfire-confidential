import { type ReactNode, useEffect, useRef } from "react";
import { createHold } from "./hold";

// A button that repeats while held (pointer), and fires once per keyboard activation.

export function HoldButton({
  onPress,
  label,
  children,
  className = "",
  keyHint,
  keyShortcut,
  disabled = false,
  identity,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  keyHint?: string;
  keyShortcut?: string;
  disabled?: boolean;
  identity?: string | number;
}) {
  const press = useRef(onPress);
  press.current = onPress;
  const target = useRef({ identity, disabled });
  target.current = { identity, disabled };
  const heldIdentity = useRef(identity);
  const hold = useRef<ReturnType<typeof createHold> | null>(null);
  if (!hold.current) {
    hold.current = createHold(
      () => {
        if (target.current.disabled || heldIdentity.current !== target.current.identity) {
          hold.current?.cancel();
          return;
        }
        press.current();
      },
      {
        set: (fn, delay) => window.setTimeout(fn, delay),
        clear: (id) => window.clearTimeout(id),
      },
    );
  }
  const session = hold.current;
  const stop = () => session.cancel();
  useEffect(() => {
    if (disabled || heldIdentity.current !== identity) session.cancel();
  }, [session, identity, disabled]);
  useEffect(() => {
    const cancel = () => session.cancel();
    const visibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [session]);

  const end = (id: number, button: HTMLButtonElement) => {
    session.end(id);
    if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={keyShortcut}
      title={keyHint ? `${label} (${keyHint})` : label}
      className={`pad-btn ${className}`}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0 || !e.isPrimary) return;
        heldIdentity.current = identity;
        if (session.begin(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!session.isActive(e.pointerId)) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          end(e.pointerId, e.currentTarget);
      }}
      onPointerUp={(e) => end(e.pointerId, e.currentTarget)}
      onPointerLeave={stop}
      onPointerCancel={(e) => end(e.pointerId, e.currentTarget)}
      onLostPointerCapture={(e) => session.end(e.pointerId)}
      onBlur={stop}
      onClick={(e) => {
        // Pointer down already fired. Keyboard and assistive clicks have detail zero.
        if (e.detail === 0 && !disabled) press.current();
      }}
    >
      {children}
    </button>
  );
}
