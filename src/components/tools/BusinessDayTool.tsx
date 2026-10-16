import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { recordCompletedTool } from "../../workbench/completed-tool";
import { resolveResultActions } from "../../runtime/result-actions";
import { businessDayManifest } from "../../tools/business-day/manifest";
import type { DayCode } from "../../engines/date-time/business-days";
import type { BusinessDayOutput } from "../../tools/business-day/types";
import { PreviousValue } from "./shared/PreviousValue";
import {
  ResultActions,
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
  ToolResultPanel,
} from "./shared";
import { gutterStateFromResult } from "./shared/ToolGutter";

const PROFILE_WORKWEEK: readonly DayCode[] = ["MON", "TUE", "WED", "THU", "FRI"];
const DAY_LABELS: ReadonlyArray<{ code: DayCode; label: string }> = [
  { code: "MON", label: "Lun" },
  { code: "TUE", label: "Mar" },
  { code: "WED", label: "Mer" },
  { code: "THU", label: "Gio" },
  { code: "FRI", label: "Ven" },
  { code: "SAT", label: "Sab" },
  { code: "SUN", label: "Dom" },
];

function parseExcludedDates(value: string): string[] {
  return value
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatResultDate(isoDate: string, locale: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(date);
}

export function BusinessDayTool() {
  const activeRun = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<"add" | "between">("add");
  const [startDate, setStartDate] = useState("");
  const [amount, setAmount] = useState("1");
  const [endDate, setEndDate] = useState("");
  const [inclusiveStart, setInclusiveStart] = useState(false);
  const [inclusiveEnd, setInclusiveEnd] = useState(true);
  const [excludedDates, setExcludedDates] = useState("");
  const [explicitWorkweek, setExplicitWorkweek] = useState<readonly DayCode[] | undefined>();
  const [result, setResult] = useState<BusinessDayOutput | null>(null);
  const [error, setError] = useState("");
  const [actionStatus, setActionStatus] = useState("");

  const locale = "it-IT";
  const workweek = explicitWorkweek ?? PROFILE_WORKWEEK;
  const workweekProvenance = explicitWorkweek === undefined ? "Valore predefinito dal profilo" : "Valore specifico per questa attività";

  const resultText = useMemo(() => {
    if (result === null) return "";
    if (result.mode === "between") {
      return `${result.businessDays} ${Math.abs(result.businessDays) === 1 ? "giorno lavorativo" : "giorni lavorativi"}`;
    }
    return formatResultDate(result.resultDate, locale);
  }, [result, locale]);

  function invalidate() {
    activeRun.current?.abort();
    activeRun.current = null;
    setResult(null);
    setError("");
    setActionStatus("");
  }

  useEffect(() => () => {
    activeRun.current?.abort();
    activeRun.current = null;
  }, []);

  function toggleWorkday(day: DayCode) {
    invalidate();
    const current = new Set(workweek);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    setExplicitWorkweek(DAY_LABELS.map(({ code }) => code).filter((code) => current.has(code)));
  }

  async function submit(event: Event) {
    event.preventDefault();
    // A double submit while the same asynchronous job is outstanding is not
    // a second completed operation. Input edits/Reset invalidate that job.
    if (activeRun.current !== null) return;
    const controller = new AbortController();
    activeRun.current = controller;
    setError("");
    setResult(null);

    const shared = {
      startDate,
      excludedDates: parseExcludedDates(excludedDates),
    };
    const input = mode === "add"
      ? { ...shared, mode, amount: Number(amount) }
      : { ...shared, mode, endDate, inclusiveStart, inclusiveEnd };

    try {
      const run = await toolRuntime.run(
        businessDayManifest.id,
        input,
        {
          explicit: explicitWorkweek === undefined ? {} : { workweek: explicitWorkweek },
          profile: { workweek: PROFILE_WORKWEEK, locale },
        },
        controller.signal,
      );

      if (activeRun.current !== controller || controller.signal.aborted) return;
      activeRun.current = null;

      if (!run.ok) {
        setError(
          run.code === "INVALID_INPUT"
            ? "Controlla le date, la settimana lavorativa e il numero di giorni lavorativi."
            : "Impossibile completare il calcolo. Controlla i valori inseriti.",
        );
        return;
      }
      setResult(run.value as BusinessDayOutput);
      recordCompletedTool(businessDayManifest.id);
    } catch {
      if (activeRun.current !== controller || controller.signal.aborted) return;
      activeRun.current = null;
      setError("Impossibile completare il calcolo. Controlla i valori inseriti.");
    }
  }

  function reset() {
    invalidate();
    setMode("add");
    setStartDate("");
    setAmount("1");
    setEndDate("");
    setInclusiveStart(false);
    setInclusiveEnd(true);
    setExcludedDates("");
    setExplicitWorkweek(undefined);
  }

  const gutterState = gutterStateFromResult(result, error);
  const declaration = businessDayManifest.result;
  const resultActions = result === null ? [] : resolveResultActions({
    declaration,
    primary: "copy",
    hasCopyPayload: resultText !== "",
    resetReady: true,
  });

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    await navigator.clipboard.writeText(resultText);
    setActionStatus("Risultato copiato.");
  }
  return (
    <div class="tool-operation">
      <form onSubmit={submit} noValidate>
        <fieldset class="segmented">
          <legend>Calcolo</legend>
          <label>
            <input
              type="radio"
              name="mode"
              value="add"
              checked={mode === "add"}
              onChange={() => { invalidate(); setMode("add"); }}
            />
            Aggiungi giorni lavorativi
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="between"
              checked={mode === "between"}
              onChange={() => { invalidate(); setMode("between"); }}
            />
            Conta tra due date
          </label>
        </fieldset>

        <div class="field-grid">
          <label class="field">
            <span>Data iniziale</span>
            <input
              required
              type="date"
              value={startDate}
              onInput={(event) => { invalidate(); setStartDate(event.currentTarget.value); }}
              aria-describedby="start-help"
            />
            <small id="start-help">{mode === "add" ? "La data iniziale non viene conteggiata." : "Scegli qui sotto se includere la data iniziale nel conteggio."}</small>
          </label>

          {mode === "add" ? (
            <label class="field">
              <span>Giorni lavorativi da aggiungere</span>
              <input
                required
                type="number"
                step="1"
                value={amount}
                onInput={(event) => { invalidate(); setAmount(event.currentTarget.value); }}
              />
            </label>
          ) : (
            <label class="field">
              <span>Data finale</span>
              <input
                required
                type="date"
                value={endDate}
                onInput={(event) => { invalidate(); setEndDate(event.currentTarget.value); }}
              />
            </label>
          )}
        </div>

        {mode === "between" && (
          <fieldset class="workweek-fieldset">
            <legend>Estremi del conteggio</legend>
            <label>
              <input type="checkbox" checked={inclusiveStart} onChange={(event) => { invalidate(); setInclusiveStart(event.currentTarget.checked); }} />
              Includi data iniziale
            </label>
            <label>
              <input type="checkbox" checked={inclusiveEnd} onChange={(event) => { invalidate(); setInclusiveEnd(event.currentTarget.checked); }} />
              Includi data finale
            </label>
            <small>Le date sono giorni di calendario ISO; nessuna conversione di fuso orario modifica il giorno scelto.</small>
          </fieldset>
        )}

        <fieldset class="workweek-fieldset">
          <legend>
            Settimana lavorativa <span class="provenance">{workweekProvenance}</span>
          </legend>
          <div class="weekday-row">
            {DAY_LABELS.map(({ code, label }) => (
              <label key={code}>
                <input
                  type="checkbox"
                  checked={workweek.includes(code)}
                  onChange={() => toggleWorkday(code)}
                />
                {label}
              </label>
            ))}
          </div>
          <button
            class="text-button"
            type="button"
            disabled={explicitWorkweek === undefined}
            onClick={() => { invalidate(); setExplicitWorkweek(undefined); }}
          >
            Usa il valore predefinito del profilo
          </button>
        </fieldset>

        <label class="field">
          <span>Date escluse <em>facoltative</em></span>
          <textarea
            rows={3}
            value={excludedDates}
            onInput={(event) => { invalidate(); setExcludedDates(event.currentTarget.value); }}
            placeholder="2026-12-25, 2026-12-31"
            aria-describedby="excluded-help"
          />
          <small id="excluded-help">Separa le date con virgole o nuove righe. Non viene interrogato alcun servizio esterno di festività.</small>
        </label>

        {error !== "" && (
          <p class="error" role="alert">
            {error}
          </p>
        )}

        <div class="actions">
          <button class="primary" type="submit">Calcola</button>
          <button type="button" onClick={reset}>Reimposta</button>
        </div>
      </form>

      <ToolResultPanel eyebrow="Risultato" placeholder="Il risultato apparirà qui." state={gutterState}>
        {result !== null && (
          <div data-result-class="calculator">
            <ResultExplanation
              primary={<div data-result-slot="primary"><ResultPrimaryAnswer label={result.mode === "add" ? "Data lavorativa" : "Giorni lavorativi"}><PreviousValue value={resultText} className="" /></ResultPrimaryAnswer></div>}
              interpretation={<div data-result-slot="interpretation"><ResultInterpretation state="success">{result.mode === "add" ? "Data ottenuta applicando la settimana lavorativa e le esclusioni indicate." : "Conteggio ottenuto con gli estremi selezionati e le esclusioni indicate."}</ResultInterpretation></div>}
              breakdown={<div data-result-slot="breakdown"><ResultBreakdown rows={result.mode === "add" ? [{ label: "Data ISO", value: result.resultDate }, { label: "Giorni aggiunti", value: String(result.amount) }] : [{ label: "Giorni lavorativi", value: String(result.businessDays) }]} /></div>}
              assumptions={<div data-result-slot="assumptions"><ResultAssumptions items={[
                { label: "Settimana lavorativa", value: result.assumptions.workweek.map((day) => DAY_LABELS.find(({ code }) => code === day)?.label ?? day).join(", ") },
                { label: "Date escluse", value: result.assumptions.excludedDates.length === 0 ? "Nessuna" : result.assumptions.excludedDates.join(", ") },
                { label: "Estremi", value: `Data iniziale ${result.assumptions.inclusiveStart ? "inclusa" : "esclusa"} · data finale ${result.assumptions.inclusiveEnd ? "inclusa" : "esclusa"}` },
              ]} /></div>}
              provenance={<div data-result-slot="provenance"><ResultProvenance>Calcolo locale; non viene interrogato alcun servizio esterno di festività.</ResultProvenance></div>}
            />
            <ResultActions actions={resultActions} onAction={{ copy: copyResult, reset }} />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </div>
  );
}
