import type { ComponentChildren } from "preact";
import { createFieldIds, fieldControlAccessibility, type FieldControlAccessibility } from "./accessibility";
import styles from "./primitives.module.css";

export interface FormFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly children: (attributes: FieldControlAccessibility) => ComponentChildren;
}

export function FormField({ id, label, hint, error, required = false, children }: FormFieldProps) {
  const ids = createFieldIds("field", id);
  const hasDescription = hint !== undefined && hint.trim() !== "";
  const hasError = error !== undefined && error.trim() !== "";
  const attributes = fieldControlAccessibility(ids, {
    hasDescription,
    hasError,
    required,
  });
  return (
    <div class={styles.surface}>
      <label for={ids.control}>
        {label}
        {required && <span class={styles.required} aria-hidden="true"> *</span>}
      </label>
      {hasDescription && <p id={ids.description} class={styles.hint}>{hint}</p>}
      {children(attributes)}
      {hasError && (
        <p id={ids.error} class={styles.error} role="alert">{error}</p>
      )}
    </div>

  );
}
