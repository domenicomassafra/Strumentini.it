import type { ComponentChildren } from "preact";
import { navigationItemAttributes, type NavigationItem } from "./accessibility";
import styles from "./primitives.module.css";

export interface AccessibleNavProps {
  readonly label: string;
  readonly items: readonly NavigationItem[];
  readonly children?: ComponentChildren;
}

export function AccessibleNav({ label, items, children }: AccessibleNavProps) {
  return (
    <nav class={styles.nav} aria-label={label}>
      <ul class={styles.navList}>
        {items.map((item) => {
          const attributes = navigationItemAttributes(item);
          if (item.disabled === true) {
            return (
              <li key={item.href}>
                <span class={styles.navLink} role="link" aria-disabled="true">
                  <span>{item.label}</span>
                  <span class={styles.navCurrent}>Unavailable</span>
                </span>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <a class={styles.navLink} {...attributes}>
                <span>{item.label}</span>
                {item.current === true && <span class={styles.navCurrent}>Current</span>}
              </a>
            </li>
          );
        })}
      </ul>
      {children}
    </nav>
  );
}
