import { useEffect, useMemo, useState } from "preact/hooks";
import { convertTimeZone, deadlineCountdown } from "../../../engines/date-time";

type LiveMode = "world-clock" | "deadline";

function isoNow(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

export function LiveTimeSurface({ mode }: { mode: LiveMode }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [targetZone, setTargetZone] = useState("Europe/Rome");
  const [deadline, setDeadline] = useState("2026-12-31T23:59:59Z");

  useEffect(() => {
    const sync = () => setNowMs(Date.now());
    const timer = window.setInterval(sync, 1000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const model = useMemo(() => {
    const reference = isoNow(nowMs);
    try {
      if (mode === "world-clock") {
        return { ok: true as const, reference, value: convertTimeZone(reference, "UTC", targetZone) };
      }
      return { ok: true as const, reference, value: deadlineCountdown(deadline, reference) };
    } catch (error) {
      return { ok: false as const, reference, error: error instanceof Error ? error.message : String(error) };
    }
  }, [deadline, mode, nowMs, targetZone]);

  return (
    <section class="tool-card" data-live-time-surface={mode} aria-live="polite">
      <h2>{mode === "world-clock" ? "Orologio mondiale live" : "Scadenza live"}</h2>
      <p class="file-note">
        Il valore viene ricalcolato da un timestamp reale. Se la scheda viene sospesa, al ritorno il tempo viene
        riletto da <code>Date.now()</code>: non vengono accumulati tick in background.
      </p>
      {mode === "world-clock" ? (
        <label class="field">
          <span>Fuso IANA di destinazione</span>
          <input value={targetZone} onInput={(event) => setTargetZone(event.currentTarget.value)} autoComplete="off" />
        </label>
      ) : (
        <label class="field">
          <span>Scadenza ISO</span>
          <input value={deadline} onInput={(event) => setDeadline(event.currentTarget.value)} autoComplete="off" />
        </label>
      )}
      <dl class="assumptions">
        <div><dt>Istante sorgente UTC</dt><dd data-live-source-time>{model.reference}</dd></div>
        {model.ok && mode === "world-clock" ? (
          <>
            <div><dt>Fuso sorgente</dt><dd>UTC</dd></div>
            <div><dt>Fuso destinazione</dt><dd>{targetZone}</dd></div>
            <div><dt>Ora locale</dt><dd data-live-target-time>{String((model.value as { target?: string }).target ?? "")}</dd></div>
            <div><dt>Offset</dt><dd>{String((model.value as { offsetMinutes?: number }).offsetMinutes ?? 0)} minuti</dd></div>
          </>
        ) : model.ok ? (
          <>
            <div><dt>Scadenza</dt><dd>{String((model.value as { deadline?: string }).deadline ?? deadline)}</dd></div>
            <div><dt>Stato</dt><dd>{String((model.value as { status?: string }).status ?? "")}</dd></div>
            <div><dt>Tempo</dt><dd data-live-deadline-value>{`${String((model.value as { days?: number }).days ?? 0)}g ${String((model.value as { hours?: number }).hours ?? 0)}h ${String((model.value as { minutes?: number }).minutes ?? 0)}m ${String((model.value as { seconds?: number }).seconds ?? 0)}s`}</dd></div>
          </>
        ) : (
          <div><dt>Errore</dt><dd>{model.error}</dd></div>
        )}
      </dl>
    </section>
  );
}
