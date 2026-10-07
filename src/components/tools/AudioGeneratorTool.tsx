import { useEffect, useRef, useState } from "preact/hooks";
import { bpmFromTapTimes, generateNoiseSamples, validateAudioGeneratorSettings, type NoiseKind } from "../../engines/browser-audio";

type Mode = "tone" | "metronome" | "noise";

export function AudioGeneratorTool() {
  const [mode, setMode] = useState<Mode>("tone");
  const [frequency, setFrequency] = useState(440);
  const [bpm, setBpm] = useState(120);
  const [noiseKind, setNoiseKind] = useState<NoiseKind>("white");
  const [level, setLevel] = useState(0.05);
  const [duration, setDuration] = useState(0);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Pronto. L'audio parte solo dopo aver premuto Avvia.");
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioScheduledSourceNode | null>(null);
  const metronomeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const tapsRef = useRef<number[]>([]);

  function clearTimers() {
    if (metronomeRef.current !== null) window.clearInterval(metronomeRef.current);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    metronomeRef.current = null;
    timerRef.current = null;
    deadlineRef.current = null;
  }

  function stopAudio(message = "Audio fermato.") {
    clearTimers();
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context !== null) void context.close().catch(() => undefined);
    setRunning(false);
    setStatus(message);
  }

  useEffect(() => {
    const onVisibility = () => {
      if (deadlineRef.current !== null && Date.now() >= deadlineRef.current) stopAudio("Durata conclusa durante la sospensione della scheda.");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
      try { sourceRef.current?.stop(); } catch {}
      if (contextRef.current !== null) void contextRef.current.close().catch(() => undefined);
    };
  }, []);

  function click(context: AudioContext, volume: number) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.035);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.04);
  }

  function startAudio() {
    stopAudio("Riavvio audio…");
    if (typeof AudioContext === "undefined") {
      setStatus("Web Audio non è disponibile in questo browser.");
      return;
    }
    try {
      const settings = validateAudioGeneratorSettings({ mode, frequencyHz: frequency, bpm, noiseKind, level, durationSeconds: duration });
      const context = new AudioContext();
      contextRef.current = context;
      if (settings.mode === "tone") {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = settings.frequencyHz!;
        gain.gain.value = settings.level;
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        sourceRef.current = oscillator;
      } else if (settings.mode === "noise") {
        const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * 2)), context.sampleRate);
        buffer.copyToChannel(new Float32Array(generateNoiseSamples(settings.noiseKind!, buffer.length)), 0);
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = settings.level;
        source.connect(gain).connect(context.destination);
        source.start();
        sourceRef.current = source;
      } else {
        const beatMs = 60_000 / settings.bpm!;
        click(context, settings.level);
        metronomeRef.current = window.setInterval(() => click(context, settings.level), beatMs);
      }
      if (settings.durationSeconds > 0) {
        deadlineRef.current = Date.now() + settings.durationSeconds * 1000;
        timerRef.current = window.setTimeout(() => stopAudio("Durata conclusa."), settings.durationSeconds * 1000);
      }
      setRunning(true);
      setStatus(`${settings.mode === "metronome" ? `Metronomo ${settings.bpm} BPM` : settings.mode === "tone" ? `Tono ${settings.frequencyHz} Hz` : `Rumore ${settings.noiseKind}`} attivo.`);
    } catch (error) {
      setStatus(error instanceof Error ? `Impostazione non valida: ${error.message}` : "Impostazione audio non valida.");
    }
  }

  function tapTempo() {
    const now = performance.now();
    const last = tapsRef.current.at(-1);
    if (last !== undefined && now - last > 2000) tapsRef.current = [];
    tapsRef.current = [...tapsRef.current, now].slice(-6);
    const measured = bpmFromTapTimes(tapsRef.current);
    if (measured !== null) {
      setBpm(measured);
      setStatus(`Tap tempo: ${measured} BPM.`);
    } else setStatus("Tocca ancora per misurare il tempo.");
  }

  return <div class="tool-surface" data-audio-generator>
    <div class="field-grid">
      <label class="field"><span>Modalità</span><select value={mode} onChange={(event) => { stopAudio(); setMode(event.currentTarget.value as Mode); }}><option value="tone">Tono</option><option value="metronome">Metronomo</option><option value="noise">Rumore</option></select></label>
      {mode === "tone" && <label class="field"><span>Frequenza · 20–20.000 Hz</span><input type="number" min="20" max="20000" value={frequency} onInput={(event) => setFrequency(event.currentTarget.valueAsNumber)} /></label>}
      {mode === "metronome" && <label class="field"><span>Tempo · 30–300 BPM</span><input type="number" min="30" max="300" value={bpm} onInput={(event) => setBpm(event.currentTarget.valueAsNumber)} /></label>}
      {mode === "noise" && <label class="field"><span>Tipo rumore</span><select value={noiseKind} onChange={(event) => setNoiseKind(event.currentTarget.value as NoiseKind)}><option value="white">Bianco</option><option value="pink">Rosa</option><option value="brown">Brown</option></select></label>}
      <label class="field"><span>Livello · 0–0,2</span><input type="number" min="0" max="0.2" step="0.01" value={level} onInput={(event) => setLevel(event.currentTarget.valueAsNumber)} /></label>
      <label class="field"><span>Timer secondi · 0 = continuo</span><input type="number" min="0" max="3600" step="1" value={duration} onInput={(event) => setDuration(event.currentTarget.valueAsNumber)} /></label>
    </div>
    <p class="file-note">Web Audio richiede un gesto utente per partire. Il metronomo usa il clock audio ma l'avvio dei click futuri dipende anche dallo scheduling del browser; una scheda sospesa può ritardare eventi. Al ritorno il timer viene confrontato con un timestamp assoluto.</p>
    <div class="actions">
      <button type="button" onClick={startAudio}>{running ? "Riavvia" : "Avvia"}</button>
      <button type="button" onClick={() => stopAudio()} disabled={!running}>Ferma</button>
      {mode === "metronome" && <button type="button" onClick={tapTempo}>Tap tempo</button>}
    </div>
    <p role="status" aria-live="polite">{status}</p>
  </div>;
}
