import { useEffect, useRef, useState } from "preact/hooks";
import {
  decodeWavForWhisper298, preflightWhisper298, WHISPER_298_MAX_SECONDS,
  WHISPER_298_MODEL, WHISPER_298_REVISION,
} from "../../../engines/browser-audio/whisper-298";

type Phase = "idle" | "loading" | "working" | "pause-requested" | "paused" | "done" | "failed" | "cancelled";
type Reply = { kind: "loading"; phase: string; percent: number | null } | { kind: "ready"; loadingMs: number }
  | { kind: "processing"; processedSeconds: number } | { kind: "result"; text: string; elapsedMs: number }
  | { kind: "error"; code: string } | { kind: "pause-requested" } | { kind: "paused" };

function friendly(code: string): string {
  if (code === "AUDIO_SIZE_LIMIT") return "Il file WAV deve contenere da 44 byte a 12 MiB.";
  if (code === "AUDIO_DURATION_LIMIT") return `Durata accettata: da 0,2 a ${WHISPER_298_MAX_SECONDS} secondi.`;
  if (code === "AUDIO_SILENCE") return "L'audio non contiene parlato sufficientemente udibile.";
  if (code === "MEMORY_LIMIT") return "Il dispositivo dichiara meno di 4 GiB di memoria: modello disabilitato.";
  if (code === "AUDIO_CORRUPT" || code === "AUDIO_UNSUPPORTED_FORMAT") return "Serve un WAV RIFF PCM 16 bit mono/stereo tra 8 e 48 kHz, integro.";
  if (code === "ASR_EMPTY_RESULT") return "Il modello non ha riconosciuto parole. Nessuna trascrizione è stata inventata.";
  return `Trascrizione non disponibile (${code.replace(/[^a-zA-Z0-9:_ -]/gu, "").slice(0, 80) || "MODEL_RUNTIME_ERROR"}). Controlla rete, memoria e compatibilità WASM.`;
}

export function AudioWhisperPanel298() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("Il modello non viene caricato finché non scegli di avviare.");
  const [text, setText] = useState("");
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const worker = useRef<Worker | null>(null);
  const run = useRef(0);

  function terminate() { worker.current?.terminate(); worker.current = null; }

  useEffect(() => {
    const onLeave = () => { run.current++; terminate(); };
    const onVisibility = () => {
      if (document.hidden && worker.current) {
        worker.current.postMessage({ kind: "pause" });
        setPhase("pause-requested");
        setStatus("Scheda in background: pausa richiesta alla fine del segmento corrente.");
      }
    };
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      onLeave();
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function cancel() {
    run.current++;
    terminate();
    setPhase("cancelled");
    setStatus("Operazione annullata. Il Worker e la sua memoria sono stati rilasciati.");
  }

  function select(next: File | null) {
    run.current++;
    terminate();
    setFile(next);
    setPhase("idle");
    setStatus("Premi Avvia per autorizzare il download del modello.");
    setText("");
    setLoadMs(null);
    setElapsedMs(null);
  }

  async function start() {
    if (!file || worker.current) return;
    const id = ++run.current;
    setText("");
    setPhase("loading");
    setStatus("Controllo il WAV in memoria locale…");
    try {
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      preflightWhisper298(file.size, memory);
      const samples = decodeWavForWhisper298(await file.arrayBuffer());
      if (run.current !== id) return;
      const instance = new Worker(new URL("../../../engines/browser-audio/whisper-worker-298.ts", import.meta.url), { type: "module" });
      worker.current = instance;
      instance.onerror = () => {
        if (id !== run.current) return;
        terminate();
        setPhase("failed");
        setStatus(friendly("MODEL_WORKER_ERROR"));
      };
      instance.onmessage = (event: MessageEvent<Reply>) => {
        if (id !== run.current) return;
        const message = event.data;
        if (message.kind === "loading") {
          setStatus(`Download modello/WASM: ${message.phase}${message.percent === null ? "" : ` ${Math.round(message.percent)}%`}. Puoi annullare.`);
        } else if (message.kind === "ready") {
          setLoadMs(message.loadingMs);
          setPhase("working");
          setStatus("Modello caricato. Elaborazione locale in corso…");
        } else if (message.kind === "processing") {
          setPhase((previous) => previous === "pause-requested" ? previous : "working");
          setStatus(`Elaborazione locale: dal secondo ${message.processedSeconds} (blocchi da 15 s).`);
        } else if (message.kind === "pause-requested") {
          setPhase("pause-requested");
          setStatus("Pausa richiesta: la lavorazione in corso termina prima della sospensione.");
        } else if (message.kind === "paused") {
          setPhase("paused");
          setStatus("Elaborazione in pausa. Premi Riprendi per continuare.");
        } else if (message.kind === "result") {
          terminate();
          setText(message.text);
          setElapsedMs(message.elapsedMs);
          setPhase("done");
          setStatus("Trascrizione ottenuta. Ricontrolla sempre il testo: può contenere errori.");
        } else if (message.kind === "error") {
          terminate();
          setPhase("failed");
          setStatus(friendly(message.code));
        }
      };
      instance.postMessage({ kind: "start", pcm: samples.buffer }, [samples.buffer]);
      setStatus("Caricamento modelli ONNX e runtime WASM dalle origini dichiarate…");
    } catch (error) {
      if (run.current !== id) return;
      terminate();
      setPhase("failed");
      setStatus(friendly(error instanceof Error ? error.message : "AUDIO_DECODE_ERROR"));
    }
  }

  function download() {
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text + "\n"], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "trascrizione-audio-italiano.txt";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const active = worker.current !== null && phase !== "done" && phase !== "failed";
  return <section class="tool-surface" data-whisper-298 aria-label="Laboratorio trascrizione audio locale">
    <h2>Trascrizione audio italiana · demo sperimentale</h2>
    <p>Whisper tiny multilingua funziona nel browser tramite WebAssembly. Il file audio resta sul dispositivo; al primo avvio vengono scaricati modello e runtime da Hugging Face e jsDelivr, memorizzabili nella cache del browser (circa 45–65 MiB e memoria aggiuntiva). Nessun audio viene inviato ai fornitori. I risultati possono contenere errori.</p>
    <p>WAV PCM16 mono/stereo, 8–48 kHz, fino a 12 MiB e 30 secondi. Se il browser dichiara meno di 4 GiB di RAM, il processo viene rifiutato. Solo output TXT: i timestamp dei singoli enunciati non sono ancora verificati, quindi non viene offerto un SRT.</p>
    <label class="field"><span>File audio WAV</span>
      <input type="file" accept=".wav,audio/wav" disabled={active} onChange={(event) => select(event.currentTarget.files?.[0] ?? null)} />
    </label>
    {file && <p>File: {file.name} ({file.size.toLocaleString("it-IT")} byte)</p>}
    <div class="tool-actions">
      <button type="button" onClick={() => void start()} disabled={!file || active}>Avvia trascrizione (scarica il modello)</button>
      {active && <button type="button" onClick={() => {
        if (phase === "paused" || phase === "pause-requested") { worker.current?.postMessage({ kind: "resume" }); setPhase("working"); setStatus("Ripresa richiesta."); }
        else { worker.current?.postMessage({ kind: "pause" }); setPhase("pause-requested"); }
      }}>{phase === "paused" || phase === "pause-requested" ? "Riprendi" : "Pausa"}</button>}
      {active && <button type="button" onClick={cancel}>Annulla e libera memoria</button>}
    </div>
    <p role="status" aria-live="polite">{status}</p>
    {text && <section aria-label="Risultato trascrizione"><h3>Testo riconosciuto</h3>
      <textarea class="field" rows={7} readOnly value={text} aria-label="Testo trascritto" />
      <button type="button" onClick={download}>Scarica TXT</button>
      {loadMs !== null && elapsedMs !== null && <p>Caricamento: {(loadMs / 1000).toFixed(1)} s; totale: {(elapsedMs / 1000).toFixed(1)} s. Tempi rilevati in questo browser.</p>}
    </section>}
    <p><small>Modello <code>{WHISPER_298_MODEL}</code> · revisione <code>{WHISPER_298_REVISION.slice(0, 12)}</code> · quantizzazione q8 · solo CPU WASM. WebGPU e prestazioni mobile non certificati.</small></p>
  </section>;
}
