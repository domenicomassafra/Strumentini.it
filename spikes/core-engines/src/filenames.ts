export interface RenamePlanEntry {
  from: string;
  to: string;
  changed: boolean;
}

const RESERVED_STEMS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu;
const FORBIDDEN = /[<>:"/\\|?*]/gu;
const NON_PRINTING = /[\p{Cc}\p{Cf}]/gu;

function splitExtension(name: string): { stem: string; extension: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { stem: name, extension: "" };
  return { stem: name.slice(0, dot), extension: name.slice(dot) };
}

export function sanitizeFilename(input: string): string {
  let name = input
    .replace(NON_PRINTING, "")
    .trim()
    .replace(FORBIDDEN, "_")
    .replace(/[ .]+$/gu, "");

  if (name.length === 0 || name === "." || name === "..") return "untitled";
  const parts = splitExtension(name);
  if (RESERVED_STEMS.test(parts.stem)) name = `_${name}`;

  const codePoints = Array.from(name);
  if (codePoints.length > 255) {
    name = codePoints.slice(0, 255).join("").replace(/[ .]+$/gu, "");
  }
  return name.length === 0 ? "untitled" : name;
}

function withSuffix(name: string, suffix: number): string {
  const { stem, extension } = splitExtension(name);
  return `${stem} (${suffix})${extension}`;
}

export function planSanitizedRenames(
  names: readonly string[],
): RenamePlanEntry[] {
  const used = new Set<string>();
  return names.map((from) => {
    const base = sanitizeFilename(from);
    let to = base;
    let suffix = 2;
    while (used.has(to.toLowerCase())) {
      to = withSuffix(base, suffix);
      suffix += 1;
    }
    used.add(to.toLowerCase());
    return { from, to, changed: from !== to };
  });
}
