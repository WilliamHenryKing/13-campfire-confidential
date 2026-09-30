/** Keep keyboard selection and the following Enter/Space activation on the same prop. */
export function focusProp(index: number, root: ParentNode = document): boolean {
  const button = root.querySelector<HTMLButtonElement>(`button[data-prop="${index}"]`);
  if (!button || button.disabled || button.closest("[inert]")) return false;
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

/** Keep both Tab directions on the dialog's available actions. */
export function trapDialogTab(
  event: { key: string; shiftKey?: boolean; target?: EventTarget | null; preventDefault(): void },
  actions: readonly HTMLElement[],
): void {
  if (event.key !== "Tab" || !actions.length) return;
  event.preventDefault();
  const current = actions.indexOf(event.target as HTMLElement);
  const next =
    current < 0
      ? event.shiftKey
        ? actions.length - 1
        : 0
      : (current + (event.shiftKey ? -1 : 1) + actions.length) % actions.length;
  actions[next]?.focus();
}
