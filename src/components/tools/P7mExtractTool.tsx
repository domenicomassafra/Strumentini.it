import { useState } from "preact/hooks";
import type { P7mExtraction176 } from "../../engines/p7m/reader-176";
import { P7M_LIMITS_176, P7M_NOTICE_176 } from "../../engines/p7m/reader-176";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolOperation, ToolCancelButton, ToolResetButton, ToolResultPanel, ToolSubmitButton, gutterStateFor, useToolOperation } from "./shared";

const MESSAGES: Readonly<Record<string, string>> = {
  P7M_INPUT: "Scegli un file P7M o P7S locale.",
  P7M_EMPTY: "Il file selezionato è vuoto.",
  P7M_LIMIT: "Il file supera il limite locale di " + P7M_LIMITS_176.maxFileBytes / 1048576 + " MiB.",
  P7M_CONTENT_LIMIT: "Il contenuto incluso supera il limite locale di estrazione.",
  P7M_DETACHED: "Firma senza contenuto incluso: il documento separato non è disponibile, quindi non c'è nulla da estrarre.",
  P7M_NOT_SIGNED_DATA: "Il file non è una busta CMS/PKCS#7 di tipo SignedData.",
  P7M_ENCODING: "Codifica PEM non valida.",
  P7M_INDEFINITE_LENGTH: "Codifica BER a lunghezza indefinita non supportata: serve un P7M in DER.",
  P7M_CANCELLED: "Operazione annullata.",
};

function describeError(code: string): string {
  return MESSAGES[code] ?? "Il file non è un P7M leggibile o è danneggiato (" + code + ").";
}

export function P7mExtractTool() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const operation = useToolOperation<P7mExtraction176>(
    (signal) => toolRuntime.run("p7m-extract", { file }, {}, signal),
    { formatError: (result) => describeError(result.message.replace(/^Error:\s*/u, "")) },
  );
  const extraction = operation.result;
  function reset() {
    setFile(null);
    setMessage("");
    operation.reset();
    const picker = document.getElementById("p7m-extract-file") as HTMLInputElement | null;
    if (picker) picker.value = "";
  }
  function download() {
    if (!extraction) return;
    const bytes = new Uint8Array(extraction.content.byteLength);
    bytes.set(extraction.content);
    const url = URL.createObjectURL(new Blob([bytes.buffer], { type: extraction.mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = extraction.fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
    setMessage("Documento estratto scaricato: la firma resta non verificata.");
  }
  return <ToolOperation busy={operation.isRunning}>
    <form onSubmit={(event) => { event.preventDefault(); setMessage(""); void operation.run(); }} noValidate>
      <label class="field" for="p7m-extract-file">
        <span>File firmato P7M/CMS</span>
        <input id="p7m-extract-file" type="file" accept=".p7m,.p7s,application/pkcs7-mime,application/octet-stream" required disabled={operation.isRunning}
          onChange={(event) => { setFile(event.currentTarget.files?.item(0) ?? null); setMessage(""); operation.reset(); }} />
        <small>{file ? file.name + " · " + file.size + " byte" : "File fino a " + (P7M_LIMITS_176.maxFileBytes / 1048576) + " MiB · estrazione locale · nessuna rete"}</small>
      </label>
      <InlineError message={operation.error} />
      <ToolActions>
        <ToolSubmitButton busy={operation.isRunning}>Estrai il documento</ToolSubmitButton>
        {operation.isRunning && <ToolCancelButton onCancel={operation.cancel} />}
        <ToolResetButton onClick={reset} disabled={operation.isRunning} />
      </ToolActions>
    </form>
    <ToolResultPanel eyebrow="P7M locale" placeholder="Il documento incluso comparirà qui. La busta CMS viene solo aperta: la firma non viene verificata." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      <p class="file-note" data-p7m-notice role="note">{P7M_NOTICE_176}</p>
      {!extraction && !operation.isRunning && <p class="gutter-placeholder result-placeholder">Il documento incluso comparirà qui. La busta CMS viene solo aperta: la firma non viene verificata.</p>}
      {extraction && <div data-result-class="file" data-p7m-extraction>
        <h3>{extraction.fileName}</h3>
        <dl>
          <dt>Contenuto</dt>
          <dd data-p7m-bytes>{extraction.contentBytes} byte · {extraction.mimeType}</dd>
          <dt>Busta</dt>
          <dd>CMS/PKCS#7 SignedData · {extraction.encoding} · tipo contenuto {extraction.contentTypeOid}</dd>
          <dt>Firmatari nel file</dt>
          <dd data-p7m-signers>{extraction.signerCount} · certificati inclusi {extraction.certificateCount} · tutti NON verificati</dd>
        </dl>
        <ToolActions>
          <button type="button" onClick={download}>Scarica il documento estratto</button>
        </ToolActions>
        <p class="file-note">Il contenuto può essere leggibile anche quando la firma è rotta o il certificato non è affidabile: per questo l'esito resta sempre «firma NON verificata». Nessun contenuto viene eseguito o inviato in rete.</p>
        {message && <p role="status" aria-live="polite">{message}</p>}
      </div>}
    </ToolResultPanel>
  </ToolOperation>;
}
