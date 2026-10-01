import { useMemo, useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { DayCode } from "../../engines/date-time/business-days";
import type { BusinessDayOutput } from "../../tools/business-day/types";
import { PreviousValue } from "./shared/PreviousValue";
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
  const [mode, setMode] = useState<"add" | "between">("add");
  const [startDate, setStartDate] = useState("");
  const [amount, setAmount] = useState("1");
  const [endDate, setEndDate] = useState("");
  const [excludedDates, setExcludedDates] = useState("");
  const [explicitWorkweek, setExplicitWorkweek] = useState<readonly DayCode[] | undefined>();
  const [result, setResult] = useState<BusinessDayOutput | null>(null);
  const [error, setError] = useState("");

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

  function toggleWorkday(day: DayCode) {
    const current = new Set(workweek);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    setExplicitWorkweek(DAY_LABELS.map(({ code }) => code).filter((code) => current.has(code)));
    setResult(null);
  }

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    setResult(null);

    const shared = {
      startDate,
      excludedDates: parseExcludedDates(excludedDates),
    };
    const input = mode === "add"
      ? { ...shared, mode, amount: Number(amount) }
      : { ...shared, mode, endDate };

    const run = await toolRuntime.run(
      "business-day",
      input,
      {
        explicit: explicitWorkweek === undefined ? {} : { workweek: explicitWorkweek },
        profile: { workweek: PROFILE_WORKWEEK, locale },
      },
    );

    if (!run.ok) {
      setError(
        run.code === "INVALID_INPUT"
          ? "Controlla le date, la settimana lavorativa e il numero di giorni lavorativi."
          : "Impossibile completare il calcolo. Controlla i valori inseriti.",
      );
      return;
    }
    setResult(run.value as BusinessDayOutput);
  }

  function reset() {
    setMode("add");
    setStartDate("");
    setAmount("1");
    setEndDate("");
    setExcludedDates("");
    setExplicitWorkweek(undefined);
    setResult(null);
    setError("");
  }

  const gutterState = gutterStateFromResult(result, error);
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
              onChange={() => setMode("add")}
            />
            Aggiungi giorni lavorativi
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="between"
              checked={mode === "between"}
              onChange={() => setMode("between")}
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
              onInput={(event) => setStartDate(event.currentTarget.value)}
              aria-describedby="start-help"
            />
            <small id="start-help">La data iniziale non viene conteggiata.</small>
          </label>

          {mode === "add" ? (
            <label class="field">
              <span>Giorni lavorativi da aggiungere</span>
              <input
                required
                type="number"
                step="1"
                value={amount}
                onInput={(event) => setAmount(event.currentTarget.value)}
              />
            </label>
          ) : (
            <label class="field">
              <span>Data finale</span>
              <input
                required
                type="date"
                value={endDate}
                onInput={(event) => setEndDate(event.currentTarget.value)}
              />
            </label>
          )}
        </div>

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
            onClick={() => setExplicitWorkweek(undefined)}
          >
            Usa il valore predefinito del profilo
          </button>
        </fieldset>

        <label class="field">
          <span>Date escluse <em>facoltative</em></span>
          <textarea
            rows={3}
            value={excludedDates}
            onInput={(event) => setExcludedDates(event.currentTarget.value)}
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

      <section class="result-panel gutter" data-state={gutterState} aria-live="polite" aria-atomic="true">
        <p class="gutter-label eyebrow">Risultato</p>
        {result === null ? (
          <p class="result-placeholder">Il risultato apparirà qui.</p>
        ) : (
          <>
            <PreviousValue value={resultText} />
            {result.mode === "add" && <code>{result.resultDate}</code>}
            <dl class="assumptions">
              <div><dt>Settimana lavorativa</dt><dd>{result.assumptions.workweek.map((day) => DAY_LABELS.find(({ code }) => code === day)?.label ?? day).join(", ")}</dd></div>
              <div><dt>Date escluse</dt><dd>{result.assumptions.excludedDates.length || "Nessuna"}</dd></div>
              <div><dt>Estremi</dt><dd>Data iniziale esclusa · data finale inclusa</dd></div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
