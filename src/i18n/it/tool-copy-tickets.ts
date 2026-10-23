import type { ItalianToolCopy } from "./tool-copy";
import { STR421_TOOL_COPY_IT } from "./tool-copy-str421";
import { EPUB422_TOOL_COPY_IT } from "./tool-copy-epub-422";
import { STR418_TOOL_COPY_IT } from "./tool-copy-str418";
import { P7M176_TOOL_COPY_IT } from "./tool-copy-p7m-176";

/**
 * Ticket-scoped Italian copy modules, merged in one place so the historic
 * registry file keeps its size budget while each ticket keeps its own module.
 */
export const TICKET_TOOL_COPY_IT: Readonly<Record<string, ItalianToolCopy>> = {
  ...STR421_TOOL_COPY_IT,
  ...EPUB422_TOOL_COPY_IT,
  ...STR418_TOOL_COPY_IT,
  ...P7M176_TOOL_COPY_IT,
};
