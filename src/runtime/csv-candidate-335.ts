/**
 * CSV has no binary magic signature. Accept only a complete, small UTF-8
 * RFC4180-shaped document as a *candidate*, never as a trusted parsed input.
 * No private cells, names or content are returned or persisted.
 */
export function isBoundedCsvCandidate335(bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0 || bytes.byteLength > 256 * 1024) return false;
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return false; }
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  if (!source || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source)) return false;

  let quoted = false;
  let afterQuote = false;
  let fieldStart = true;
  let fieldLength = 0;
  let columns = 0;
  let width = 0;
  let rows = 0;
  let headerHasText = false;
  let lastWasRowEnd = false;
  const endField = (): boolean => {
    if (++columns > 200 || fieldLength > 4096) return false;
    fieldLength = 0;
    fieldStart = true;
    afterQuote = false;
    return true;
  };
  const endRow = (): boolean => {
    if (!endField()) return false;
    if (rows === 0) {
      width = columns;
      if (width < 2 || !headerHasText) return false;
    } else if (columns !== width) return false;
    rows++;
    columns = 0;
    return rows <= 1001;
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    lastWasRowEnd = false;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { i++; fieldLength++; }
        else { quoted = false; afterQuote = true; }
      } else fieldLength++;
    } else if (char === ",") {
      if (!endField()) return false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      if (!endRow()) return false;
      lastWasRowEnd = true;
    } else if (char === '"') {
      if (!fieldStart || afterQuote) return false;
      quoted = true;
      fieldStart = false;
    } else {
      if (afterQuote) return false;
      fieldLength++;
      fieldStart = false;
    }
    if (rows === 0 && (quoted || (!afterQuote && char !== "," && char !== "\r" && char !== "\n"))) headerHasText = true;
    if (fieldLength > 4096) return false;
  }
  if (quoted || (!lastWasRowEnd && !endRow())) return false;
  return rows >= 2;
}
