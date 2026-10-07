import { useState } from "preact/hooks";
import { profileValuesForTool } from "../../profile/work-profile";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { timezoneOverlapManifest } from "../../tools/timezone-overlap/manifest";
import type { TimezoneOverlapOutput } from "../../tools/timezone-overlap/types";
import { useWorkProfile } from "./client-time-math/work-profile";
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
import { RangeMark } from "./shared/StatusMark";

const DEFAULT_HOURS = { start: "09:00", end: "17:00" } as const;

function errorText(message: string): string {
  if (message === "INVALID_TIMEZONE") return "Usa nomi di fuso orario IANA validi, per esempio Europe/Rome o America/New_York.";
  if (message === "INVALID_LOCAL_TIME_GAP") return "Un limite dell'orario di lavoro cade in un salto dell'ora legale. Scegli un'ora locale esistente.";
  if (message === "INVALID_LOCAL_TIME_OVERLAP") return "Un limite dell'orario di lavoro è ambiguo durante il ritorno all'ora solare. Scegli un orario non ambiguo.";
  if (message === "INVALID_WORKING_HOURS") return "L'orario di lavoro deve iniziare prima di terminare nello stesso giorno locale.";
  return "Controlla data, fusi orari e orari di lavoro.";
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
  const [actionStatus, setActionStatus] = useState("");
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
    setActionStatus("");
  }

  const gutterState = error !== "" ? "error" : result === null ? "idle" : result.segments.length === 0 ? "warning" : "success";
  const declaration = timezoneOverlapManifest.result;
  const primaryText = result === null
    ? ""
    : result.segments.length === 0
      ? "Nessuna sovrapposizione"
      : `${result.segments.length} ${result.segments.length === 1 ? "finestra condivisa" : "finestre condivise"}`;
  const copyPayload = result === null
    ? ""
    : result.segments.length === 0
      ? primaryText
      : [primaryText, ...result.segments.map((segment) => `${result.homeTimeZone}: ${segment.home} · ${result.otherTimeZone}: ${segment.other}`)].join("\n");
  const resultActions = result === null ? [] : resolveResultActions({
    declaration,
    primary: "copy",
    hasCopyPayload: copyPayload !== "",
    resetReady: true,
  });

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    await navigator.clipboard.writeText(copyPayload);
    setActionStatus("Risultato copiato.");
  }

  return (
    <div class="tool-operation">
      <form onSubmit={submit} noValidate>
        <label class="field">
          <span>Data nel tuo fuso orario</span>
          <input required type="date" value={date} onInput={(event) => setDate(event.currentTarget.value)} />
        </label>
        <div class="field-grid">
          <label class="field">
            <span>Il tuo fuso orario</span>
            <input
              required
              value={homeTimeZone}
              onInput={(event) => setHomeTimeZoneOverride(event.currentTarget.value)}
              aria-describedby="home-zone-help"
            />
            <small id="home-zone-help">{ready && homeTimeZoneOverride === undefined ? "Valore predefinito dal profilo" : "Valore specifico per questa attività"}</small>
            <button class="text-button" type="button" disabled={homeTimeZoneOverride === undefined} onClick={() => setHomeTimeZoneOverride(undefined)}>
              Usa il fuso del profilo
            </button>
          </label>
          <label class="field">
            <span>Altro fuso orario</span>
            <input required value={otherTimeZone} onInput={(event) => setOtherTimeZone(event.currentTarget.value)} />
            <small>Nome IANA, per esempio America/New_York.</small>
          </label>
        </div>
        <div class="field-grid">
          <fieldset>
            <legend>I tuoi orari di lavoro <span class="provenance">{homeHoursOverridden ? "Valore specifico per questa attività" : "Valore predefinito dello strumento"}</span></legend>
            <div class="field-grid">
              <label class="field"><span>Inizio</span><input type="time" required value={homeStart} onInput={(event) => setHomeStartOverride(event.currentTarget.value)} /></label>
              <label class="field"><span>Fine</span><input type="time" required value={homeEnd} onInput={(event) => setHomeEndOverride(event.currentTarget.value)} /></label>
            </div>
            <button class="text-button" type="button" disabled={!homeHoursOverridden} onClick={() => { setHomeStartOverride(undefined); setHomeEndOverride(undefined); }}>Usa l'orario predefinito 09:00–17:00</button>
          </fieldset>
          <fieldset>
            <legend>Orari di lavoro dell'altro fuso</legend>
            <div class="field-grid">
              <label class="field"><span>Inizio</span><input type="time" required value={otherStart} onInput={(event) => setOtherStart(event.currentTarget.value)} /></label>
              <label class="field"><span>Fine</span><input type="time" required value={otherEnd} onInput={(event) => setOtherEnd(event.currentTarget.value)} /></label>
            </div>
          </fieldset>
        </div>
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions">
          <button class="primary" type="submit">Trova la sovrapposizione</button>
          <button type="button" onClick={reset}>Reimposta</button>
        </div>
      </form>
      <ToolResultPanel eyebrow="Orario di lavoro condiviso" placeholder="La sovrapposizione compare qui." state={gutterState}>
        {result !== null && (
          <div data-result-class="calculator">
            <ResultExplanation
              primary={<div data-result-slot="primary"><ResultPrimaryAnswer label="Sovrapposizione">{primaryText}</ResultPrimaryAnswer></div>}
              interpretation={<div data-result-slot="interpretation"><ResultInterpretation state={result.segments.length === 0 ? "warning" : "success"}>{result.segments.length === 0 ? "Gli intervalli di lavoro indicati non si sovrappongono in questa data." : "Sono mostrate solo le finestre condivise valide nei due fusi."}</ResultInterpretation></div>}
              breakdown={<div data-result-slot="breakdown"><ResultBreakdown rows={result.segments.map((segment) => ({
                label: <RangeMark start={segment.startInstant} end={segment.endInstant} />,
                value: <>{result.homeTimeZone}: {segment.home}<br />{result.otherTimeZone}: {segment.other}</>,
              }))} /></div>}
              assumptions={<div data-result-slot="assumptions"><ResultAssumptions items={[
                { label: "Origine del fuso", value: result.provenance.homeTimeZone === "profile" ? "Valore predefinito dal profilo" : "Sovrascrittura per questa attività" },
                { label: "Confini DST", value: "Gli orari nei salti e nelle ambiguità DST vengono rifiutati esplicitamente." },
                { label: "Base della data", value: "Data locale del fuso principale; orari di lavoro nello stesso giorno locale." },
              ]} /></div>}
              provenance={<div data-result-slot="provenance"><ResultProvenance>Calcolo locale con fusi IANA e regole DST del runtime del browser.</ResultProvenance></div>}
            />
            <ResultActions actions={resultActions} onAction={{ copy: copyResult, reset }} />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </div>
  );
}
