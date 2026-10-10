import type { FilePrivacyResult } from "../../../engines/file-privacy";
import { ResultBreakdown } from "../shared";

type RecordValue = Readonly<Record<string, unknown>>;
const asRecord = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const asRows = (value: unknown): readonly RecordValue[] => Array.isArray(value) ? value.map(asRecord) : [];
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const formatted = (value: unknown): string => number(value) === null ? "non determinato" : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(value as number);
const bytes = (value: unknown): string => number(value) === null ? "non determinato" : `${formatted(value)} byte`;
const label = (value: unknown): string => typeof value === "string" && value.trim() !== "" ? value : "non determinato";

const NEXT_TOOLS: Readonly<Record<string, string>> = {
  "image-metadata-viewer": "Controlla i metadati immagine",
  "image-resize": "Ridimensiona l'immagine",
  "image-compression": "Comprimi l'immagine",
  "pdf-compression-lite": "Prova la compressione PDF leggera",
  "ooxml-media-compression": "Ottimizza le immagini Office",
  "zip-contents-inspector": "Esamina le voci ZIP",
  "archive-checksum-manifest": "Verifica l'archivio",
  "file-signature-detector": "Verifica il formato",
};

function TopEntries({ entries, kind }: { entries: readonly RecordValue[]; kind: "office" | "zip" }) {
  if (entries.length === 0) return null;
  return (
    <div data-size-largest-entries>
      <h4>Elementi che occupano più spazio</h4>
      <ol>
        {entries.map((entry, index) => (
          <li key={`${String(entry.path)}-${index}`} style={{ overflowWrap: "anywhere" }}>
            <strong>{label(entry.path)}</strong>: {bytes(kind === "office" ? entry.compressedBytes : entry.compressedSize)} compressi
            {number(entry.uncompressedBytes) !== null && <> · {bytes(entry.uncompressedBytes)} prima della compressione</>}
            {typeof entry.group === "string" && <> · {entry.group}</>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Evidence-first presentation: next actions are links, not an unsupported file transfer. */
export function FileSizeAnalysisV2({ result }: { result: FilePrivacyResult }) {
  const kind = label(result.kind);
  const image = asRecord(result.image);
  const pdf = asRecord(result.pdf);
  const office = asRecord(result.office);
  const zip = asRecord(result.zip);
  const audio = asRecord(result.audio);
  const video = asRecord(result.video);
  const nextActions = Array.isArray(result.nextActions)
    ? result.nextActions.filter((id): id is string => typeof id === "string" && Object.hasOwn(NEXT_TOOLS, id))
    : [];
  const pdfProfiles: Readonly<Record<string, string>> = {
    "scan-page-candidate": "Possibile documento composto da pagine immagine (controlli geometrici limitati)",
    "text-vector-candidate": "Possibile PDF di testo/vettori semplici (controlli limitati)",
    "embedded-image-byte-heavy": "Il peso misurato è concentrato negli stream immagine; non prova che sia una scansione",
    unknown: "Tipo prevalente non accertabile con l'ispezione limitata",
  };

  return (
    <section data-file-size-analysis aria-label="Analisi della dimensione del file">
      <h3>Da dove viene la dimensione</h3>
      {kind === "image" && (
        <>
          <ResultBreakdown rows={[
            { label: "Dimensioni", value: `${formatted(image.width)} × ${formatted(image.height)} px` },
            { label: "Pixel", value: formatted(image.pixels) },
            { label: "Codifica", value: label(image.encoding) },
            { label: "Byte per pixel del file", value: formatted(image.bytesPerPixel) },
            { label: "Segnali metadati", value: formatted(image.metadataRiskCount) },
          ]} />
          {Array.isArray(image.metadataFields) && image.metadataFields.length > 0 &&
            <p>Metadati rilevati: {image.metadataFields.map(String).join(", ")}</p>}
          {Array.isArray(image.oversizeSignals) && image.oversizeSignals.length > 0 ? (
            <div data-size-oversize><strong>Verifica se è sovradimensionata per il tuo uso:</strong>
              <ul>{image.oversizeSignals.map((signal) => <li key={String(signal)}>{String(signal)}</li>)}</ul>
            </div>
          ) : <p>Nessuna soglia indicativa di dimensione superata. Il corretto formato dipende comunque dall'uso previsto.</p>}
        </>
      )}
      {kind === "pdf" && (
        <>
          <p data-size-pdf-profile>{pdfProfiles[label(result.sizeProfile)] ?? pdfProfiles.unknown}</p>
          <ResultBreakdown rows={[
            { label: "Pagine", value: formatted(pdf.pageCount) },
            { label: "Stream immagine incorporati", value: bytes(pdf.imageStreamBytes) },
            { label: "Altri stream + immagini", value: bytes(pdf.encodedStreamBytes) },
            { label: "Strutture e altri byte", value: bytes(pdf.structuralRemainderBytes) },
            { label: "Quota immagini sugli stream codificati", value: number(result.imageShareOfEncodedStreams) === null ? "non determinata" : `${formatted((result.imageShareOfEncodedStreams as number) * 100)}%` },
          ]} />
          <p>Un PDF con molte immagini incorporate non è automaticamente una scansione. Le pagine complesse restano non classificate.</p>
        </>
      )}
      {kind === "office" && (
        <>
          <ResultBreakdown rows={[
            { label: "Formato", value: label(office.format).toUpperCase() },
            { label: "Voci nel pacchetto", value: formatted(office.entryCount) },
            ...["media", "xml", "font", "other"].map((category) => ({
              label: `Byte compressi ${category}`,
              value: bytes(asRecord(asRecord(office.groups)[category]).compressedMemberBytes),
            })),
            { label: "Struttura ZIP", value: bytes(office.zipOverheadBytes) },
          ]} />
          <TopEntries kind="office" entries={asRows(office.largestEntries)} />
        </>
      )}
      {kind === "zip" && (
        <>
          <ResultBreakdown rows={[
            { label: "Voci ZIP", value: formatted(zip.entryCount) },
            { label: "Dati compressi dichiarati", value: bytes(zip.totalCompressedEntryBytes) },
            { label: "Dati dichiarati non compressi", value: bytes(zip.totalUncompressedBytes) },
            { label: "Struttura ZIP", value: bytes(zip.zipOverheadBytes) },
          ]} />
          <h4>Totali dichiarati per estensione (directory ZIP)</h4>
          <ul data-size-zip-groups>
            {asRows(zip.groupsByExtension).map((group) => (
              <li key={label(group.extension)}>.{label(group.extension)}: {formatted(group.entryCount)} voci · {bytes(group.compressedBytes)} compressi · {bytes(group.uncompressedBytes)} non compressi dichiarati</li>
            ))}
          </ul>
          <TopEntries kind="zip" entries={asRows(zip.largestEntries)} />
        </>
      )}
      {kind === "audio" && <ResultBreakdown rows={[
        { label: "Codifica", value: label(audio.codec) },
        { label: "Durata", value: number(audio.durationSeconds) === null ? "non determinata" : `${formatted(audio.durationSeconds)} s` },
        { label: "Frequenza di campionamento", value: number(audio.sampleRateHz) === null ? "non determinata" : `${formatted(audio.sampleRateHz)} Hz` },
        { label: "Canali", value: formatted(audio.channels) },
        { label: "Bitrate PCM dichiarato", value: number(audio.declaredBitrateBps) === null ? "non determinato" : `${formatted(audio.declaredBitrateBps)} bit/s` },
        { label: "Dati PCM", value: bytes(audio.dataBytes) },
      ]} />}
      {kind === "video" && (
        <>
          <ResultBreakdown rows={[
            { label: "Formato", value: label(video.format).toUpperCase() },
            { label: "Tracce video", value: formatted(video.videoTracks) },
            { label: "Tracce audio", value: formatted(video.audioTracks) },
            { label: "Durata", value: number(video.durationSeconds) === null ? "non determinata" : `${formatted(video.durationSeconds)} s` },
            { label: "Bitrate medio del contenitore", value: number(video.averageContainerBitrateBps) === null ? "non determinato" : `${formatted(video.averageContainerBitrateBps)} bit/s` },
          ]} />
          {asRows(video.tracks).map((track, index) => (
            <p key={index}>Traccia {index + 1}: {label(track.type)} · codec {label(track.codecFourCc)} · {number(track.width) === null ? "risoluzione ignota" : `${formatted(track.width)} × ${formatted(track.height)} px`} · FPS e bitrate della singola traccia non determinati</p>
          ))}
        </>
      )}
      {kind === "unknown" && <p>Il formato non è identificato con sufficiente certezza. Vengono riportati soltanto i byte del file, senza inventare la causa della sua dimensione.</p>}

      <div data-size-next-actions>
        <h3>Prossimo passo</h3>
        {nextActions.length > 0 ? (
          <ul>{nextActions.map((id) => <li key={id}><a href={`/tools/${id}/`}>{NEXT_TOOLS[id]}</a></li>)}</ul>
        ) : <p>Nessun ottimizzatore compatibile verificato per questo formato.</p>}
        {nextActions.length > 0 && <p>Il collegamento apre un altro strumento locale. Per ora devi selezionare nuovamente il file: questo risultato non dispone di un passaggio automatico al compressore.</p>}
        <p>Risparmio previsto: sconosciuto finché non viene creato e misurato un nuovo file. L'analisi non modifica l'originale.</p>
      </div>
    </section>
  );
}
