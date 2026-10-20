/** Viewer-only presentation: never enumerate raw GPS coordinates in generic rows. */
import { useState } from "preact/hooks";
import type { PreparedImageResult, ImageResultValue } from "./ImageResultV2";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function metadataRows272(raw: ImageResultValue): readonly { label: string; value: string }[] {
  const fields: Array<[string, unknown]> = [
    ["File", raw.name], ["Dimensione", raw.sizeLabel], ["Formato", raw.mime],
    ["Firma", raw.signature], ["Larghezza (px)", raw.width], ["Altezza (px)", raw.height],
    ["Limite pixel rispettato", raw.bounded === true ? "Sì" : "No"],
    ["Stato tag", raw.metadataStatus],
    ["Produttore fotocamera", raw.cameraMake], ["Modello fotocamera", raw.cameraModel],
    ["Data acquisizione (timezone non dichiarata)", raw.takenAt],
    ["Orientamento EXIF (1–8)", raw.orientation],
    ["Profilo ICC", raw.iccProfile], ["Titolo IPTC", raw.iptcTitle],
    ["Titolo XMP", raw.xmpTitle],
    ["GPS", raw.gpsPresent === true ? "Rilevato · coordinate nascoste" : "Coordinate non verificate"],
  ];
  return fields.filter(([, value]) => value !== undefined)
    .map(([label, value]) => ({ label, value: String(value) }));
}

function sensitiveGpsText272(value: unknown): string {
  const gps = record(value);
  return typeof gps?.latitude === "number" && typeof gps?.longitude === "number"
    ? `${gps.latitude}, ${gps.longitude}`
    : "Coordinate non verificabili nei tag presenti.";
}

export function ImageMetadataGps272({ result }: { readonly result: PreparedImageResult }) {
  const [revealedGpsResult, setRevealedGpsResult] = useState<PreparedImageResult | null>(null);
  const revealed = revealedGpsResult === result;
  return (
    <section data-gps-private-272 aria-label="Coordinate geografiche sensibili">
      <p>Posizione GPS rilevata: coordinate nascoste per impostazione iniziale e omesse dalla copia JSON.</p>
      {revealed
        ? <><p data-gps-revealed-272>{sensitiveGpsText272(result.raw.gps)}</p><button type="button" onClick={() => setRevealedGpsResult(null)}>Nascondi coordinate</button></>
        : <button type="button" onClick={() => setRevealedGpsResult(result)}>Mostra coordinate GPS</button>}
    </section>
  );
}
