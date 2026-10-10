import type { ResultDeclaration } from "../../../catalog/manifest";
import type { FilePrivacyOperation, FilePrivacyResult } from "../../../engines/file-privacy";
import { createBoundedTextPreview, type BoundedTextPreview } from "../../../runtime/bounded-preview";
import { createFileResultItem, createFileResultWorkspace, type FileResultItem, type FileResultWorkspaceModel } from "../../../runtime/file-result";
import { verifyGeneratedArtifact } from "../../../runtime/artifact-verifier";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
import {
  BoundedTextResultPreview,
  FileResultWorkspace,
  ResultActions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "../shared";
import { FileSizeAnalysisV2 } from "./FileSizeAnalysisV2";

const TEXT_ENCODER = new TextEncoder();

const VALIDATOR_OPERATIONS = new Set<FilePrivacyOperation>([
  "checksum-verifier",
  "file-signature-detector",
  "zip-contents-inspector",
  "metadata-risk-inspector",
  "secret-token-pattern-scanner",
  "safe-share-checklist",
]);

const TEXT_OPERATIONS = new Set<FilePrivacyOperation>([
  "archive-checksum-manifest",
  "batch-checksum-manifest",
  "client-handoff-index-generator",
]);

const FILE_OPERATIONS = new Set<FilePrivacyOperation>(["clean-zip-creator", "zip-creator", "ai-code-fence-bundle"]);

export function filePrivacyResultDeclaration(operation: FilePrivacyOperation): ResultDeclaration {
  if (FILE_OPERATIONS.has(operation)) {
    return { class: "file", capabilities: ["download", "retry", "reset", "provenance", "before-after"] };
  }
  if (TEXT_OPERATIONS.has(operation)) {
    return { class: "text-code", capabilities: ["copy", "download", "retry", "reset", "provenance"] };
  }
  if (VALIDATOR_OPERATIONS.has(operation)) {
    return { class: "validator", capabilities: ["copy", "retry", "reset", "provenance"] };
  }
  return { class: "batch", capabilities: ["copy", "retry", "reset", "provenance"] };
}

const RESULT_KEY_IT: Readonly<Record<string, string>> = {
  filename: "nome_file",
  files: "file",
  count: "quantità",
  total: "totale",
  size: "dimensione",
  byteLength: "byte_risultato",
  totalBytes: "byte_totali",
  comparedBytes: "byte_confrontati",
  hash: "hash",
  digest: "hash",
  sha256: "sha256",
  manifest: "manifest",
  warnings: "avvisi",
  warning: "avviso",
  findings: "risultati",
  findingCount: "risultati_trovati",
  matches: "corrispondenze",
  duplicates: "duplicati",
  duplicateGroups: "gruppi_duplicati",
  duplicateFileCount: "file_duplicati",
  missing: "mancanti",
  missingCount: "mancanti",
  mismatchCount: "non_corrispondenti",
  matchCount: "corrispondenti",
  changed: "modificati",
  changedCount: "modificati",
  added: "aggiunti",
  addedCount: "aggiunti",
  removed: "rimossi",
  removedCount: "rimossi",
  renamed: "rinominati",
  entries: "voci",
  entryCount: "numero_voci",
  path: "percorso",
  name: "nome",
  original: "originale",
  sanitized: "ripulito",
  risk: "rischio",
  risks: "rischi",
  riskFileCount: "file_con_rischi",
  valid: "valido",
  allMatch: "tutti_corrispondono",
  allPassed: "tutti_i_controlli_superati",
  passedCount: "controlli_superati",
  totalChecks: "controlli_totali",
  emptyCount: "file_vuoti",
  inspectedCount: "file_controllati",
  referencedCount: "riferimenti",
  fileCount: "numero_file",
  collisionCount: "collisioni",
  compression: "compressione",
  scope: "ambito",
  note: "nota",
};

function localizeResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(localizeResult);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    RESULT_KEY_IT[key] ?? key,
    localizeResult(item),
  ]));
}

function serializedResult(result: FilePrivacyResult): string {
  const output: Record<string, unknown> = { ...result };
  delete output.operation;
  if (output.blob instanceof Blob) delete output.blob;
  return JSON.stringify(localizeResult(output), null, 2);
}

function numeric(result: FilePrivacyResult, key: string): number {
  const value = result[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function bool(result: FilePrivacyResult, key: string): boolean | null {
  const value = result[key];
  return typeof value === "boolean" ? value : null;
}

function listLength(result: FilePrivacyResult, key: string): number {
  const value = result[key];
  return Array.isArray(value) ? value.length : 0;
}

function primaryAnswer(operation: FilePrivacyOperation, result: FilePrivacyResult): string {
  switch (operation) {
    case "archive-checksum-manifest": return typeof result.sha256 === "string"
      ? result.sha256
      : `${numeric(result, "count") || numeric(result, "entryCount") || listLength(result, "entries")} hash SHA-256`;
    case "batch-checksum-manifest": return `${numeric(result, "count") || listLength(result, "entries")} hash SHA-256`;
    case "batch-rename-preview":
    case "filename-sanitizer": return `${numeric(result, "changedCount")} nomi da modificare`;
    case "checksum-verifier": return bool(result, "allMatch") === true ? "Checksum verificati" : `${numeric(result, "mismatchCount") + numeric(result, "missingCount")} problemi di checksum`;
    case "clean-zip-creator":
    case "zip-creator": return `Archivio pronto · ${numeric(result, "byteLength")} byte`;
    case "ai-code-fence-bundle": return `${numeric(result, "fileCount")} file pronti nello ZIP`;
    case "client-handoff-index-generator": return `${numeric(result, "count")} file nell'indice`;
    case "duplicate-file-finder": return `${numeric(result, "duplicateFileCount")} file duplicati`;
    case "file-list-diff":
    case "folder-compare": return `${numeric(result, "addedCount") + numeric(result, "removedCount") + numeric(result, "changedCount")} differenze`;
    case "file-signature-detector": return `${listLength(result, "files")} firme controllate`;
    case "folder-inventory": return `${numeric(result, "count")} file inventariati`;
    case "folder-size-type-summary": return `${numeric(result, "count")} file · ${numeric(result, "totalBytes")} byte`;
    case "file-size-analyzer": return `${numeric(result, "bytes")} byte · ${String(result.kind ?? "contenuto")} analizzato`;
    case "metadata-risk-inspector": return `${numeric(result, "riskFileCount")} file con indicatori di rischio`;
    case "safe-share-checklist": return `${numeric(result, "passedCount")}/${numeric(result, "totalChecks")} controlli superati`;
    case "secret-token-pattern-scanner": return `${numeric(result, "findingCount")} corrispondenze da verificare`;
    case "zero-byte-orphan-finder": return `${listLength(result, "emptyFiles") + listLength(result, "orphanReferences")} elementi da controllare`;
    case "zip-contents-inspector": return `${numeric(result, "entryCount")} voci ZIP ispezionate`;
    case "file-hash": return typeof result.sha256 === "string" ? result.sha256 : "Hash calcolato";
  }
}

function warningState(operation: FilePrivacyOperation, result: FilePrivacyResult): boolean {
  switch (operation) {
    case "batch-rename-preview":
    case "filename-sanitizer": return numeric(result, "collisionCount") > 0;
    case "checksum-verifier": return bool(result, "allMatch") !== true;
    case "metadata-risk-inspector": return numeric(result, "riskFileCount") > 0;
    case "safe-share-checklist": return bool(result, "allPassed") !== true;
    case "secret-token-pattern-scanner": return numeric(result, "findingCount") > 0;
    case "zip-contents-inspector": return bool(result, "hasPathTraversal") === true || bool(result, "hasEncryptedEntries") === true;
    case "zero-byte-orphan-finder": return listLength(result, "emptyFiles") + listLength(result, "orphanReferences") > 0;
    default: return false;
  }
}

function breakdownRows(result: FilePrivacyResult): Array<{ label: string; value: string }> {
  const scalarKeys = [
    "count", "totalBytes", "byteLength", "entryCount", "inspectedCount", "duplicateFileCount",
    "changedCount", "collisionCount", "matchCount", "mismatchCount", "missingCount", "riskFileCount",
    "findingCount", "passedCount", "totalChecks", "addedCount", "removedCount", "unchangedCount", "comparedBytes",
  ];
  return scalarKeys
    .filter((key) => typeof result[key] === "number")
    .slice(0, 8)
    .map((key) => ({ label: RESULT_KEY_IT[key] ?? key, value: new Intl.NumberFormat("it-IT").format(result[key] as number) }));
}

function sourceFacts(input: Readonly<Record<string, unknown>>): { name: string; byteLength: number; detectedMime?: string } {
  const files = ["files", "before", "after"]
    .flatMap((key) => Array.isArray(input[key]) ? input[key] as unknown[] : [])
    .filter((value): value is File => typeof File !== "undefined" && value instanceof File);
  if (files.length > 0) {
    return {
      name: files.length === 1 ? files[0]!.name : `${files.length} file selezionati`,
      byteLength: files.reduce((sum, file) => sum + file.size, 0),
      ...(files.length === 1 && files[0]!.type !== "" ? { detectedMime: files[0]!.type } : {}),
    };
  }
  const text = [input.text, input.expected, Array.isArray(input.names) ? input.names.join("\n") : ""]
    .filter((value): value is string => typeof value === "string" && value !== "")
    .join("\n");
  return { name: "Dati inseriti", byteLength: TEXT_ENCODER.encode(text).byteLength, detectedMime: "text/plain" };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : null;
}

function batchRows(result: FilePrivacyResult): readonly unknown[] {
  for (const key of ["entries", "files", "groups", "duplicateGroups", "checks", "emptyFiles", "orphanReferences", "unreferencedFiles"]) {
    const value = result[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function batchRowName(value: unknown, index: number): string {
  const row = asRecord(value);
  if (row !== null) {
    for (const key of ["path", "name", "original", "input", "filename"]) {
      if (typeof row[key] === "string" && row[key].trim() !== "") return row[key].trim();
    }
  }
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return `Elemento ${index + 1}`;
}

function batchRowBytes(value: unknown): number {
  const row = asRecord(value);
  if (row === null) return 0;
  for (const key of ["size", "byteLength", "bytes", "inputBytes"]) {
    const candidate = row[key];
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0) return candidate;
  }
  return 0;
}

function batchRowError(value: unknown): string | null {
  const row = asRecord(value);
  if (row === null) return null;
  if (typeof row.error === "string" && row.error.trim() !== "") return row.error;
  if (row.ok === false) return typeof row.message === "string" ? row.message : "Elemento non elaborato.";
  if (row.status === "error" || row.status === "cancelled" || row.status === "unsupported") {
    return typeof row.message === "string" ? row.message : String(row.status);
  }
  return null;
}

function batchWorkspaceItems(operation: FilePrivacyOperation, result: FilePrivacyResult): readonly FileResultItem[] {
  const rows = batchRows(result);
  return rows.map((value, index) => {
    const name = batchRowName(value, index);
    const byteLength = batchRowBytes(value);
    const error = batchRowError(value);
    if (error !== null) {
      return createFileResultItem({
        id: `${operation}-${index}`,
        source: { name, byteLength },
        status: error === "cancelled" ? "cancelled" : "error",
        message: error,
        retryable: true,
        cancellable: false,
        beforeBytes: byteLength,
      });
    }
    const serialized = JSON.stringify(localizeResult(value), null, 2);
    const artifact = verifiedTextArtifact(
      `${operation}-${index + 1}.json`,
      "application/json",
      serialized,
      "Riga del risultato batch serializzata senza perdere i dati prodotti dal motore locale.",
    );
    const row = asRecord(value);
    const detectedMime = typeof row?.type === "string"
      ? row.type
      : typeof row?.mime === "string"
        ? row.mime
        : undefined;
    return createFileResultItem({
      id: `${operation}-${index}`,
      source: { name, byteLength, ...(detectedMime === undefined || detectedMime === "" ? {} : { detectedMime }) },
      status: "success",
      artifact,
      retryable: false,
      cancellable: false,
      beforeBytes: byteLength,
      afterBytes: artifact.byteLength,
      message: "Elemento preservato nel risultato batch locale.",
    });
  });
}

function verifiedTextArtifact(name: string, mime: string, text: string, fidelityNote: string): OutputArtifactDescriptor {
  return createOutputArtifactDescriptor({
    kind: mime === "application/json" ? "structured" : "text",
    name,
    mime,
    bytes: TEXT_ENCODER.encode(text),
    verification: {
      state: "verified",
      verifiedMime: mime,
      method: "serializzazione UTF-8 del risultato completato dal motore locale file/privacy",
    },
    fidelity: "structural",
    fidelityNote,
  });
}

export interface PreparedFilePrivacyResult {
  readonly value: FilePrivacyResult;
  readonly declaration: ResultDeclaration;
  readonly copyText: string;
  readonly preview: BoundedTextPreview;
  readonly workspace: FileResultWorkspaceModel;
  readonly downloadArtifact: OutputArtifactDescriptor | null;
}

export async function prepareFilePrivacyResult(
  operation: FilePrivacyOperation,
  value: FilePrivacyResult,
  input: Readonly<Record<string, unknown>>,
): Promise<PreparedFilePrivacyResult> {
  const declaration = filePrivacyResultDeclaration(operation);
  const serialized = serializedResult(value);
  let previewText = serialized;
  let previewArtifact = verifiedTextArtifact(`${operation}-risultato.json`, "application/json", serialized, "Report completo serializzato dal risultato locale.");
  let workspaceArtifact = previewArtifact;
  let downloadArtifact: OutputArtifactDescriptor | null = null;

  if (TEXT_OPERATIONS.has(operation)) {
    const markdown = typeof value.markdown === "string" ? value.markdown : null;
    const manifest = typeof value.manifest === "string" ? value.manifest : null;
    previewText = manifest ?? markdown ?? serialized;
    const mime = manifest !== null ? "text/plain" : markdown !== null ? "text/markdown" : "application/json";
    const name = manifest !== null ? `${operation}.sha256` : markdown !== null ? `${operation}.md` : `${operation}.json`;
    previewArtifact = verifiedTextArtifact(name, mime, previewText, "Testo completo prodotto dal motore locale, senza il limite dell'anteprima.");
    workspaceArtifact = previewArtifact;
    downloadArtifact = previewArtifact;
  }

  if (FILE_OPERATIONS.has(operation) && value.blob instanceof Blob) {
    const bytes = new Uint8Array(await value.blob.arrayBuffer());
    const verified = await verifyGeneratedArtifact({
      kind: "file",
      name: typeof value.filename === "string" ? value.filename : `${operation}.zip`,
      declaredMime: value.blob.type || "application/zip",
      bytes,
      fidelity: {
        fidelity: "structural",
        statement: "Archivio ZIP generato localmente; firma e record di fine directory verificati sui byte prodotti.",
      },
    });
    workspaceArtifact = verified.artifact;
    downloadArtifact = verified.artifact;
  }

  const source = sourceFacts(input);
  const batchItems = declaration.class === "batch" ? batchWorkspaceItems(operation, value) : [];
  const workspace = createFileResultWorkspace(batchItems.length > 0 ? batchItems : [
    createFileResultItem({
      id: operation,
      source,
      status: workspaceArtifact.verification.state === "verified" ? "success" : "warning",
      artifact: workspaceArtifact,
      retryable: true,
      cancellable: false,
      beforeBytes: source.byteLength,
      afterBytes: workspaceArtifact.byteLength,
      message: workspaceArtifact.verification.state === "verified"
        ? "Risultato misurato e preparato interamente in locale."
        : workspaceArtifact.verification.message ?? "Il risultato richiede verifica prima del download.",
    }),
  ], { location: "LOCAL", network: "forbidden" });

  return {
    value,
    declaration,
    copyText: previewText,
    preview: createBoundedTextPreview(previewArtifact, 80, "code"),
    workspace,
    downloadArtifact,
  };
}

export interface FilePrivacyResultV2Props {
  readonly operation: FilePrivacyOperation;
  readonly prepared: PreparedFilePrivacyResult;
  readonly onRetry: () => void | Promise<void>;
  readonly onReset: () => void;
}

export function FilePrivacyResultV2({ operation, prepared, onRetry, onReset }: FilePrivacyResultV2Props) {
  const { value, declaration, preview, workspace, downloadArtifact } = prepared;
  const primary = declaration.class === "file" ? "download" : "copy";
  const actions = resolveResultActions({
    declaration,
    primary,
    hasCopyPayload: prepared.copyText !== "",
    ...(downloadArtifact === null ? {} : { artifact: downloadArtifact }),
    retryReady: true,
    resetReady: true,
  });
  const isWarning = warningState(operation, value);
  const completedItems = workspace.items.filter((item) => item.status === "success" || item.status === "warning" || item.status === "partial").length;
  const failedItems = workspace.items.filter((item) => item.status === "error" || item.status === "cancelled").length;

  async function copyResult() {
    if (navigator.clipboard === undefined) return;
    await navigator.clipboard.writeText(prepared.copyText);
  }

  function downloadResult() {
    if (downloadArtifact === null || !downloadArtifact.download.ready) return;
    const blob = new Blob([downloadArtifact.bytes.slice().buffer], { type: downloadArtifact.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadArtifact.download.filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div data-result-class={declaration.class}>
      <ResultExplanation
        primary={
          <div data-result-slot={declaration.class === "validator" ? "primary" : undefined}>
            <ResultPrimaryAnswer label="Esito">{primaryAnswer(operation, value)}</ResultPrimaryAnswer>
          </div>
        }
        interpretation={
          <div data-result-slot={declaration.class === "validator" ? "interpretation" : undefined}>
            <ResultInterpretation state={isWarning ? "warning" : "success"}>
              {isWarning
                ? "Il controllo locale ha trovato elementi da verificare nel dettaglio."
                : declaration.class === "file"
                  ? "Il file è stato generato e verificato sui byte prodotti."
                  : "Elaborazione locale completata sui dati selezionati."}
            </ResultInterpretation>
          </div>
        }
        breakdown={
          <div data-result-slot={declaration.class === "validator" ? "checks" : undefined}>
            <ResultBreakdown rows={breakdownRows(value)} />
          </div>
        }
        provenance={
          <div data-result-slot={declaration.class === "validator" ? "provenance" : undefined}>
            <ResultProvenance>Nessun contenuto del task viene inviato in rete: elaborazione e verifica avvengono in questo browser.</ResultProvenance>
          </div>
        }
      />
      {operation === "file-size-analyzer" && <FileSizeAnalysisV2 result={value} />}
      <div data-result-slot={declaration.class === "file" ? "file-workspace" : declaration.class === "batch" ? "batch-summary" : undefined}>
        {declaration.class === "batch" && (
          <ResultBreakdown label="Stato batch" rows={[
            { label: "Completati", value: String(completedItems) },
            { label: "Da riprovare", value: String(failedItems) },
          ]} />
        )}
        <FileResultWorkspace workspace={workspace} />
      </div>
      {declaration.class === "text-code" ? (
        <>
          <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={preview} /></div>
          <div data-result-slot="counts"><ResultBreakdown rows={[{ label: "Byte risultato completo", value: String(preview.artifact.byteLength) }]} /></div>
        </>
      ) : (
        <details data-result-secondary-raw>
          <summary>Dati completi</summary>
          <BoundedTextResultPreview preview={preview} />
        </details>
      )}
      <ResultActions
        actions={actions}
        onAction={{
          copy: copyResult,
          download: downloadResult,
          retry: onRetry,
          reset: onReset,
        }}
      />
    </div>
  );
}
