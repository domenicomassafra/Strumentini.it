import type { ToolModule } from "../../runtime/types";
import { VCF_MAX_BYTES } from "./limits";

export { VCF_MAX_BYTES } from "./limits";
export const VCF_MAX_CONTACTS = 1000;
const VCF_MAX_PROPERTIES_PER_CONTACT = 256;
const VCF_MAX_UNFOLDED_LINE = 16_384;

export interface VCardValue {
  readonly value: string;
  readonly types: readonly string[];
  readonly raw: string;
}

export interface VCardUnsupportedProperty {
  readonly name: string;
  readonly raw: string;
}

export interface VCardContact {
  readonly index: number;
  readonly version: string | null;
  readonly fullName: string;
  readonly familyName: string;
  readonly givenName: string;
  readonly phones: readonly VCardValue[];
  readonly emails: readonly VCardValue[];
  readonly organizations: readonly string[];
  readonly titles: readonly string[];
  readonly notes: readonly string[];
  readonly addresses: readonly string[];
  readonly unsupported: readonly VCardUnsupportedProperty[];
  readonly rawSource: string;
}

export interface VCardParseResult {
  readonly contacts: readonly VCardContact[];
  readonly csv: string;
  readonly warnings: readonly string[];
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/giu, "\n")
    .replace(/\\,/gu, ",")
    .replace(/\\;/gu, ";")
    .replace(/\\\\/gu, "\\");
}

function splitStructured(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += `\\${char}`;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === ";") {
      parts.push(unescapeText(current));
      current = "";
    } else current += char;
  }
  if (escaped) current += "\\";
  parts.push(unescapeText(current));
  return parts;
}

function unfoldLines(text: string): readonly { readonly unfolded: string; readonly raw: string }[] {
  const physical = text.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n").split("\n");
  const lines: Array<{ unfolded: string; raw: string }> = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      const previous = lines[lines.length - 1];
      if (previous === undefined) continue;
      const unfolded = previous.unfolded + line.slice(1);
      if (unfolded.length > VCF_MAX_UNFOLDED_LINE) throw new Error("VCF_LINE_TOO_LONG");
      lines[lines.length - 1] = { unfolded, raw: `${previous.raw}\n${line}` };
    } else {
      if (line.length > VCF_MAX_UNFOLDED_LINE) throw new Error("VCF_LINE_TOO_LONG");
      lines.push({ unfolded: line, raw: line });
    }
  }
  return lines;
}

function propertyParts(line: string): { name: string; params: readonly string[]; value: string } | null {
  let colon = -1;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    if (escaped) escaped = false;
    else if (char === "\\") escaped = true;
    else if (char === ":") { colon = index; break; }
  }
  if (colon <= 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = head.split(";");
  const rawName = segments.shift() ?? "";
  const name = (rawName.includes(".") ? rawName.slice(rawName.lastIndexOf(".") + 1) : rawName).toUpperCase();
  return { name, params: segments, value };
}

function typesFromParams(params: readonly string[]): string[] {
  const types: string[] = [];
  for (const param of params) {
    const [rawKey, ...rest] = param.split("=");
    if ((rawKey ?? "").toUpperCase() !== "TYPE") continue;
    for (const value of rest.join("=").split(",")) {
      const normalized = value.replace(/^"|"$/gu, "").trim();
      if (normalized !== "") types.push(normalized);
    }
  }
  return types;
}

function unsupportedEncoding(params: readonly string[]): boolean {
  return params.some((param) => /^ENCODING=(?:B|BASE64|QUOTED-PRINTABLE)$/iu.test(param));
}

function csvSafe(value: string): string {
  const protectedValue = /^[\t\r\n ]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function contactsToCsv(contacts: readonly VCardContact[]): string {
  const header = ["contact_index", "full_name", "family_name", "given_name", "phones", "emails", "organizations", "titles", "notes", "addresses"];
  const rows = contacts.map((contact) => [
    String(contact.index), contact.fullName, contact.familyName, contact.givenName,
    contact.phones.map((item) => item.value).join(" | "),
    contact.emails.map((item) => item.value).join(" | "),
    contact.organizations.join(" | "), contact.titles.join(" | "), contact.notes.join(" | "), contact.addresses.join(" | "),
  ]);
  return [header, ...rows].map((row) => row.map(csvSafe).join(",")).join("\r\n") + "\r\n";
}

export function parseVCard(text: string): VCardParseResult {
  if (typeof text !== "string" || text.trim() === "") throw new Error("VCF_INPUT_REQUIRED");
  if (new TextEncoder().encode(text).length > VCF_MAX_BYTES) throw new Error("VCF_TOO_LARGE");
  const lines = unfoldLines(text);
  const contacts: VCardContact[] = [];
  let current: typeof lines[number][] | null = null;
  for (const line of lines) {
    if (line.unfolded.toUpperCase() === "BEGIN:VCARD") {
      if (current !== null) throw new Error("VCF_NESTED_CARD");
      current = [line];
      continue;
    }
    if (current === null) {
      if (line.unfolded.trim() !== "") throw new Error("VCF_CONTENT_OUTSIDE_CARD");
      continue;
    }
    current.push(line);
    if (line.unfolded.toUpperCase() !== "END:VCARD") continue;
    if (contacts.length >= VCF_MAX_CONTACTS) throw new Error("VCF_TOO_MANY_CONTACTS");
    const body = current.slice(1, -1);
    if (body.length > VCF_MAX_PROPERTIES_PER_CONTACT) throw new Error("VCF_TOO_MANY_PROPERTIES");
    let version: string | null = null;
    let fullName = "";
    let familyName = "";
    let givenName = "";
    const phones: VCardValue[] = [];
    const emails: VCardValue[] = [];
    const organizations: string[] = [];
    const titles: string[] = [];
    const notes: string[] = [];
    const addresses: string[] = [];
    const unsupported: VCardUnsupportedProperty[] = [];
    for (const source of body) {
      const parsed = propertyParts(source.unfolded);
      if (parsed === null) { unsupported.push({ name: "MALFORMED", raw: source.raw }); continue; }
      if (unsupportedEncoding(parsed.params)) { unsupported.push({ name: parsed.name, raw: source.raw }); continue; }
      const value = unescapeText(parsed.value);
      if (parsed.name === "VERSION") version = value;
      else if (parsed.name === "FN") fullName = value;
      else if (parsed.name === "N") {
        const fields = splitStructured(parsed.value);
        familyName = fields[0] ?? "";
        givenName = fields[1] ?? "";
      } else if (parsed.name === "TEL") phones.push({ value, types: typesFromParams(parsed.params), raw: source.raw });
      else if (parsed.name === "EMAIL") emails.push({ value, types: typesFromParams(parsed.params), raw: source.raw });
      else if (parsed.name === "ORG") organizations.push(...splitStructured(parsed.value).filter(Boolean));
      else if (parsed.name === "TITLE") titles.push(value);
      else if (parsed.name === "NOTE") notes.push(value);
      else if (parsed.name === "ADR") addresses.push(splitStructured(parsed.value).filter(Boolean).join(", "));
      else if (!new Set(["BEGIN", "END", "PRODID", "REV", "UID", "KIND"]).has(parsed.name)) unsupported.push({ name: parsed.name, raw: source.raw });
    }
    const rawSource = current.map((item) => item.raw).join("\n");
    contacts.push({ index: contacts.length + 1, version, fullName, familyName, givenName, phones, emails, organizations, titles, notes, addresses, unsupported, rawSource });
    current = null;
  }
  if (current !== null) throw new Error("VCF_UNTERMINATED_CARD");
  if (contacts.length === 0) throw new Error("VCF_NO_CARDS");
  const warnings = contacts.flatMap((contact) => contact.unsupported.length === 0 ? [] : [`Contatto ${contact.index}: ${contact.unsupported.length} proprietà non supportate conservate come raw.`]);
  return { contacts, csv: contactsToCsv(contacts), warnings };
}

const module: ToolModule = {
  run(input) {
    if (typeof input !== "object" || input === null || typeof (input as { text?: unknown }).text !== "string") throw new Error("VCF_INPUT_REQUIRED");
    return parseVCard((input as { text: string }).text);
  },
};

export default module;
