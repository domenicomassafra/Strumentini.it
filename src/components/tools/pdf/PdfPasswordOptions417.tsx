export type PasswordMode417 = "check" | "remove" | "protect";
export function passwordActionLabel417(mode: PasswordMode417): string {
  return mode === "protect" ? "Proteggi con AES-256" : mode === "remove" ? "Sblocca o copia PDF" : "Controlla cifratura";
}

interface Props {
  readonly mode: PasswordMode417;
  readonly password: string;
  readonly disabled: boolean;
  readonly onMode: (mode: PasswordMode417) => void;
  readonly onPassword: (value: string) => void;
}

export function PdfPasswordOptions417({ mode, password, disabled, onMode, onPassword }: Props) {
  return <>
    <label class="field"><span>Modalità</span>
      <select value={mode} onChange={(event) => onMode(event.currentTarget.value as PasswordMode417)} disabled={disabled}>
        <option value="check">Controlla cifratura</option>
        <option value="protect">Proteggi con password (AES-256)</option>
        <option value="remove">Sblocca con password o copia PDF libero</option>
      </select>
    </label>
    {mode !== "check" && <label class="field">
      <span>{mode === "protect" ? "Nuova password" : "Password del PDF (vuota solo per file libero)"}</span>
      <input type="password" autoComplete="off" value={password}
        onInput={(event) => onPassword(event.currentTarget.value)}
        disabled={disabled} maxLength={127} />
      <small>Massimo 127 byte UTF-8; non viene salvata. PDF massimo 8 MiB, risultato massimo 24 MiB.</small>
    </label>}
    <p class="file-note">Cifratura AES-256 solo nel browser. Sblocco con password fornita, senza forzature; formati non supportati (incluso AES-128) vengono rifiutati. La cifratura non elimina informazioni riservate dal PDF.</p>
  </>;
}
