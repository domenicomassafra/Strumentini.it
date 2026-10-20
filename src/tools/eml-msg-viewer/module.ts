import PostalMime from "postal-mime";
import MsgReader from "@kenjiuno/msgreader";
import type { ToolModule } from "../../runtime/types";

export const EMAIL_MAX_BYTES = 12 * 1024 * 1024;
export const ATTACHMENT_MAX_BYTES = 6 * 1024 * 1024;
const MAX_ATTACHMENTS = 40;
const MAX_TEXT = 250_000;
const OLE = [208, 207, 17, 224, 161, 177, 26, 225];
const ACTIVE = /\.(?:exe|com|bat|cmd|ps1|vbs|vbe|wsf|wsh|js|jse|mjs|cjs|jar|hta|htm|html|svg|xhtml|msi|scr|pif|lnk|url|reg|sh|app|apk|dmg|iso|dll|so|py|rb|php|docm|xlsm|pptm|xlam|xll|one)$/iu;

export interface MailAttachment {
  name: string;
  size: number;
  type: string;
  blocked: boolean;
  reason: string | null;
  bytes: Uint8Array | null;
}
export interface MailPreview {
  format: "EML" | "MSG";
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  htmlAsText: boolean;
  attachments: MailAttachment[];
  notices: string[];
}
const bounded = (value: unknown): string => typeof value === "string" ? value.slice(0, MAX_TEXT) : "";

export function safeAttachmentName(input: string | null | undefined, index: number): string {
  const base = (input ?? "").split(/[\\/]/u).at(-1) ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, "")
    .replace(/[<>:"|?*]/gu, "_").replace(/^\.+/u, "").trim().slice(0, 100);
  return clean === "" ? "allegato-" + (index + 1) : clean;
}
function fileAttachment(input: string | null | undefined, content: ArrayBuffer | Uint8Array | string, type: string, index: number): MailAttachment {
  const name = safeAttachmentName(input, index);
  const bytes = content instanceof ArrayBuffer ? new Uint8Array(content) : content instanceof Uint8Array ? content : null;
  const size = bytes?.byteLength ?? 0;
  const reason = bytes === null ? "Codifica non supportata" :
    size > ATTACHMENT_MAX_BYTES ? "Dimensione eccessiva" :
    ACTIVE.test(name) ? "Tipo attivo o eseguibile" : null;
  return { name, size, type, blocked: reason !== null, reason, bytes: reason ? null : bytes };
}
function validateEml(bytes: Uint8Array): void {
  const text = new TextDecoder("windows-1252").decode(bytes);
  const divider = /\r?\n\r?\n/u.exec(text);
  if (!divider || divider.index > 65_536 || !/^[a-z][a-z0-9-]*:[^\r\n]*/imu.test(text.slice(0, divider.index))) {
    throw new Error("EMAIL_MIME_MALFORMED");
  }
  const multipart = [...text.matchAll(/^content-type:\s*multipart\/[\w.-]+;[^\r\n]*(?:\r?\n[ \t]+[^\r\n]*)*/gimu)];
  for (const match of multipart) {
    const boundary = /boundary\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/iu.exec(match[0]);
    if (!boundary) throw new Error("EMAIL_MIME_MALFORMED");
    const marker = "--" + (boundary[1] ?? boundary[2] ?? boundary[3]);
    if (!text.includes(marker) || !text.includes(marker + "--")) throw new Error("EMAIL_MIME_MALFORMED");
  }
}
function emailAddress(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if ("group" in value && Array.isArray(value.group)) return value.group.map(emailAddress).join(", ");
  return "address" in value && typeof value.address === "string" ? value.address : "";
}
function finish(value: MailPreview): MailPreview {
  if (value.attachments.length > MAX_ATTACHMENTS) throw new Error("EMAIL_TOO_MANY_ATTACHMENTS");
  return value;
}

/** No HTML from either decoder may be injected into the DOM. */
export async function readLocalEmail(bytes: Uint8Array, filename: string, signal?: AbortSignal): Promise<MailPreview> {
  if (signal?.aborted) throw new DOMException("Annullato", "AbortError");
  if (bytes.length === 0 || bytes.length > EMAIL_MAX_BYTES) throw new Error("EMAIL_SIZE_UNSUPPORTED");
  const name = filename.toLowerCase();
  if (name.endsWith(".msg")) {
    if (!OLE.every((byte, i) => bytes[i] === byte)) throw new Error("EMAIL_MSG_MALFORMED");
    try {
      const Reader = (MsgReader as unknown as { default?: typeof MsgReader }).default ?? MsgReader;
      const reader = new Reader(bytes.slice().buffer as ArrayBuffer);
      const mail = reader.getFileData();
      if (mail.error || mail.dataType !== "msg") throw new Error("EMAIL_MSG_MALFORMED");
      const attachments: MailAttachment[] = (mail.attachments ?? []).map((row, i) => {
        if (row.innerMsgContent) return { name: safeAttachmentName(row.fileName, i), size: row.contentLength ?? 0,
          type: "message/rfc822", blocked: true, reason: "MSG incorporato", bytes: null };
        const item = reader.getAttachment(row);
        return fileAttachment(item.fileName || row.fileName, item.content, "application/octet-stream", i);
      });
      if (signal?.aborted) throw new DOMException("Annullato", "AbortError");
      return finish({ format: "MSG", subject: bounded(mail.subject), from: bounded(mail.senderEmail || mail.senderName),
        to: bounded((mail.recipients ?? []).filter(row => row.recipType === "to").map(row => row.email ?? row.name ?? "").join(", ")), date: bounded(mail.messageDeliveryTime),
        body: bounded(mail.body || mail.bodyHtml), htmlAsText: !mail.body && !!mail.bodyHtml,
        attachments, notices: ["HTML mostrato solo come testo. Nessuna risorsa remota caricata."] });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new Error("EMAIL_MSG_MALFORMED");
    }
  }
  if (!name.endsWith(".eml")) throw new Error("EMAIL_FORMAT_UNSUPPORTED");
  validateEml(bytes);
  try {
    const mail = await PostalMime.parse(bytes, { attachmentEncoding: "arraybuffer", maxNestingDepth: 12,
      maxRfc822NestingDepth: 5, maxHeadersSize: 128 * 1024, maxPartCount: 100 });
    if (signal?.aborted) throw new DOMException("Annullato", "AbortError");
    const attachments = mail.attachments.map((item, i) => fileAttachment(item.filename, item.content, item.mimeType, i));
    return finish({ format: "EML", subject: bounded(mail.subject), from: emailAddress(mail.from),
      to: (mail.to ?? []).map(emailAddress).join(", "), date: bounded(mail.date),
      body: bounded(mail.text || mail.html), htmlAsText: !mail.text && !!mail.html,
      attachments, notices: ["HTML mostrato solo come testo. Tracker e script non caricati."] });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("EMAIL_MIME_MALFORMED");
  }
}
const module: ToolModule = {
  async run(raw, _context, signal) {
    if (!raw || typeof raw !== "object" || !("bytes" in raw) || !("filename" in raw)) throw new Error("EMAIL_INVALID_INPUT");
    const input = raw as { bytes: unknown; filename: unknown };
    if (!(input.bytes instanceof Uint8Array) || typeof input.filename !== "string") throw new Error("EMAIL_INVALID_INPUT");
    return readLocalEmail(input.bytes, input.filename, signal);
  },
};
export default module;
