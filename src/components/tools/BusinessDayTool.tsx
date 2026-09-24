import { useMemo, useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { DayCode } from "../../engines/date-time/business-days";
import type { BusinessDayOutput } from "../../tools/business-day/types";

const PROFILE_WORKWEEK: readonly DayCode[] = ["MON", "TUE", "WED", "THU", "FRI"];
const DAY_LABELS: ReadonlyArray<{ code: DayCode; label: string }> = [
  { code: "MON", label: "Mon" },
  { code: "TUE", label: "Tue" },
  { code: "WED", label: "Wed" },
  { code: "THU", label: "Thu" },
  { code: "FRI", label: "Fri" },
  { code: "SAT", label: "Sat" },
  { code: "SUN", label: "Sun" },
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

  const locale = typeof navigator === "undefined" ? "en-US" : navigator.language;
  const workweek = explicitWorkweek ?? PROFILE_WORKWEEK;
  const workweekProvenance = explicitWorkweek === undefined ? "Work Profile default" : "Current task override";

  const resultText = useMemo(() => {
    if (result === null) return "";
    if (result.mode === "between") {
      return `${result.businessDays} business day${Math.abs(result.businessDays) === 1 ? "" : "s"}`;
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
          ? "Check the dates, workweek, and number of business days."
          : run.message,
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

  return (
    <div class="tool-operation">
      <form onSubmit={submit} noValidate>
        <fieldset class="segmented">
          <legend>Calculation</legend>
          <label>
            <input
              type="radio"
              name="mode"
              value="add"
              checked={mode === "add"}
              onChange={() => setMode("add")}
            />
            Add business days
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="between"
              checked={mode === "between"}
              onChange={() => setMode("between")}
            />
            Count between dates
          </label>
        </fieldset>

        <div class="field-grid">
          <label class="field">
            <span>Start date</span>
            <input
              required
              type="date"
              value={startDate}
              onInput={(event) => setStartDate(event.currentTarget.value)}
              aria-describedby="start-help"
            />
            <small id="start-help">The start date itself is not counted.</small>
          </label>

          {mode === "add" ? (
            <label class="field">
              <span>Business days to add</span>
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
              <span>End date</span>
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
            Workweek <span class="provenance">{workweekProvenance}</span>
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
            Use Work Profile default
          </button>
        </fieldset>

        <label class="field">
          <span>Excluded dates <em>optional</em></span>
          <textarea
            rows={3}
            value={excludedDates}
            onInput={(event) => setExcludedDates(event.currentTarget.value)}
            placeholder="2026-12-25, 2026-12-31"
            aria-describedby="excluded-help"
          />
          <small id="excluded-help">Comma or line separated. No holiday service is queried.</small>
        </label>

        {error !== "" && (
          <p class="error" role="alert">
            {error}
          </p>
        )}

        <div class="actions">
          <button class="primary" type="submit">Calculate</button>
          <button type="button" onClick={reset}>Reset</button>
        </div>
      </form>

      <section class="result-panel" aria-label="Result" aria-live="polite" aria-atomic="false">
        <p class="eyebrow">Result</p>
        {result === null ? (
          <p class="result-placeholder">Your result appears here.</p>
        ) : (
          <>
            <strong class="result-value">{resultText}</strong>
            {result.mode === "add" && <code>{result.resultDate}</code>}
            <dl class="assumptions">
              <div><dt>Workweek</dt><dd>{result.assumptions.workweek.join(", ")}</dd></div>
              <div><dt>Excluded dates</dt><dd>{result.assumptions.excludedDates.length || "None"}</dd></div>
              <div><dt>Boundary</dt><dd>Start excluded · end included</dd></div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
