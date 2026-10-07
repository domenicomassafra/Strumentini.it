import { useState } from "preact/hooks";
import { inspectX509OrCsr, X509_MAX_BYTES, type X509Inspection } from "../../tools/x509-csr-inspector/module";
import { InlineError, ResultBreakdown, ResultProvenance, ToolActions, ToolGutter, ToolSurface } from "./shared";

const ERROR_COPY: Readonly<Record<string, string>> = {
  ENCRYPTED_PEM_UNSUPPORTED: "Il PEM è cifrato: questo inspector non decifra chiavi o contenitori protetti.",
  PEM_UNSUPPORTED_OR_MALFORMED: "Il testo non contiene un CERTIFICATE o CERTIFICATE REQUEST PEM supportato.",
  PEM_BASE64_INVALID: "Il corpo Base64 del PEM è malformato.",
  UNSUPPORTED_DER_STRUCTURE: "Il DER non corrisponde alla struttura X.509 certificate o PKCS#10 CSR supportata.",
  X509_INPUT_TOO_LARGE: `Il file supera il limite locale di ${Math.round(X509_MAX_BYTES / 1024)} KiB.`,
};

function localizedError(cause: unknown): string {
  const code = cause instanceof Error ? cause.message : "";
  return ERROR_COPY[code] ?? (code.startsWith("ASN1_") || code.startsWith("X509_") ? `Input ASN.1 malformato o non supportato (${code}).` : "Non riesco a ispezionare questo certificato o CSR.");
}

export function X509CsrInspectorTool() {
  const [pem, setPem] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<X509Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function inspect() {
    if (file === null && pem.trim() === "") { setError("Incolla un PEM oppure scegli un file PEM/DER."); return; }
    if (file !== null && file.size > X509_MAX_BYTES) { setError(ERROR_COPY.X509_INPUT_TOO_LARGE ?? "File troppo grande."); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const input = file === null ? pem : new Uint8Array(await file.arrayBuffer());
      setResult(await inspectX509OrCsr(input));
    } catch (cause) { setError(localizedError(cause)); }
    finally { setBusy(false); }
  }

  function reset() { setPem(""); setFile(null); setResult(null); setError(null); }

  return (
    <ToolSurface
      gutter={
        <ToolGutter
          label="Oggetto ispezionato"
          state={result === null ? "idle" : "info"}
          {...(result === null ? {} : { value: result.kind === "certificate" ? "Certificato X.509" : "CSR PKCS#10" })}
          placeholder="Apri un certificato o CSR locale."
          entries={result === null ? [] : [
            { label: "Subject", value: result.subject },
            { label: "Chiave", value: `${result.publicKey.algorithm}${result.publicKey.bits === null ? "" : ` · ${result.publicKey.bits} bit`}` },
            { label: "SAN", value: String(result.san.length) },
          ]}
        >
          {result !== null && <ResultProvenance>{result.trustNotice}</ResultProvenance>}
        </ToolGutter>
      }
    >
      <p>Il parser legge soltanto fatti ASN.1 bounded. Non esegue contenuto delle estensioni e non effettua richieste di rete.</p>
      <form onSubmit={(event) => { event.preventDefault(); void inspect(); }} noValidate>
        <label class="field">
          <span>PEM da incollare</span>
          <textarea aria-label="PEM da ispezionare" rows={8} value={pem} disabled={file !== null} spellcheck={false} onInput={(event) => { setPem(event.currentTarget.value); setResult(null); }} placeholder="-----BEGIN CERTIFICATE----- …" />
        </label>
        <label class="field">
          <span>oppure file PEM / DER</span>
          <input aria-label="File certificato o CSR" type="file" accept=".pem,.crt,.cer,.csr,.der,application/pkix-cert,application/pkcs10" onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); setResult(null); setError(null); }} />
          <small>Limite locale: {Math.round(X509_MAX_BYTES / 1024)} KiB. Se scegli un file, il testo incollato viene ignorato.</small>
        </label>
        <InlineError message={error} />
        <ToolActions>
          <button class="button primary" type="submit" disabled={busy}>{busy ? "Ispezione…" : "Ispeziona localmente"}</button>
          <button type="button" onClick={reset}>Azzera</button>
        </ToolActions>
      </form>
      {result !== null && (
        <section aria-live="polite">
          <ResultBreakdown
            label="Fatti letti"
            rows={[
              { label: "Tipo", value: result.kind === "certificate" ? "Certificato X.509" : "CSR PKCS#10" },
              { label: "Subject", value: result.subject },
              { label: "Issuer", value: result.issuer ?? "non presente in un CSR" },
              { label: "Seriale", value: result.serialNumber ?? "non presente in un CSR" },
              { label: "Validità da", value: result.validity?.notBefore ?? "non presente in un CSR / non decodificabile" },
              { label: "Validità a", value: result.validity?.notAfter ?? "non presente in un CSR / non decodificabile" },
              { label: "Chiave pubblica", value: `${result.publicKey.algorithm}${result.publicKey.curve === null ? "" : ` · ${result.publicKey.curve}`}${result.publicKey.bits === null ? "" : ` · ${result.publicKey.bits} bit`}` },
              { label: "Algoritmo firma", value: `${result.signatureAlgorithm.name} · ${result.signatureAlgorithm.oid}` },
              { label: "SHA-256", value: result.sha256Fingerprint },
            ]}
          />
          <h3>Subject Alternative Names</h3>
          {result.san.length === 0 ? <p>Nessun SAN supportato trovato.</p> : <ul>{result.san.map((value) => <li key={value}><code>{value}</code></li>)}</ul>}
          <ResultProvenance>{result.trustNotice}</ResultProvenance>
        </section>
      )}
    </ToolSurface>
  );
}
