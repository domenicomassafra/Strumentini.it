import { parseXmlDocument, type XmlElement } from "../developer-web/structured-repair";
import type { OoxmlZipEntry } from "../ooxml/package";

/** Structures that cannot survive the value-only XLSX editor. */
export function hasLossyWorksheetFeatures387(xml: string): boolean {
  return /<(?:[A-Za-z_][\w.-]*:)?(?:mergeCells|hyperlinks|conditionalFormatting|dataValidations|autoFilter|tableParts|sheetProtection|drawing|legacyDrawing|rowBreaks|colBreaks|cols)(?=[\s/>])/u.test(xml);
}

export function workbookWorksheetTarget387(target: string, refuse: (reason: string) => never): string {
  if (/[\\?#%]/u.test(target) || /^[A-Za-z][\w+.-]*:/u.test(target)) {
    refuse("Unsupported XLSX worksheet relationship target.");
  }
  const segments = target.startsWith("/") ? [] : ["xl"];
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) refuse("XLSX worksheet target escapes the package root.");
      segments.pop();
    } else segments.push(segment);
  }
  const path = segments.join("/");
  if (!/^xl\/.+\.xml$/iu.test(path)) refuse("Unsupported XLSX worksheet relationship path.");
  return path;
}

/** Refuse workbook features that a value-only editor would silently discard. */
export function refuseLossyWorkbook387(
  entries: readonly OoxmlZipEntry[],
  readXml: (entry: OoxmlZipEntry) => string,
  refuse: (reason: string) => never,
): void {
  if (entries.some(({ path }) => /^xl\/(?:drawings|charts|media|comments|tables|pivot|embeddings|vmlDrawings|ctrlProps)\//iu.test(path))) {
    refuse("Workbook contains charts, tables, comments or embedded objects the editor cannot preserve.");
  }
  const workbook = entries.find(({ path }) => path === "xl/workbook.xml");
  if (!workbook) refuse("Workbook metadata is missing.");
  let metadata: XmlElement;
  try {
    metadata = parseXmlDocument(readXml(workbook)).root;
  } catch {
    refuse("Workbook metadata cannot be inspected faithfully.");
  }
  if (metadata.name.split(":").at(-1) !== "workbook") refuse("Unsupported workbook metadata root.");
  if (metadata.children.some((node) => node.kind === "element" && node.name.split(":").at(-1) === "definedNames" &&
    node.children.some((child) => child.kind === "element"))) {
    refuse("Workbook defined names cannot be preserved by value-only editing.");
  }
  const styles = entries.find(({ path }) => path === "xl/styles.xml");
  if (!styles) return;
  let root: XmlElement;
  try {
    root = parseXmlDocument(readXml(styles)).root;
  } catch {
    refuse("Workbook styles cannot be inspected faithfully.");
  }
  if (root.name.split(":").at(-1) !== "styleSheet") refuse("Unsupported workbook styles root.");
  const children = (parent: XmlElement, name: string) =>
    parent.children.filter((node): node is XmlElement => node.kind === "element" && node.name.split(":").at(-1) === name);
  const attr = (node: XmlElement, name: string) => node.attributes.find((entry) => entry.name === name)?.value;
  const numberFormats = new Map<string, string>();
  for (const group of children(root, "numFmts")) {
    for (const fmt of children(group, "numFmt")) {
      const id = attr(fmt, "numFmtId");
      const code = attr(fmt, "formatCode");
      if (!id || code !== "yyyy-mm-dd") refuse("Custom number/date display formats cannot be preserved.");
      numberFormats.set(id, code);
    }
  }
  for (const [name, maximum] of [["fonts", 1], ["fills", 2], ["borders", 1]] as const) {
    for (const group of children(root, name)) {
      if (group.children.filter((node) => node.kind === "element").length > maximum) {
        refuse("Workbook visual styles cannot be preserved.");
      }
    }
  }
  for (const group of children(root, "cellXfs")) {
    for (const xf of children(group, "xf")) {
      const format = attr(xf, "numFmtId") ?? "0";
      if (format !== "0" && numberFormats.get(format) !== "yyyy-mm-dd") {
        refuse("Workbook numeric/date display formats cannot be preserved.");
      }
      if (attr(xf, "applyAlignment") === "1" || attr(xf, "applyProtection") === "1") {
        refuse("Workbook alignment/protection cannot be preserved.");
      }
    }
  }
}
