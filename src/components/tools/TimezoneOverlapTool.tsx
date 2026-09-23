import { useState } from "preact/hooks";
import { profileValuesForTool } from "../../profile/work-profile";
import { toolRuntime } from "../../runtime/tool-runtime";
import { timezoneOverlapManifest } from "../../tools/timezone-overlap/manifest";
import type { TimezoneOverlapOutput } from "../../tools/timezone-overlap/types";
import { useWorkProfile } from "./client-time-math/work-profile";

const DEFAULT_HOURS = { start: "09:00", end: "17:00" } as const;

function errorText(message: string): string {
  if (message === "INVALID_TIMEZONE") return "Use valid IANA timezone names, for example Europe/Rome or America/New_York.";
  if (message === "INVALID_LOCAL_TIME_GAP") return "A working-hours boundary falls in a DST gap. Choose an existing local time.";
  if (message === "INVALID_LOCAL_TIME_OVERLAP") return "A working-hours boundary is ambiguous during the DST fallback. Choose an unambiguous boundary.";
  if (message === "INVALID_WORKING_HOURS") return "Working hours must have a start before the end on the same local day.";
  return "Check the date, timezones, and working hours.";
}

export function TimezoneOverlapTool() {
  const { profile, ready } = useWorkProfile();
  const [date, setDate] = useState("");
  const [otherTimeZone, setOtherTimeZone] = useState("America/New_York");
  const [homeTimeZoneOverride, setHomeTimeZoneOverride] = useState<string | undefined>();
  const [homeStartOverride, setHomeStartOverride] = useState<string | undefined>();
  const [homeEndOverride, setHomeEndOverride] = useState<string | undefined>();
  const [otherStart, setOtherStart] = useState<string>(DEFAULT_HOURS.start);
  const [otherEnd, setOtherEnd] = useState<string>(DEFAULT_HOURS.end);
  const [result, setResult] = useState<TimezoneOverlapOutput | null>(null);
  const [error, setError] = useState("");
  const homeTimeZone = homeTimeZoneOverride ?? profile.timezone;
  const homeStart = homeStartOverride ?? DEFAULT_HOURS.start;
  const homeEnd = homeEndOverride ?? DEFAULT_HOURS.end;
  const homeHoursOverridden = homeStartOverride !== undefined || homeEndOverride !== undefined;

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    setResult(null);
    const run = await toolRuntime.run(
      timezoneOverlapManifest.id,
      { date, otherTimeZone, otherWorkingHours: { start: otherStart, end: otherEnd } },
      {
        explicit: {
          ...(homeTimeZoneOverride === undefined ? {} : { timezone: homeTimeZoneOverride }),
          ...(homeHoursOverridden ? { workingHours: { start: homeStart, end: homeEnd } } : {}),
        },
        profile: profileValuesForTool(timezoneOverlapManifest, profile),
      },
    );
    if (!run.ok) {
      setError(errorText(run.message));
      return;
    }
    setResult(run.value as TimezoneOverlapOutput);
  }

  function reset() {
    setDate("");
    setOtherTimeZone("America/New_York");
    setHomeTimeZoneOverride(undefined);
    setHomeStartOverride(undefined);
    setHomeEndOverride(undefined);
    setOtherStart(DEFAULT_HOURS.start);
    setOtherEnd(DEFAULT_HOURS.end);
    setResult(null);
    setError("");
  }

  return (
    <div class="tool-operation">
      <form onSubmit={submit} noValidate>
        <label class="field">
          <span>Date in your home timezone</span>
          <input required type="date" value={date} onInput={(event) => setDate(event.currentTarget.value)} />
        </label>
        <div class="field-grid">
          <label class="field">
            <span>Home timezone</span>
            <input
              required
              value={homeTimeZone}
              onInput={(event) => setHomeTimeZoneOverride(event.currentTarget.value)}
              aria-describedby="home-zone-help"
            />
            <small id="home-zone-help">{ready && homeTimeZoneOverride === undefined ? "Work Profile default" : "Current task override"}</small>
            <button class="text-button" type="button" disabled={homeTimeZoneOverride === undefined} onClick={() => setHomeTimeZoneOverride(undefined)}>
              Use Work Profile timezone
            </button>
          </label>
          <label class="field">
            <span>Other timezone</span>
            <input required value={otherTimeZone} onInput={(event) => setOtherTimeZone(event.currentTarget.value)} />
            <small>IANA name, such as America/New_York.</small>
          </label>
        </div>
        <div class="field-grid">
          <fieldset>
            <legend>Your working hours <span class="provenance">{homeHoursOverridden ? "Current task override" : "Tool default"}</span></legend>
            <div class="field-grid">
              <label class="field"><span>Your start</span><input type="time" required value={homeStart} onInput={(event) => setHomeStartOverride(event.currentTarget.value)} /></label>
              <label class="field"><span>Your end</span><input type="time" required value={homeEnd} onInput={(event) => setHomeEndOverride(event.currentTarget.value)} /></label>
            </div>
            <button class="text-button" type="button" disabled={!homeHoursOverridden} onClick={() => { setHomeStartOverride(undefined); setHomeEndOverride(undefined); }}>Use 09:00–17:00 tool default</button>
          </fieldset>
          <fieldset>
            <legend>Other working hours</legend>
            <div class="field-grid">
              <label class="field"><span>Other start</span><input type="time" required value={otherStart} onInput={(event) => setOtherStart(event.currentTarget.value)} /></label>
              <label class="field"><span>Other end</span><input type="time" required value={otherEnd} onInput={(event) => setOtherEnd(event.currentTarget.value)} /></label>
            </div>
          </fieldset>
        </div>
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions">
          <button class="primary" type="submit">Find overlap</button>
          <button type="button" onClick={reset}>Reset</button>
        </div>
      </form>
      <section class="result-panel" aria-live="polite" aria-atomic="true">
        <p class="eyebrow">Shared working time</p>
        {result === null ? <p class="result-placeholder">Your overlap appears here.</p> : result.segments.length === 0 ? (
          <strong class="result-value">No overlap</strong>
        ) : (
          <>
            <strong class="result-value">{result.segments.length} shared window{result.segments.length === 1 ? "" : "s"}</strong>
            <dl class="assumptions">
              {result.segments.map((segment) => (
                <div key={segment.startInstant}><dt>{segment.startInstant} → {segment.endInstant}</dt><dd>{result.homeTimeZone}: {segment.home}<br />{result.otherTimeZone}: {segment.other}</dd></div>
              ))}
              <div><dt>Timezone source</dt><dd>{result.provenance.homeTimeZone === "profile" ? "Work Profile default" : "Current task override"}</dd></div>
              <div><dt>DST boundary policy</dt><dd>Gap and ambiguous boundary times are rejected explicitly.</dd></div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
