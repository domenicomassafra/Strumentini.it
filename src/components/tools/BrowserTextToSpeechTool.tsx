import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { italianVoices, validateSpeechControls } from "../../engines/browser-audio";
import { recordCompletedTool } from "../../workbench/completed-tool";

export function BrowserTextToSpeechTool() {
  const [text, setText] = useState("Ciao! Questo testo viene consegnato al motore vocale del browser o del sistema operativo.");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [status, setStatus] = useState("Pronto.");
  const [supported, setSupported] = useState(false);
  const speechRevision = useRef(0);
  const italian = useMemo(() => italianVoices(voices), [voices]);

  useEffect(() => {
    const runtimeSupported = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
    setSupported(runtimeSupported);
    if (!runtimeSupported) return;
    const load = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      const preferred = italianVoices(available)[0] ?? available[0];
      setVoiceUri((current) => current !== "" && available.some((voice) => voice.voiceURI === current) ? current : preferred?.voiceURI ?? "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      speechRevision.current += 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);

  function stop() {
    if (!supported) return;
    speechRevision.current += 1;
    window.speechSynthesis.cancel();
    setStatus("Lettura fermata.");
  }

  function speak() {
    if (!supported) {
      setStatus("SpeechSynthesis non è disponibile in questo browser.");
      return;
    }
    if (text.trim() === "" || text.length > 20_000) {
      setStatus("Inserisci da 1 a 20.000 caratteri.");
      return;
    }
    try {
      const controls = validateSpeechControls({ rate, pitch });
      const revision = ++speechRevision.current;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = controls.rate;
      utterance.pitch = controls.pitch;
      const chosen = voices.find((voice) => voice.voiceURI === voiceUri);
      if (chosen !== undefined) utterance.voice = chosen;
      let started = false;
      let settled = false;
      utterance.onstart = () => {
        if (revision !== speechRevision.current || settled || started) return;
        started = true;
        recordCompletedTool("browser-text-to-speech");
        setStatus(`Lettura avviata${chosen === undefined ? " con la voce predefinita" : ` con ${chosen.name} (${chosen.lang})`}.`);
      };
      utterance.onend = () => {
        if (revision !== speechRevision.current || settled) return;
        settled = true;
        setStatus(started ? "Lettura conclusa." : "Lettura terminata senza avvio.");
      };
      utterance.onerror = () => {
        if (revision !== speechRevision.current || settled) return;
        settled = true;
        setStatus("Il motore vocale del browser/sistema non ha completato la lettura.");
      };
      setStatus("Lettura richiesta al motore vocale del browser/sistema.");
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      speechRevision.current += 1;
      setStatus(error instanceof Error ? `Controllo non valido: ${error.message}` : "Controlli vocali non validi.");
    }
  }

  return <div class="tool-surface" data-browser-tts>
    {!supported && <p class="error" role="alert">Questo browser non espone SpeechSynthesis.</p>}
    <label class="field"><span>Testo · max 20.000 caratteri</span><textarea rows={8} value={text} onInput={(event) => setText(event.currentTarget.value)} /></label>
    <div class="field-grid">
      <label class="field"><span>Voce disponibile</span><select value={voiceUri} onChange={(event) => { stop(); setVoiceUri(event.currentTarget.value); }} disabled={!supported || voices.length === 0}>
        {italian.length > 0 ? italian.map((voice) => <option value={voice.voiceURI} key={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? " · locale" : ""}</option>) : voices.length > 0 ? voices.map((voice) => <option value={voice.voiceURI} key={voice.voiceURI}>{voice.name} · {voice.lang}</option>) : <option value="">Nessuna voce disponibile</option>}
      </select></label>
      <label class="field"><span>Velocità · 0,5–2</span><input type="number" min="0.5" max="2" step="0.1" value={rate} onInput={(event) => setRate(event.currentTarget.valueAsNumber)} /></label>
      <label class="field"><span>Tono · 0,5–2</span><input type="number" min="0.5" max="2" step="0.1" value={pitch} onInput={(event) => setPitch(event.currentTarget.valueAsNumber)} /></label>
    </div>
    {supported && italian.length === 0 && <p class="file-note">Nessuna voce italiana è stata esposta dal browser; mostro le voci realmente disponibili invece di prometterne una inesistente.</p>}
    <p class="file-note">Strumentini non invia questo testo a un proprio server. Il testo viene passato all'API SpeechSynthesis del browser/sistema operativo: la disponibilità della voce e l'eventuale implementazione locale o remota del motore dipendono dalla piattaforma, non da Strumentini.</p>
    <div class="actions"><button type="button" onClick={speak} disabled={!supported}>Leggi</button><button type="button" onClick={stop} disabled={!supported}>Ferma</button></div>
    <p role="status" aria-live="polite">{status}</p>
  </div>;
}
