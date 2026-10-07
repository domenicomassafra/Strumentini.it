import { useState } from "preact/hooks";
import { MAX_BASE64_FILE_BYTES } from "../../engines/developer-web/encoding-crypto";
import { toolRuntime } from "../../runtime/tool-runtime";
import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

type Alphabet = "standard" | "url-safe";
type RawMode = "encode-file" | "decode-bytes" | "encode-image" | "decode-image";
type ImageEnvelope = "plain" | "data-url";

const BASE64_PREVIEW_CHARS = 12_000;

function downloadBytes(bytes: readonly number[], filename: string, mime = "application/octet-stream"): void {
  const blob = new Blob([Uint8Array.from(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Base64CodecTool() {
  const [mode, setMode] = useState<RawMode>("encode-file");
  const [alphabet, setAlphabet] = useState<Alphabet>("standard");
  const [file, setFile] = useState<File | null>(null);
  const [encodedInput, setEncodedInput] = useState("");
  const [imageEnvelope, setImageEnvelope] = useState<ImageEnvelope>("plain");
  const [resultText, setResultText] = useState("");
  const [decodedBytes, setDecodedBytes] = useState<readonly number[]>([]);
  const [decodedImage, setDecodedImage] = useState<{ mime: string; extension: string } | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function runRawMode(event: Event) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    setResultText("");
    setDecodedBytes([]);
    setDecodedImage(null);
    try {
      if (mode === "encode-file" || mode === "encode-image") {
        if (file === null) throw new Error("Seleziona un file locale.");
        if (file.size > MAX_BASE64_FILE_BYTES) throw new Error(`Il file supera il limite locale di ${MAX_BASE64_FILE_BYTES} byte.`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const result = await toolRuntime.run("base64-codec", mode === "encode-image"
          ? { bytes: Array.from(bytes), mode: "encode-image", envelope: imageEnvelope }
          : { bytes: Array.from(bytes), mode: "encode-bytes", urlSafe: alphabet }) as { value?: string; byteLength?: number; mime?: string };
        setResultText(String(result.value ?? ""));
        setStatus(mode === "encode-image"
          ? `${String(result.byteLength ?? bytes.byteLength)} byte immagine verificati e codificati localmente${result.mime === undefined ? "" : ` (${result.mime})`}.`
          : `${String(result.byteLength ?? bytes.byteLength)} byte codificati localmente.`);
      } else {
        const result = await toolRuntime.run("base64-codec", {
          text: encodedInput,
          mode: mode === "decode-image" ? "decode-image" : "decode-bytes",
          ...(mode === "decode-image" ? { envelope: imageEnvelope } : { urlSafe: alphabet }),
        }) as { bytes?: number[]; byteLength?: number; mime?: string; extension?: string };
        const bytes = Array.isArray(result.bytes) ? result.bytes : [];
        setDecodedBytes(bytes);
        if (mode === "decode-image") setDecodedImage({ mime: String(result.mime ?? "application/octet-stream"), extension: String(result.extension ?? "bin") });
        setStatus(mode === "decode-image"
          ? `${String(result.byteLength ?? bytes.length)} byte decodificati; firma immagine verificata${result.mime === undefined ? "" : ` (${result.mime})`}.`
          : `${String(result.byteLength ?? bytes.length)} byte decodificati localmente.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Operazione Base64 non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  function resetRawMode() {
    setFile(null);
    setEncodedInput("");
    setResultText("");
    setDecodedBytes([]);
    setDecodedImage(null);
    setStatus("");
  }

  return (
    <>
      <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["base64-codec"]} />
      <section class="tool-card" data-base64-file-mode>
        <h2>File e byte grezzi</h2>
        <p class="file-note">
          Questa modalità è separata dal testo UTF-8: i byte del file restano nel browser e non vengono interpretati come caratteri.
          Base64url usa <code>-</code>/<code>_</code> e viene generato senza padding; in decodifica il padding canonico è facoltativo.
        </p>
        <form onSubmit={runRawMode} noValidate>
          <div class="field-grid">
            <label class="field">
              <span>Operazione</span>
              <select value={mode} onChange={(event) => { setMode(event.currentTarget.value as RawMode); resetRawMode(); }}>
                <option value="encode-file">File → Base64</option>
                <option value="decode-bytes">Base64 → byte/file</option>
                <option value="encode-image">Immagine → Base64 / data URL</option>
                <option value="decode-image">Base64 / data URL → immagine verificata</option>
              </select>
            </label>
            {(mode === "encode-file" || mode === "decode-bytes") && <label class="field">
              <span>Alfabeto</span>
              <select value={alphabet} onChange={(event) => setAlphabet(event.currentTarget.value as Alphabet)}>
                <option value="standard">Base64 standard</option>
                <option value="url-safe">Base64url</option>
              </select>
            </label>}
            {(mode === "encode-image" || mode === "decode-image") && <label class="field">
              <span>Contenitore immagine</span>
              <select value={imageEnvelope} onChange={(event) => setImageEnvelope(event.currentTarget.value as ImageEnvelope)}>
                <option value="plain">Base64 puro</option>
                <option value="data-url">data URL con MIME dichiarato</option>
              </select>
            </label>}
            {(mode === "encode-file" || mode === "encode-image") ? (
              <label class="field">
                <span>{mode === "encode-image" ? "Immagine JPEG/PNG/WebP" : "File locale"} · max {MAX_BASE64_FILE_BYTES} byte</span>
                <input type="file" accept={mode === "encode-image" ? "image/jpeg,image/png,image/webp" : undefined} onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} />
              </label>
            ) : (
              <label class="field">
                <span>Base64 da decodificare</span>
                <textarea rows={5} value={encodedInput} onInput={(event) => setEncodedInput(event.currentTarget.value)} />
              </label>
            )}
          </div>
          <div class="actions">
            <button type="submit" disabled={busy}>{busy ? "Elaborazione…" : mode === "encode-file" ? "Codifica file" : mode === "encode-image" ? "Codifica immagine" : mode === "decode-image" ? "Decodifica immagine" : "Decodifica byte"}</button>
            <button type="button" onClick={resetRawMode} disabled={busy}>Reimposta</button>
          </div>
        </form>
        {resultText !== "" && (
          <div class="result-panel" data-base64-file-result>
            <label class="field"><span>Anteprima Base64{resultText.length > BASE64_PREVIEW_CHARS ? ` · primi ${BASE64_PREVIEW_CHARS} caratteri` : ""}</span><textarea readOnly rows={6} value={resultText.slice(0, BASE64_PREVIEW_CHARS)} /></label>
            {resultText.length > BASE64_PREVIEW_CHARS && <small>Anteprima limitata; il download conserva l'output completo.</small>}
            <div class="actions"><button type="button" onClick={() => {
              const blob = new Blob([resultText], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = mode === "encode-image" && imageEnvelope === "data-url" ? "image-data-url.txt" : "base64.txt";
              anchor.click();
              URL.revokeObjectURL(url);
            }}>Scarica output completo</button></div>
          </div>
        )}
        {decodedBytes.length > 0 && (
          <div class="actions" data-base64-byte-result>
            <button type="button" onClick={() => downloadBytes(decodedBytes, decodedImage === null ? "base64-decoded.bin" : `base64-image.${decodedImage.extension}`, decodedImage?.mime)}>{decodedImage === null ? "Scarica byte decodificati" : `Scarica immagine verificata (${decodedImage.mime})`}</button>
          </div>
        )}
        {status !== "" && <p role="status" aria-live="polite">{status}</p>}
      </section>
    </>
  );
}
