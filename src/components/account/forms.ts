/**
 * Form plumbing shared by the two account pages.
 *
 * Field-level errors sit next to their control, form-level answers sit in the
 * block under the form, and a submit button is disabled for the whole flight.
 * Everything here works on `data-` hooks so the markup decides the layout and
 * this file decides only the behaviour.
 */

export type MessageVariant = "error" | "warning" | "success" | "info";

/** Puts a field-level problem next to its control and marks the control invalid. */
export function setFieldError(scope: ParentNode, field: string, message: string): void {
  const hint = scope.querySelector<HTMLElement>(`[data-field-error="${field}"]`);
  if (hint !== null) {
    hint.textContent = message;
    hint.hidden = false;
  }
  for (const control of scope.querySelectorAll<HTMLElement>(`[data-field-input="${field}"]`)) {
    control.setAttribute("aria-invalid", "true");
    if (hint !== null && hint.id !== "") {
      // A field may already describe itself (a password rule, for instance):
      // the error is appended rather than dropped or replaced.
      const described = (control.getAttribute("aria-describedby") ?? "").split(/\s+/u).filter((id) => id !== "");
      if (!described.includes(hint.id)) described.push(hint.id);
      control.setAttribute("aria-describedby", described.join(" "));
    }
  }
}

/** Clears every field-level error inside a scope. A missing scope is a no-op,
 *  so a caller can hand it the result of a query without a null check. */
export function clearFieldErrors(scope: ParentNode | null): void {
  if (scope === null) return;
  for (const hint of scope.querySelectorAll<HTMLElement>("[data-field-error]")) {
    hint.textContent = "";
    hint.hidden = true;
  }
  for (const control of scope.querySelectorAll<HTMLElement>("[data-field-input]")) {
    control.removeAttribute("aria-invalid");
    const described = (control.getAttribute("aria-describedby") ?? "")
      .split(/\s+/u)
      .filter((id) => id !== "" && !id.endsWith("-error"));
    if (described.length === 0) control.removeAttribute("aria-describedby");
    else control.setAttribute("aria-describedby", described.join(" "));
  }
}

/** Disables a submit for the whole request; the label is restored afterwards. */
export function setBusy(button: HTMLButtonElement, busy: boolean, busyLabel = "Attendi…"): void {
  if (busy) {
    const label = button.querySelector<HTMLElement>("[data-busy-label]") ?? button;
    const idle = label.dataset.idleLabel ?? label.textContent ?? "";
    label.dataset.idleLabel = idle;
    label.textContent = busyLabel;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    return;
  }
  const label = button.querySelector<HTMLElement>("[data-busy-label]") ?? button;
  if (label.dataset.idleLabel !== undefined) {
    label.textContent = label.dataset.idleLabel;
    delete label.dataset.idleLabel;
  }
  button.disabled = false;
  button.removeAttribute("aria-busy");
}

/** Shows one message in a state block; `null` hides it. */
export function setMessage(
  element: HTMLElement | null,
  message: string | null,
  variant: MessageVariant = "error",
): void {
  if (element === null) return;
  if (message === null || message === "") {
    element.textContent = "";
    element.hidden = true;
    element.removeAttribute("role");
    return;
  }
  element.textContent = message;
  element.classList.remove("error", "warning", "success", "info");
  element.classList.add(variant);
  element.hidden = false;
  element.setAttribute("role", variant === "error" ? "alert" : "status");
}

/**
 * Binds every show/hide password control on the page. The button names its
 * input through `aria-controls`, so a form with two password fields has two
 * independent toggles.
 */
export function bindPasswordReveal(root: ParentNode): void {
  for (const toggle of root.querySelectorAll<HTMLButtonElement>("[data-password-reveal]")) {
    toggle.addEventListener("click", () => {
      const id = toggle.getAttribute("aria-controls") ?? "";
      const input = id === "" ? null : document.getElementById(id);
      if (!(input instanceof HTMLInputElement)) return;
      const revealed = input.type === "text";
      input.type = revealed ? "password" : "text";
      toggle.setAttribute("aria-pressed", String(!revealed));
      toggle.setAttribute("aria-label", revealed ? "Mostra la password" : "Nascondi la password");
      // `[data-reveal-visible]` is the crossed-out eye: it stands for "the
      // password is readable now, press to hide it again".
      const visibleIcon = toggle.querySelector<HTMLElement>("[data-reveal-visible]");
      const secretIcon = toggle.querySelector<HTMLElement>("[data-reveal-secret]");
      if (visibleIcon !== null) visibleIcon.hidden = !revealed;
      if (secretIcon !== null) secretIcon.hidden = revealed;
    });
  }
}
