import { COPY } from "../workbench/copy";
import styles from "./Onboarding.module.css";

/** Shared first-step content; extraction keeps the root onboarding island within its source-size budget. */
export function OnboardingWelcome358({ onStart }: { readonly onStart: () => void }) {
  return (
    <div class={styles.welcome}>
      <span class={styles.mark}>
        <svg viewBox="0 0 32 32" width="56" height="56" role="presentation" aria-hidden="true" focusable="false">
          <polygon class={styles.markTop} points="16 2.5 29 10 16 17.5 3 10" />
          <polygon class={styles.markLeft} points="3 10 16 17.5 16 30.5 3 23" />
          <polygon class={styles.markRight} points="16 17.5 29 10 29 23 16 30.5" />
        </svg>
      </span>
      <h1 id="welcome-title" class={styles.welcomeTitle}>{COPY.onboarding.title}</h1>
      <p class={styles.welcomeLede}>{COPY.onboarding.lede}</p>
      <p class={styles.muted}>In 4 passaggi scegli cosa fai, ricevi strumenti consigliati e salvi la selezione su questo dispositivo. Puoi cambiarla in seguito.</p>
      <div class={styles.actions}>
        <button class="btn btn-primary btn-lg" type="button" data-onboarding-action="start" onClick={onStart}>
          {COPY.onboarding.start}
        </button>
        <a class={styles.skipLink} href="/strumenti/">{COPY.onboarding.skip}</a>
      </div>
    </div>
  );
}
