import { useEffect, useMemo, useState } from "preact/hooks";
import {
  PUBLIC_IP_ENDPOINT,
  formatSupportSummary,
  normalizeBrowserDeviceInfo,
  parsePublicIpResponse,
  type BrowserDeviceInfo,
} from "../../tools/connection-device-info/module";
import {
  ResultBreakdown,
  ResultProvenance,
  ToolActions,
  ToolGutter,
  ToolSurface,
} from "./shared";

type IpState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly ip: string }
  | { readonly status: "error"; readonly message: string };

function currentBrowserInfo(): BrowserDeviceInfo {
  const orientation = window.screen.orientation;
  const visual = window.visualViewport;
  return normalizeBrowserDeviceInfo({
    userAgent: navigator.userAgent,
    locale: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: Math.round(visual?.width ?? window.innerWidth),
    viewportHeight: Math.round(visual?.height ?? window.innerHeight),
    devicePixelRatio: window.devicePixelRatio || 1,
    orientationType: orientation?.type ?? (window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape"),
    orientationAngle: orientation?.angle ?? null,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    touchEventAvailable: "ontouchstart" in window,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  });
}

export function ConnectionDeviceInfoTool() {
  const [info, setInfo] = useState<BrowserDeviceInfo | null>(null);
  const [ipState, setIpState] = useState<IpState>({ status: "idle" });
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const refresh = () => setInfo(currentBrowserInfo());
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
    };
  }, []);

  const supportSummary = useMemo(() => info === null ? "" : formatSupportSummary(info), [info]);
  const browserLabel = info === null
    ? "—"
    : info.browserVersion === null ? info.browser : `${info.browser} ${info.browserVersion}`;

  async function copySupportSummary() {
    if (supportSummary === "" || navigator.clipboard === undefined) {
      setCopyStatus("Gli appunti non sono disponibili. Seleziona i dati e copiali manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(supportSummary);
      setCopyStatus("Riepilogo locale copiato. L'IP pubblico non è incluso.");
    } catch {
      setCopyStatus("Il browser ha bloccato gli appunti. Seleziona i dati e copiali manualmente.");
    }
  }

  async function lookupPublicIp() {
    setIpState({ status: "loading" });
    try {
      const response = await fetch(PUBLIC_IP_ENDPOINT, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const ip = parsePublicIpResponse(await response.json());
      setIpState({ status: "success", ip });
    } catch {
      setIpState({
        status: "error",
        message: "Non riesco a recuperare l'IP pubblico. La rete o il servizio esterno potrebbero non essere disponibili.",
      });
    }
  }

  return (
    <ToolSurface
      gutter={
        <ToolGutter
          label="Informazioni locali"
          state={info === null ? "idle" : "info"}
          value={browserLabel}
          placeholder="Lettura delle informazioni esposte dal browser…"
          entries={info === null ? [] : [
            { label: "Sistema", value: info.os },
            { label: "Viewport", value: `${info.viewportWidth}×${info.viewportHeight}` },
            { label: "DPR", value: String(info.devicePixelRatio) },
            { label: "Touch", value: info.touchCapable ? `Sì · ${info.maxTouchPoints} punti` : "Non rilevato" },
            { label: "Breakpoint", value: info.breakpoint },
          ]}
        >
          <ResultProvenance>
            Questi valori provengono dalle API del browser nella sessione corrente. Non sono una prova di identità e non vengono inviati a un server.
          </ResultProvenance>
        </ToolGutter>
      }
    >
      {info !== null && (
        <>
          <ResultBreakdown
            label="Browser e dispositivo"
            rows={[
              { label: "Browser", value: browserLabel },
              { label: "Sistema operativo", value: `${info.os} · indicazione ricavata dallo User-Agent` },
              { label: "User-Agent", value: info.userAgent },
              { label: "Lingua", value: info.locale },
              { label: "Schermo CSS", value: `${info.screenWidth}×${info.screenHeight}` },
              { label: "Viewport CSS", value: `${info.viewportWidth}×${info.viewportHeight}` },
              { label: "Device Pixel Ratio", value: String(info.devicePixelRatio) },
              { label: "Orientamento", value: info.orientationAngle === null ? info.orientationType : `${info.orientationType} (${info.orientationAngle}°)` },
              { label: "Touch", value: info.touchCapable ? `Disponibile · maxTouchPoints ${info.maxTouchPoints}` : "Non rilevato" },
              { label: "Pointer grossolano", value: info.coarsePointer ? "Sì" : "No" },
              { label: "Breakpoint Strumentini", value: info.breakpoint },
            ]}
          />
          <ToolActions>
            <button type="button" onClick={() => void copySupportSummary()}>Copia riepilogo di supporto</button>
            <button type="button" onClick={() => setInfo(currentBrowserInfo())}>Aggiorna dati locali</button>
          </ToolActions>
          {copyStatus !== "" && <p role="status" aria-live="polite">{copyStatus}</p>}
        </>
      )}

      <section class="network-action-card" aria-labelledby="public-ip-heading">
        <h3 id="public-ip-heading">IP pubblico · azione di rete facoltativa</h3>
        <p>
          Nessuna ricerca IP parte automaticamente. Premendo il pulsante, il browser contatta <code>api64.ipify.org</code>:
          quel servizio vedrà il tuo indirizzo IP e i normali dati tecnici della richiesta HTTP.
        </p>
        <button type="button" onClick={() => void lookupPublicIp()} disabled={ipState.status === "loading"}>
          {ipState.status === "loading" ? "Ricerca in corso…" : "Trova IP pubblico (rete)"}
        </button>
        <div class="network-action-result" aria-live="polite">
          {ipState.status === "success" && <p><strong>IP pubblico:</strong> <code>{ipState.ip}</code></p>}
          {ipState.status === "error" && <p class="error" role="alert">{ipState.message}</p>}
        </div>
      </section>
    </ToolSurface>
  );
}
