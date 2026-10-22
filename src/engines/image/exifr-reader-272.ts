/**
 * Optional, bounded local metadata enrichment for the existing header viewer.
 * Upstream: MikeKovarik/exifr v7.1.3 (MIT). No network, pixel decode or writes.
 * The privacy scanner and canonical stripper remain separate authorities.
 */
import { abortIfNeeded } from "./visual";

export const EXIFR_METADATA_FILE_LIMIT = 16 * 1024 * 1024;

export interface ExifrDetails272 {
  readonly metadataStatus: "read" | "absent" | "unavailable" | "skipped-size";
  readonly metadataNote: string;
  readonly cameraMake?: string | undefined;
  readonly cameraModel?: string | undefined;
  readonly takenAt?: string | undefined;
  readonly orientation?: number | undefined;
  readonly iccProfile?: string | undefined;
  readonly iptcTitle?: string | undefined;
  readonly xmpTitle?: string | undefined;
  readonly gpsPresent: boolean;
  readonly gps?: { readonly latitude: number; readonly longitude: number };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function label(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  const clean = value.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 160);
  return clean.length > 0 ? clean : undefined;
}

function shortDate(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return label(value);
}

function validCoordinate(value: unknown, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= max ? value : undefined;
}

export async function readExifrDetails272(blob: Blob, signal?: AbortSignal): Promise<ExifrDetails272> {
  abortIfNeeded(signal);
  if (blob.size > EXIFR_METADATA_FILE_LIMIT) {
    return { metadataStatus: "skipped-size", metadataNote: "Lettura dei tag saltata: limite 16 MiB; header verificato separatamente.", gpsPresent: false };
  }
  try {
    const { parse } = await import("exifr");
    abortIfNeeded(signal);
    // A byte snapshot makes Node fixtures and browser execution identical.
    // Its size is bounded independently of the legacy 40 MiB header limit.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    abortIfNeeded(signal);
    const output: unknown = await parse(bytes, {
      tiff: true, exif: true, gps: true, xmp: true, icc: true, iptc: true,
      ifd1: false, makerNote: false, userComment: false,
      mergeOutput: false, sanitize: true, translateValues: false,
      firstChunkSize: 65536, chunkSize: 65536, chunkLimit: 5,
    });
    abortIfNeeded(signal);
    const parsed = record(output);
    const ifd0 = record(parsed.ifd0);
    const exif = record(parsed.exif);
    const gps = record(parsed.gps);
    const icc = record(parsed.icc);
    const iptc = record(parsed.iptc);
    const xmp = record(parsed.xmp);
    const orientation = ifd0.Orientation;
    const latitude = validCoordinate(gps.latitude ?? parsed.latitude, 90);
    const longitude = validCoordinate(gps.longitude ?? parsed.longitude, 180);
    const gpsPosition = latitude !== undefined && longitude !== undefined
      ? { latitude, longitude } : undefined;
    const fields = {
      cameraMake: label(ifd0.Make),
      cameraModel: label(ifd0.Model),
      takenAt: shortDate(exif.DateTimeOriginal ?? exif.CreateDate ?? ifd0.ModifyDate),
      orientation: typeof orientation === "number" && Number.isInteger(orientation) && orientation >= 1 && orientation <= 8 ? orientation : undefined,
      iccProfile: label(icc.ProfileDescription ?? icc.profileDescription ?? icc.Description),
      iptcTitle: label(iptc.ObjectName ?? iptc.Headline ?? iptc.Caption),
      xmpTitle: label(xmp.title ?? xmp.Title ?? xmp["dc:title"]),
      gpsPresent: gpsPosition !== undefined || Object.keys(gps).length > 0,
      ...(gpsPosition === undefined ? {} : { gps: gpsPosition }),
    };
    const hasFields = Object.entries(fields).some(([key, value]) => key !== "gpsPresent" && value !== undefined)
      || fields.gpsPresent;
    const hadErrors = Array.isArray(parsed.errors) && parsed.errors.length > 0;
    return {
      metadataStatus: hadErrors ? "unavailable" : hasFields ? "read" : "absent",
      metadataNote: hadErrors
        ? "Alcuni tag non sono leggibili o sono corrotti; i campi mancanti non sono verificati."
        : hasFields ? "Campi riconosciuti da exifr; tag assenti o non riconosciuti non vengono dedotti."
          : "Nessun tag supportato leggibile; l'assenza di metadati non è certificata.",
      ...fields,
    };
  } catch (error) {
    abortIfNeeded(signal);
    return {
      metadataStatus: "unavailable",
      metadataNote: "Tag non leggibili o formato metadati non supportato; restano validi solo header e dimensioni.",
      gpsPresent: false,
    };
  }
}
