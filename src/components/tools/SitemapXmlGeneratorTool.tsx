import { useMemo, useState } from "preact/hooks";
import { createBoundedTextPreview } from "../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../runtime/output-artifact";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { sitemapXmlGeneratorManifest } from "../../tools/sitemap-xml-generator/manifest";
import type { SitemapXmlResult } from "../../engines/url-marketing";
import {
  BoundedTextResultPreview,
  InlineError,
  ResultActions,
  ResultBreakdown,
  ResultPrimaryAnswer,
  ResultProvenance,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

function friendlySitemapError(message: string): string {
  const rowMatch = /^INVALID_SITEMAP_ROW_(\d+)_(.+)$/u.exec(message);
  if (rowMatch !== null) {
    const row = rowMatch[1] ?? "?";
    const reason = rowMatch[2] ?? "";
    const detail = reason === "UNSAFE_URL_SCHEME" ? "usa solo URL http:// o https://"
      : reason === "INVALID_URL" || reason === "URL" ? "l'URL non è valido"
        : reason === "CREDENTIALS" ? "le credenziali user:password negli URL non sono ammesse"
          : reason === "LOC_LENGTH" ? "l'URL normalizzato supera 2.047 caratteri"
            : reason === "HOST_MISMATCH" ? "l'host è diverso da quello delle altre righe"
              : reason === "LASTMOD" ? "lastmod non è una data W3C valida"
                : reason === "CHANGEFREQ" ? "changefreq non è uno dei valori sitemap ammessi"
                  : reason === "PRIORITY" ? "priority deve essere compresa tra 0.0 e 1.0"
                    : reason === "COLUMN_COUNT" ? "usa al massimo quattro colonne separate da TAB"
                      : "la riga non rispetta il formato sitemap";
    return `Riga ${row}: ${detail}.`;
  }
  if (message === "INVALID_SITEMAP_EMPTY") return "Inserisci almeno un URL HTTP(S).";
  if (message === "INVALID_SITEMAP_URL_COUNT_LIMIT") return "Una sitemap può contenere al massimo 50.000 URL.";
  if (message === "INVALID_SITEMAP_SIZE_LIMIT" || message === "INVALID_SITEMAP_INPUT_SIZE_LIMIT") return "La sitemap non può superare 50 MiB non compressi.";
  return "Controlla URL e metadati: la sitemap non può essere generata con questi valori.";
}

function downloadArtifact(name: string, mime: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SitemapXmlGeneratorTool() {
  const [text, setText] = useState("https://example.com/\nhttps://example.com/blog\t2026-10-06\tweekly\t0.8");
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<SitemapXmlResult>(
    (signal: AbortSignal) => toolRuntime.run("sitemap-xml-generator", { text }, {}, signal),
    { formatError: (result) => friendlySitemapError(result.message) },
  );
  const result = operation.result;
  const artifact = useMemo(() => result === null ? null : createOutputArtifactDescriptor({
    kind: "file",
    name: "sitemap.xml",
    mime: "application/xml;charset=utf-8",
    bytes: new TextEncoder().encode(result.xml),
    verification: {
      state: "verified",
      verifiedMime: "application/xml",
      method: "local sitemap serializer after URL, metadata, host, count and byte-bound validation",
    },
    fidelity: "lossless",
    fidelityNote: "Il download contiene l'intero XML UTF-8 generato localmente, senza tag o valori aggiunti oltre a quelli dichiarati.",
  }), [result]);
  const preview = artifact === null ? null : createBoundedTextPreview(artifact, 32, "code");
  const actions = artifact === null ? [] : resolveResultActions({
    declaration: sitemapXmlGeneratorManifest.result,
    primary: "download",
    hasCopyPayload: true,
    artifact,
    resetReady: true,
  });

  function reset() {
    setActionStatus("");
    operation.reset();
  }

  async function copyXml() {
    if (result === null || navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; usa il download oppure seleziona l'anteprima.");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.xml);
      setActionStatus("XML completo copiato negli appunti.");
    } catch {
      setActionStatus("Il browser ha bloccato gli appunti; usa il download oppure seleziona l'anteprima.");
    }
  }

  return (
    <ToolOperation className="single-column" busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); setActionStatus(""); void operation.run(); }}>
        <ToolFormCard>
          <label class="field">
            <span>URL e metadati opzionali</span>
            <textarea
              aria-label="URL e metadati sitemap"
              rows={12}
              value={text}
              onInput={(event) => setText(event.currentTarget.value)}
              placeholder={"https://example.com/\nhttps://example.com/articolo\t2026-10-06\tweekly\t0.8"}
            />
          </label>
          <p class="file-note">
            Una riga per URL. Le colonne opzionali, separate da TAB, sono: <code>lastmod</code>, <code>changefreq</code>, <code>priority</code>. Tutti gli URL devono essere HTTP(S) e appartenere allo stesso host.
          </p>
          <p class="file-note">Limiti sitemap: 50.000 URL, 50 MiB non compressi e meno di 2.048 caratteri per ogni URL normalizzato.</p>
          <InlineError message={operation.error} />
          <ToolActions>
            <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Genera sitemap.xml</ToolSubmitButton>
            <ToolResetButton onClick={reset} disabled={operation.isRunning} />
          </ToolActions>
        </ToolFormCard>
      </form>
      <ToolResultPanel eyebrow="Sitemap XML" placeholder="L'XML validato apparirà qui." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && artifact !== null && preview !== null && (
          <div data-result-class="text-code">
            <ResultPrimaryAnswer label="Sitemap pronta">{result.count} URL · {result.byteLength} byte</ResultPrimaryAnswer>
            <div data-result-slot="counts">
              <ResultBreakdown label="Contenuto" rows={[
                { label: "Host", value: result.host },
                { label: "lastmod forniti", value: String(result.metadataCounts.lastmod) },
                { label: "changefreq forniti", value: String(result.metadataCounts.changefreq) },
                { label: "priority fornite", value: String(result.metadataCounts.priority) },
              ]} />
            </div>
            <ResultProvenance>Elaborazione locale; nessuna richiesta di rete. I metadati opzionali compaiono solo sulle righe che li forniscono.</ResultProvenance>
            <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={preview} /></div>
            <ResultActions actions={actions} onAction={{
              copy: copyXml,
              download: () => downloadArtifact(artifact.download.filename, artifact.download.mime, artifact.bytes),
              reset,
            }} />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
