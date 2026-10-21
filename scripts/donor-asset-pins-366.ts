/** Parsing of the #366 checked-in asset register.
 *
 * Split from the auditor to keep each module inside the repository file
 * budget. A register without a well-formed, five-column pin block is refused.
 */
export type AssetPin366 = { path: string; sha256: string; license: string; version: string; source: string };

export function parseAssetPins366(document: string): AssetPin366[] {
  const match = document.match(/<!-- ASSET-PINS-366-BEGIN -->([\s\S]*?)<!-- ASSET-PINS-366-END -->/u);
  if (!match?.[1]?.trim()) throw new Error("MISSING_ASSET_PIN_REGISTER");
  return match[1].trim().split("\n").map((line) => {
    const parts = line.split("\t");
    if (parts.length !== 5) throw new Error(`INVALID_ASSET_PIN_LINE ${line}`);
    const [path = "", sha256 = "", license = "", version = "", source = ""] = parts;
    return { path, sha256, license, version, source };
  });
}
