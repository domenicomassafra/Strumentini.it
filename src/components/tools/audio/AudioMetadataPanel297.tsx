import { useEffect, useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import { inspectAudioMetadata297, AUDIO_METADATA_MAX_BYTES, type AudioMetadata297 } from "../../../engines/browser-audio/metadata-297";
import { ToolActions, ToolCancelButton, ToolFormCard, ToolResetButton, ToolSubmitButton } from "../shared";

function showError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("SIZE_LIMIT")) return "File troppo grande o vuoto: massimo 24 MiB.";
  if (message.includes("HEADER_LIMIT")) return "Metadati ID3 troppo grandi o troncati (massimo 256 KiB).";
  if (message.includes("TIMEOUT")) return "Analisi interrotta dopo 5 secondi.";
  if (message.includes("UNSUPPORTED")) return "Formato non riconosciuto: servono firme MP3, FLAC, Ogg o WAV leggibili.";
  return "Tag o file audio non validi, incompleti o non supportati.";
}

function number(value: number | null, unit: string): string {
  return value === null ? "Non disponibile" : `${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })} ${unit}`;
}

export function AudioMetadataPanel297() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AudioMetadata297 | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error" | "cancelled">("idle");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const running = useRef<AbortController | null>(null);
  const generation = useRef(0);

  useEffect(() => () => { generation.current++; running.current?.abort(); }, []);

  function changeFile(next: File | null) {
    generation.current++;
    running.current?.abort();
    running.current = null;
    setFile(next);
    setResult(null);
    setStatus("idle");
    setMessage("");
  }

  async function inspect(event: Event) {
    event.preventDefault();
    if (!file || running.current) return;
    const turn = ++generation.current;
    const controller = new AbortController();
    running.current = controller;
    setStatus("running");
    setResult(null);
    setMessage("");
    try {
      const metadata = await inspectAudioMetadata297(file, controller.signal);
      if (turn !== generation.current || controller.signal.aborted) return;
      setResult(metadata);
      setStatus("success");
      recordCompletedTool("video-inspector");
    } catch (error) {
      if (turn !== generation.current || controller.signal.aborted) return;
      setStatus("error");
      setMessage(showError(error));
    } finally {
      if (running.current === controller) running.current = null;
    }
  }

  function cancel() {
    generation.current++;
    running.current?.abort();
    running.current = null;
    setStatus("cancelled");
    setMessage("Analisi annullata.");
  }

  return <section data-audio-metadata-297 aria-label="Inspector tag audio locale">
    <ToolFormCard>
      <form onSubmit={inspect} aria-label="Analizza tag audio">
        <h2 class="video-tool-section-title">Tag e proprietà audio · MP3, FLAC, Ogg, WAV</h2>
        <p class="video-tool-muted">Analisi locale in sola lettura. Il file resta nel browser; la firma reale viene verificata anche se l'estensione è errata. Nessuna copertina viene letta o mostrata.</p>
        <label class="field">
          <span>Seleziona un audio (max {AUDIO_METADATA_MAX_BYTES / 1024 / 1024} MiB)</span>
          <input ref={input} type="file" accept=".mp3,.flac,.ogg,.oga,.wav,audio/mpeg,audio/flac,audio/ogg,audio/wav" onChange={(event) => changeFile(event.currentTarget.files?.[0] ?? null)} disabled={status === "running"} />
        </label>
        {file && <p class="video-tool-muted">Selezionato: {file.name} ({file.size.toLocaleString("it-IT")} byte)</p>}
        <ToolActions>
          <ToolSubmitButton busy={status === "running"} busyLabel="Lettura tag…" disabled={!file || file.size > AUDIO_METADATA_MAX_BYTES}>Leggi tag audio</ToolSubmitButton>
          {status === "running" && <ToolCancelButton onCancel={cancel} />}
          <ToolResetButton disabled={status === "running"} onClick={() => { changeFile(null); if (input.current) input.current.value = ""; }} />
        </ToolActions>
        {message && <p class="video-tool-alert" role="alert">{message}</p>}
      </form>
      {result && <section data-audio-metadata-result aria-label="Risultati tag audio">
        <h3 class="video-tool-minor-title">Metadati rilevati · {result.container}</h3>
        <dl class="video-tool-facts">
          <div><dt>Codec</dt><dd>{result.codec}</dd></div>
          <div><dt>Durata</dt><dd>{number(result.durationSeconds, "s")}</dd></div>
          <div><dt>Canali</dt><dd>{number(result.channels, "")}</dd></div>
          <div><dt>Campionamento</dt><dd>{number(result.sampleRateHz, "Hz")}</dd></div>
          <div><dt>Bitrate</dt><dd>{number(result.bitrateBps, "bit/s")}</dd></div>
          <div><dt>Tag trovati</dt><dd>{result.tagTypes.join(", ") || "Nessuno"}</dd></div>
          {Object.entries(result.tags).map(([key, value]) => <div key={key}><dt>{({ title: "Titolo", artist: "Artista", album: "Album", genre: "Genere", year: "Anno", track: "Traccia" } as Record<string, string>)[key]}</dt><dd>{value ?? "Non disponibile"}</dd></div>)}
        </dl>
        <p class="video-tool-muted">Testi limitati a 160 caratteri e filtrati; copertine, commenti e tag non elencati sono esclusi. La durata può essere assente se il file non la dichiara.</p>
      </section>}
      {status === "running" && <p role="status">Analisi in corso, timeout massimo 5 secondi…</p>}
    </ToolFormCard>
  </section>;
}
