import { useEffect, useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../workbench/completed-tool";
import { estimatePasswordStrengthWithDonor, PASSWORD_STRENGTH_MAX_LENGTH, type PasswordStrengthResult } from "../../tools/password-strength-estimator/module";
import { InlineError, ResultBreakdown, ResultInterpretation, ResultProvenance, ToolActions, ToolGutter, ToolSurface } from "./shared";

export function PasswordStrengthEstimatorTool() {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<PasswordStrengthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeRun = useRef<AbortController | null>(null);
  useEffect(() => () => activeRun.current?.abort(), []);

  async function inspect() {
    activeRun.current?.abort();
    const controller = new AbortController();
    activeRun.current = controller;
    try {
      setError(null);
      const estimated = await estimatePasswordStrengthWithDonor(password, controller.signal);
      if (controller.signal.aborted) return;
      setResult(estimated);
      recordCompletedTool("password-strength-estimator");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setResult(null);
      setError(cause instanceof Error && cause.message === "PASSWORD_TOO_LONG"
        ? `Limite locale: ${PASSWORD_STRENGTH_MAX_LENGTH} caratteri Unicode.`
        : "Non riesco ad analizzare questo valore.");
    } finally {
      if (activeRun.current === controller) activeRun.current = null;
    }
  }

  function reset() {
    activeRun.current?.abort();
    setPassword("");
    setResult(null);
    setError(null);
    setRevealed(false);
  }

  return (
    <ToolSurface
      gutter={
        <ToolGutter
          label="Stima locale"
          state={result === null ? "idle" : result.score >= 3 ? "success" : result.score >= 2 ? "warning" : "error"}
          {...(result === null ? {} : { value: `${result.score}/4 · ${result.label}` })}
          placeholder="Inserisci una password per vedere i fattori osservati."
          entries={result === null ? [] : [
            { label: "Lunghezza", value: String(result.length) },
            { label: "Classi", value: String(result.characterClasses) },
            { label: "Rete", value: "nessuna" },
          ]}
        />
      }
    >
      <p>La stima usa lunghezza, pattern e dizionari locali nel browser. Il valore non viene salvato, inviato o confrontato con database di violazioni.</p>
      <form onSubmit={(event) => { event.preventDefault(); inspect(); }} autoComplete="off" noValidate>
        <label class="field">
          <span>Password da stimare</span>
          <input
            aria-label="Password da stimare"
            type={revealed ? "text" : "password"}
            value={password}
            maxLength={PASSWORD_STRENGTH_MAX_LENGTH * 2 + 1}
            autoComplete="new-password"
            spellcheck={false}
            onInput={(event) => { activeRun.current?.abort(); setPassword(event.currentTarget.value); setResult(null); }}
          />
        </label>
        <label class="choice-line"><input type="checkbox" checked={revealed} onChange={(event) => setRevealed(event.currentTarget.checked)} /> mostra temporaneamente il valore</label>
        <InlineError message={error} />
        <ToolActions>
          <button class="button primary" type="submit">Stima e spiega</button>
          <button type="button" onClick={reset}>Cancella</button>
        </ToolActions>
      </form>
      {result !== null && (
        <section aria-live="polite">
          <ResultInterpretation state={result.score >= 3 ? "success" : result.score >= 2 ? "info" : "warning"}>
            Punteggio {result.score}/4: {result.label}. Il punteggio è un riepilogo del modello locale; i fattori sotto spiegano come è stato ottenuto.
          </ResultInterpretation>
          <ResultBreakdown
            label="Fattori osservati"
            rows={result.factors.map((factor) => ({ label: factor.kind === "positive" ? "Favorisce" : factor.kind === "warning" ? "Penalizza" : "Limite", value: factor.detail }))}
          />
          <ResultProvenance>{result.limitations.join(" ")}</ResultProvenance>
        </section>
      )}
    </ToolSurface>
  );
}
