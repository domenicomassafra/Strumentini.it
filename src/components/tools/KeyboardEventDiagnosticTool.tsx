import type { TargetedKeyboardEvent } from "preact";
import { useRef, useState } from "preact/hooks";
import {
  appendKeyboardHistory,
  normalizeKeyboardDiagnosticEvent,
  type KeyboardDiagnosticEvent,
} from "../../tools/keyboard-event-diagnostic/module";
import { ToolActions, ToolGutter, ToolSurface } from "./shared";

function eventFromKeyboard(event: TargetedKeyboardEvent<HTMLDivElement>): KeyboardDiagnosticEvent {
  return normalizeKeyboardDiagnosticEvent({
    type: event.type === "keyup" ? "keyup" : "keydown",
    key: event.key,
    code: event.code,
    location: event.location,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    repeat: event.repeat,
    isComposing: event.isComposing,
  });
}

export function KeyboardEventDiagnosticTool() {
  const [active, setActive] = useState(false);
  const [history, setHistory] = useState<readonly KeyboardDiagnosticEvent[]>([]);
  const testSurface = useRef<HTMLDivElement>(null);
  const latest = history[0] ?? null;

  function start() {
    setActive(true);
    requestAnimationFrame(() => testSurface.current?.focus());
  }

  function stop() {
    setActive(false);
    testSurface.current?.blur();
  }

  function capture(event: TargetedKeyboardEvent<HTMLDivElement>) {
    if (!active) return;
    // Deliberately do not call preventDefault/stopPropagation: browser and
    // operating-system shortcuts must keep their normal behavior.
    const normalized = eventFromKeyboard(event);
    setHistory((current) => appendKeyboardHistory(current, normalized));
  }

  function reset() {
    setHistory([]);
  }

  return (
    <ToolSurface
      gutter={
        <ToolGutter
          label="Ultimo evento"
          state={latest === null ? "idle" : "info"}
          {...(latest === null ? {} : { value: latest.key })}
          placeholder="Avvia il test e porta il focus nell'area di prova."
          entries={latest === null ? [] : [
            { label: "code", value: latest.code || "—" },
            { label: "tipo", value: latest.type },
            { label: "posizione", value: `${latest.location} · ${latest.locationLabel}` },
            { label: "modificatori", value: latest.modifiers.length === 0 ? "nessuno" : latest.modifiers.join(" + ") },
            { label: "repeat", value: latest.repeat ? "true" : "false" },
            { label: "composizione", value: latest.isComposing ? "true" : "false" },
          ]}
        />
      }
    >
      <p>
        Gli eventi vengono mostrati solo mentre l'area di prova ha il focus ed è attiva. La cronologia resta in memoria,
        contiene al massimo 12 eventi e scompare ricaricando la pagina. Non viene salvato il testo digitato in storage o inviato in rete.
      </p>
      <div
        ref={testSurface}
        class="keyboard-test-surface"
        data-active={active ? "true" : "false"}
        tabIndex={0}
        role="region"
        aria-label="Area di prova eventi tastiera"
        aria-describedby="keyboard-event-help"
        onFocus={() => active && setActive(true)}
        onBlur={() => setActive(false)}
        onKeyDown={capture}
        onKeyUp={capture}
      >
        <strong>{active ? "Test attivo" : "Test fermo"}</strong>
        <span id="keyboard-event-help">
          {active
            ? " Premi i tasti da ispezionare. Tab continua a spostare il focus normalmente e le scorciatoie non vengono bloccate."
            : " Premi “Avvia test” per spostare qui il focus."}
        </span>
      </div>
      <ToolActions>
        <button type="button" onClick={start}>{active ? "Riporta focus al test" : "Avvia test"}</button>
        <button type="button" onClick={stop} disabled={!active}>Ferma test</button>
        <button type="button" onClick={reset} disabled={history.length === 0}>Cancella cronologia</button>
      </ToolActions>

      <div class="keyboard-history" aria-live="polite">
        <h3>Cronologia recente ({history.length}/12)</h3>
        {history.length === 0 ? (
          <p>Nessun evento registrato.</p>
        ) : (
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col">key</th>
                  <th scope="col">code</th>
                  <th scope="col">Posizione</th>
                  <th scope="col">Modificatori</th>
                  <th scope="col">Repeat</th>
                  <th scope="col">Composizione</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={`${index}-${item.type}-${item.code}-${item.key}`}>
                    <td>{item.type}</td>
                    <td><code>{item.key || "—"}</code></td>
                    <td><code>{item.code || "—"}</code></td>
                    <td>{item.locationLabel}</td>
                    <td>{item.modifiers.length === 0 ? "—" : item.modifiers.join(" + ")}</td>
                    <td>{item.repeat ? "sì" : "no"}</td>
                    <td>{item.isComposing ? "sì" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ToolSurface>
  );
}
