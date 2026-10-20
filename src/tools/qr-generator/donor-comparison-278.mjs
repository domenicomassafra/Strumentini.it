/*
 * Independent differential check for #278 / #339. Invocation:
 * node --import tsx src/tools/qr-generator/donor-comparison-278.mjs
 *
 * The donor is qrcode@1.5.4, pinned in spikes/heavy-browser/package-lock.json.
 * Install that spike's dependencies before running; it is not a production import.
 */
import { createRequire } from "node:module";
import { generateQr } from "../../engines/qr/encode.ts";

const requireDonor = createRequire(new URL("../../../spikes/heavy-browser/package.json", import.meta.url));
const QRCode = requireDonor("qrcode");

const corpus = [
  "https://strumentini.it",
  "https://strumentini.it/tools/qr-generator",
  "WIFI:T:WPA;S:Caffè;P:locale;;",
  "Città però più così — perché",
  "QR ✅ locale 🚀",
  "12345678901234567890",
  "HELLO WORLD 123",
  ...[17, 18, 32, 33, 53, 54, 78].map((length) => "x".repeat(length)),
  "https://strumentini.it/?utm_source=qr",
  "ciao",
  "WIFI:T:nopass;S:Rete aperta;;",
  "MECARD:N:Rossi,Mario;TEL:+39123456789;;",
  "€ 12,34",
  "日本語 QR",
  "https://esempio.it/percorso?a=1&b=2",
];

function donorRows(qr) {
  return Array.from({ length: qr.modules.size }, (_, y) =>
    Array.from({ length: qr.modules.size }, (_, x) => qr.modules.get(y, x) ? "1" : "0").join(""));
}

let maskEqualWithIsoRule3 = 0;
let forcedMaskMatricesIdentical = 0;
const differences = [];

for (const payload of corpus) {
  const local = generateQr(payload);
  const segment = [{ data: new TextEncoder().encode(payload), mode: "byte" }];
  const options = { version: local.version, errorCorrectionLevel: "L" };
  const donor = QRCode.create(segment, options);
  if (donor.maskPattern === local.mask && JSON.stringify(donorRows(donor)) === JSON.stringify(local.matrixRows)) {
    maskEqualWithIsoRule3 += 1;
  } else {
    differences.push({ payload, localMask: local.mask, donorMask: donor.maskPattern });
  }
  for (let mask = 0; mask < 8; mask += 1) {
    const manual = generateQr(payload, { mask });
    const reference = QRCode.create(segment, { ...options, maskPattern: mask });
    if (JSON.stringify(manual.matrixRows) === JSON.stringify(donorRows(reference))) forcedMaskMatricesIdentical += 1;
  }
}

const report = {
  cases: corpus.length,
  maskEqualWithIsoRule3,
  forcedMaskComparisons: corpus.length * 8,
  forcedMaskMatricesIdentical,
  donor: "qrcode@1.5.4 (dev-only, pinned in spikes/heavy-browser)",
  differences,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (maskEqualWithIsoRule3 !== report.cases || forcedMaskMatricesIdentical !== report.forcedMaskComparisons) process.exitCode = 1;
