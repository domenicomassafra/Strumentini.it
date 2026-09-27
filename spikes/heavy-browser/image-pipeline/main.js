import picaFactory from "pica";
import imageCompression from "browser-image-compression";
import * as exifr from "exifr";
import piexif from "piexifjs";
import encodeAvif from "@jsquash/avif/encode.js";
import { assert, fail, finish, heapUsed, now } from "../shared/harness.js";

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`Canvas could not encode ${type}`)), type, quality);
  });
}

function bytesToBinary(bytes) {
  let result = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return result;
}

async function makeSyntheticCanvas(width = 1600, height = 1200) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(0.5, "#4f46e5");
  gradient.addColorStop(1, "#f59e0b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 180; i += 1) {
    ctx.fillStyle = `rgba(${(i * 37) % 255}, ${(i * 53) % 255}, ${(i * 71) % 255}, 0.35)`;
    ctx.fillRect((i * 97) % width, (i * 61) % height, 120 + (i % 5) * 18, 80 + (i % 7) * 14);
  }
  ctx.fillStyle = "white";
  ctx.font = "bold 64px sans-serif";
  ctx.fillText("STRUMENTIUTILI SYNTHETIC", 80, 140);
  return canvas;
}

async function addSyntheticExif(jpegBlob) {
  const bytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const binary = bytesToBinary(bytes);
  const zeroth = {};
  zeroth[piexif.ImageIFD.Artist] = "StrumentiUtili.it Synthetic Fixture";
  zeroth[piexif.ImageIFD.ImageDescription] = "Synthetic EXIF for local browser spike";
  const exif = {};
  exif[piexif.ExifIFD.UserComment] = "ASCII\0\0\0StrumentiUtili.it-Lane-04";
  const exifBytes = piexif.dump({ "0th": zeroth, Exif: exif });
  const inserted = piexif.insert(exifBytes, `data:image/jpeg;base64,${btoa(binary)}`);
  const base64 = inserted.split(",")[1];
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return new Blob([out], { type: "image/jpeg" });
}

async function run() {
  const pica = picaFactory();
  const heapBefore = heapUsed();
  const fixtureStart = now();
  const sourceCanvas = await makeSyntheticCanvas();
  const sourceJpeg = await canvasToBlob(sourceCanvas, "image/jpeg", 0.92);
  const taggedJpeg = await addSyntheticExif(sourceJpeg);
  const fixtureMs = now() - fixtureStart;

  const exifBefore = await exifr.parse(taggedJpeg, ["Artist", "ImageDescription"]);
  assert(exifBefore?.Artist === "StrumentiUtili.it Synthetic Fixture", "synthetic EXIF artist is readable");

  const resizeStart = now();
  const bitmap = await createImageBitmap(taggedJpeg);
  const cropped = document.createElement("canvas");
  cropped.width = 800;
  cropped.height = 800;
  cropped.getContext("2d").drawImage(bitmap, 200, 0, 1200, 1200, 0, 0, 800, 800);
  const resized = document.createElement("canvas");
  resized.width = 400;
  resized.height = 400;
  await pica.resize(cropped, resized, { quality: 3 });
  const resizeMs = now() - resizeStart;

  const encodeStart = now();
  const jpegOut = await canvasToBlob(resized, "image/jpeg", 0.78);
  const webpOut = await canvasToBlob(resized, "image/webp", 0.78);
  const canvasAvifAttempt = await canvasToBlob(resized, "image/avif", 0.7).catch(() => null);
  const canvasAvifNative = canvasAvifAttempt?.type === "image/avif";
  const imageData = resized.getContext("2d").getImageData(0, 0, resized.width, resized.height);
  const avifBytes = await encodeAvif(imageData, { cqLevel: 32, speed: 8 });
  const encodeMs = now() - encodeStart;

  const compressionStart = now();
  const browserCompressed = await imageCompression(taggedJpeg, { maxWidthOrHeight: 800, maxSizeMB: 0.5, useWebWorker: true, fileType: "image/jpeg" });
  const compressionMs = now() - compressionStart;

  const scrubbed = await canvasToBlob(sourceCanvas, "image/jpeg", 0.92);
  const exifAfter = await exifr.parse(scrubbed, ["Artist", "ImageDescription"]);
  assert(!exifAfter?.Artist, "canvas re-encode strips synthetic Artist EXIF");
  assert(jpegOut.type === "image/jpeg", "JPEG conversion succeeds");
  assert(webpOut.type === "image/webp", "WebP conversion succeeds");
  assert(avifBytes.byteLength > 0, "WASM AVIF encoder produces bytes");

  const preview = document.querySelector("#preview");
  preview.getContext("2d").drawImage(resized, 0, 0, preview.width, preview.height);
  bitmap.close();

  const heapAfter = heapUsed();
  finish({
    ok: true,
    capability: "image",
    libraries: { pica: "10.0.3", "browser-image-compression": "2.0.2", exifr: "7.1.3", piexifjs: "1.0.6 fixture-only", "@jsquash/avif": "2.1.1" },
    dimensions: { source: [1600, 1200], crop: [800, 800], output: [400, 400] },
    bytes: { sourceJpeg: sourceJpeg.size, taggedJpeg: taggedJpeg.size, jpeg: jpegOut.size, webp: webpOut.size, wasmAvif: avifBytes.byteLength, nativeAvifAttempt: canvasAvifAttempt?.size ?? null, browserImageCompression: browserCompressed.size },
    timingsMs: { fixture: fixtureMs, cropAndPicaResize: resizeMs, jpegWebpAvifEncode: encodeMs, browserImageCompressionWorker: compressionMs },
    heap: { before: heapBefore, after: heapAfter, delta: heapBefore != null && heapAfter != null ? heapAfter - heapBefore : null },
    formats: { jpeg: jpegOut.type, webp: webpOut.type, nativeAvif: canvasAvifNative, wasmAvif: "image/avif" },
    exif: { before: exifBefore, afterReencode: exifAfter ?? null, note: "Canvas decode/re-encode strips parsed EXIF in this fixture; this does not prove removal of every metadata carrier." },
  });
}

run().catch(fail);
