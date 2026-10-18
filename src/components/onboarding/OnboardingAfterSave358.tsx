import { COPY } from "../workbench/copy";
import styles from "./Onboarding.module.css";

/** Keep the saved-state announcement while explaining the redirect and settings path. */
export function OnboardingAfterSave358({ completed }: { readonly completed: boolean }) {
  return (
    <>
      {completed && <p class="success" role="status">{COPY.onboarding.saved}</p>}
      <p class={styles.muted}>
        Dopo il salvataggio torni alla home. Potrai modificare le scelte da
        {" "}<a href="/impostazioni/#preferenze">Impostazioni e preferenze</a>, oppure sfogliare il
        {" "}<a href="/strumenti/">catalogo degli strumenti</a>.
      </p>
    </>
  );
}
