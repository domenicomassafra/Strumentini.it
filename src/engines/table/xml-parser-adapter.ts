import { XMLParser } from "fast-xml-parser";
import type { XmlAttribute, XmlElement, XmlNode } from "../developer-web/structured-repair";

// The strict local parser validates the input before this adapter is called.
// Preserve-order mode retains repeated fields, text/CDATA boundaries and the
// original qualified names, unlike fast-xml-parser's compact object mode.
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: false,
  processEntities: false,
  htmlEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  cdataPropName: "#cdata",
  commentPropName: "#comment",
  ignoreDeclaration: false,
  ignorePiTags: false,
});

function mismatch(message: string): never {
  throw new Error(`fast-xml-parser could not represent ${message} without loss.`);
}

function record(value: unknown, description: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) mismatch(description);
  return value as Record<string, unknown>;
}

function textNode(value: unknown, description: string): string {
  if (typeof value !== "string") mismatch(description);
  return value;
}

function nestedText(value: unknown, description: string): string {
  if (!Array.isArray(value) || value.length !== 1) mismatch(description);
  const node = record(value[0], description);
  if (Object.keys(node).length !== 1 || !("#text" in node)) mismatch(description);
  return textNode(node["#text"], description);
}

function parseNodes(value: unknown, parent: string): XmlNode[] {
  if (!Array.isArray(value)) mismatch(`children of ${parent}`);
  return value.map((entry: unknown): XmlNode => {
    const node = record(entry, `child of ${parent}`);
    const keys = Object.keys(node).filter((key) => key !== ":@");
    if (keys.length !== 1) mismatch(`child keys of ${parent}`);
    const name = keys[0]!;
    const content = node[name];
    if (name === "#text") return { kind: "text", value: textNode(content, `text of ${parent}`) };
    if (name === "#cdata") return { kind: "cdata", value: nestedText(content, `CDATA of ${parent}`) };
    if (name === "#comment") return { kind: "comment", value: nestedText(content, `comment of ${parent}`) };
    if (name.startsWith("?")) return { kind: "pi", target: name.slice(1), body: "" };
    if (name.startsWith("#") || name.startsWith("!")) mismatch(`node ${name} of ${parent}`);

    const attributes: XmlAttribute[] = [];
    if (":@" in node) {
      for (const [attributeName, attributeValue] of Object.entries(record(node[":@"], `attributes of ${name}`))) {
        attributes.push({ name: attributeName, value: textNode(attributeValue, `attribute ${attributeName}`), quote: '"' });
      }
    }
    return { kind: "element", name, attributes, children: parseNodes(content, `${parent}/${name}`) };
  });
}

function equivalentNode(actual: XmlNode, expected: XmlNode): boolean {
  if (actual.kind !== expected.kind) return false;
  if (actual.kind === "element" && expected.kind === "element") {
    return actual.name === expected.name
      && actual.attributes.length === expected.attributes.length
      && actual.attributes.every((attribute, index) => attribute.name === expected.attributes[index]?.name
        && attribute.value === expected.attributes[index]?.value)
      && actual.children.length === expected.children.length
      && actual.children.every((child, index) => equivalentNode(child, expected.children[index]!));
  }
  if (actual.kind === "pi" && expected.kind === "pi") return actual.target === expected.target;
  return "value" in actual && "value" in expected && actual.value === expected.value;
}

// A QName must have its prefix declared in scope. The restrictive XML 1.0
// tokenizer accepts arbitrary colons as names; interchange cannot assign
// meaningful names to undeclared or malformed namespace prefixes.
export function unexpectedXmlNamespace(root: XmlElement): string | undefined {
  function walk(element: XmlElement, parent: ReadonlySet<string>, path: string): string | undefined {
    const declared = new Set(parent);
    for (const attribute of element.attributes) {
      if (attribute.name.startsWith("xmlns:") && attribute.name.slice(6) !== "") declared.add(attribute.name.slice(6));
    }
    function check(name: string): string | undefined {
      if (name === "xmlns" || name.startsWith("xmlns:")) return undefined;
      const parts = name.split(":");
      if (parts.length === 1) return undefined;
      if (parts.length !== 2 || parts.some((part) => part === "") || parts[0] === "xmlns" || !declared.has(parts[0]!)) {
        return `${path} contains unexpected or undeclared XML qualified name ${name}`;
      }
      return undefined;
    }
    const invalid = check(element.name) ?? element.attributes.map(({ name }) => check(name)).find((value) => value !== undefined);
    if (invalid !== undefined) return invalid;
    for (const child of element.children) {
      if (child.kind !== "element") continue;
      const reason = walk(child, declared, `${path}/${child.name}`);
      if (reason !== undefined) return reason;
    }
    return undefined;
  }
  return walk(root, new Set(["xml"]), `/${root.name}`);
}

export function parseTabularXmlRoot(input: string, validatedRoot: XmlElement): XmlElement {
  // Donor XML normalization (e.g. CRLF) and reserved-name refusals must never
  // silently alter a previously accepted document. Fallback is lossless because
  // validatedRoot has already passed the restrictive parser and its bounds.
  try {
    const nodes = parseNodes(parser.parse(input) as unknown, "document");
    const roots = nodes.filter((node): node is XmlElement => node.kind === "element");
    if (roots.length === 1 && equivalentNode(roots[0]!, validatedRoot)) return roots[0]!;
  } catch {
    // Reserved JS property names are valid XML names but rejected by the donor.
  }
  return validatedRoot;
}
