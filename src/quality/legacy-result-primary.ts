export type LegacyPrimaryPathClass =
  | "raw-json-component"
  | "generic-json-primary"
  | "manual-result-panel";

export interface LegacyPrimaryFinding {
  readonly file: string;
  readonly line: number;
  readonly pathClass: LegacyPrimaryPathClass;
  readonly evidence: string;
}

const RESULT_PRE_CLASS = /<pre\b[^>]*class(?:Name)?=(?:"[^"]*(?:result-json|developer-result-json|result-code|text-result)[^"]*"|'[^']*(?:result-json|developer-result-json|result-code|text-result)[^']*')/u;
const MANUAL_RESULT_PANEL = /<section\b[^>]*class(?:Name)?=(?:"[^"]*\bresult-panel\b[^"]*"|'[^']*\bresult-panel\b[^']*')/gu;
const JSON_RESULT = /<JsonResult\b/gu;

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function evidenceAt(source: string, index: number): string {
  const start = source.lastIndexOf("\n", index) + 1;
  const endIndex = source.indexOf("\n", index);
  const end = endIndex < 0 ? source.length : endIndex;
  return source.slice(start, end).trim().replace(/\s+/gu, " ").slice(0, 240);
}

function secondaryRawContext(source: string, index: number): boolean {
  const start = Math.max(0, index - 500);
  const end = Math.min(source.length, index + 500);
  return source.slice(start, end).includes("data-result-secondary-raw");
}

function pushRegexFindings(
  findings: LegacyPrimaryFinding[],
  file: string,
  source: string,
  pattern: RegExp,
  pathClass: LegacyPrimaryPathClass,
): void {
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index;
    if (index === undefined || secondaryRawContext(source, index)) continue;
    findings.push({
      file,
      line: lineAt(source, index),
      pathClass,
      evidence: evidenceAt(source, index),
    });
  }
}

export function auditLegacyPrimaryOutputSource(
  file: string,
  source: string,
): readonly LegacyPrimaryFinding[] {
  const findings: LegacyPrimaryFinding[] = [];

  pushRegexFindings(findings, file, source, JSON_RESULT, "raw-json-component");
  pushRegexFindings(findings, file, source, MANUAL_RESULT_PANEL, "manual-result-panel");

  if (RESULT_PRE_CLASS.test(source) && source.includes("JSON.stringify(")) {
    const pattern = /JSON\.stringify\s*\(/gu;
    for (const match of source.matchAll(pattern)) {
      const index = match.index;
      if (index === undefined || secondaryRawContext(source, index)) continue;
      const before = source.slice(Math.max(0, index - 180), index);
      if (/key\s*=\s*\{\s*$/u.test(before)) continue;
      findings.push({
        file,
        line: lineAt(source, index),
        pathClass: "generic-json-primary",
        evidence: evidenceAt(source, index),
      });
    }
  }

  return findings.toSorted((left, right) =>
    left.file.localeCompare(right.file)
    || left.line - right.line
    || left.pathClass.localeCompare(right.pathClass));
}

export function assertNoLegacyPrimaryOutputs(findings: readonly LegacyPrimaryFinding[]): void {
  if (findings.length === 0) return;
  throw new Error(
    "Legacy primary-result fallback(s) remain:\n"
    + findings.map((finding) =>
      finding.file + ":" + String(finding.line) + " [" + finding.pathClass + "] " + finding.evidence,
    ).join("\n"),
  );
}
