import { useEffect, useMemo, useState } from "preact/hooks";
import {
  createResilientClock,
  parseResilientClock,
  pauseResilientClock,
  resetResilientClock,
  serializeResilientClock,
  snapshotResilientClock,
  startResilientClock,
  type ResilientClockMode,
  type ResilientClockState,
} from "../../../engines/date-time/resilient-clock";

const STORAGE_KEY = "strumentini.resilient-clock.v1";

function durationFor(mode: ResilientClockMode, minutes: number): number | null {
  return mode === "stopwatch" ? null : Math.max(1, Math.min(43_200, Math.floor(minutes))) * 60_000;
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function ResilientClockSurface() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mode, setMode] = useState<ResilientClockMode>("timer");
  const [minutes, setMinutes] = useState(5);
  const [state, setState] = useState<ResilientClockState>(() => createResilientClock("timer", Date.now(), 5 * 60_000));
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = parseResilientClock(stored);
        setState(parsed);
        setMode(parsed.mode);
        if (parsed.durationMs !== null) setMinutes(Math.max(1, Math.floor(parsed.durationMs / 60_000)));
        setRestored(true);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serializeResilientClock(state));
  }, [state]);

  useEffect(() => {
    const sync = () => setNowMs(Date.now());
    const timer = window.setInterval(sync, 250);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const snapshot = useMemo(() => snapshotResilientClock(state, nowMs), [nowMs, state]);
  const displayMs = snapshot.remainingMs ?? snapshot.elapsedMs;

  function rebuild(nextMode: ResilientClockMode, nextMinutes = minutes) {
    const now = Date.now();
    setNowMs(now);
    setState(createResilientClock(nextMode, now, durationFor(nextMode, nextMode === "pomodoro" && nextMinutes === minutes ? 25 : nextMinutes)));
  }

  function changeMode(nextMode: ResilientClockMode) {
    const nextMinutes = nextMode === "pomodoro" ? 25 : minutes;
    setMode(nextMode);
    if (nextMode === "pomodoro") setMinutes(25);
    rebuild(nextMode, nextMinutes);
  }

  function changeMinutes(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    setMinutes(next);
    const now = Date.now();
    setNowMs(now);
    setState(createResilientClock(mode, now, durationFor(mode, next)));
  }

  return (
    <section class="tool-card" data-resilient-clock data-clock-mode={mode}>
      <h2>Timer, cronometro e Pomodoro resilienti</h2>
      <p class="file-note">Il tempo trascorso deriva sempre dai timestamp. I timer in background possono essere rallentati dal browser, ma al ritorno la durata viene ricalcolata dal tempo reale e lo stato viene ripristinato dal browser locale.</p>
      <div class="field-grid">
        <label class="field"><span>Modalità</span><select value={mode} onChange={(event) => changeMode(event.currentTarget.value as ResilientClockMode)}><option value="timer">Timer</option><option value="stopwatch">Cronometro</option><option value="pomodoro">Pomodoro</option></select></label>
        {mode !== "stopwatch" && <label class="field"><span>Durata (minuti)</span><input type="number" min="1" max="43200" value={minutes} onInput={(event) => changeMinutes(event.currentTarget.value)} /></label>}
      </div>
      <p class="result-primary" data-clock-display>{formatDuration(displayMs)}</p>
      <p class="file-note" data-clock-status>Stato: {snapshot.status}{restored ? " · ripristinato" : ""} · riferimento {new Date(snapshot.referenceMs).toISOString()}</p>
      <div class="actions">
        <button type="button" onClick={() => { const now = Date.now(); setNowMs(now); setState(startResilientClock(state, now)); }}>{state.status === "paused" ? "Riprendi" : "Avvia"}</button>
        <button type="button" onClick={() => { const now = Date.now(); setNowMs(now); setState(pauseResilientClock(state, now)); }} disabled={state.status !== "running"}>Pausa</button>
        <button type="button" onClick={() => { const now = Date.now(); setNowMs(now); setState(resetResilientClock(state, now)); setRestored(false); }}>Reimposta</button>
      </div>
    </section>
  );
}
