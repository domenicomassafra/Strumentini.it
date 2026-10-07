import { calculateItalianDocumentExpiry } from "../../engines/date-time/italian-document-expiry";
import type { ToolModule } from "../../runtime/types";
import { asRecord, ensureNotAborted, stringValue } from "../date-time/module-utils";
import type { ItalianDocumentExpiryToolInput, ItalianDocumentExpiryToolOutput } from "../date-time/types";

function validateInput(value: unknown): ItalianDocumentExpiryToolInput {
  const record = asRecord(value);
  const documentType = stringValue(record, "documentType");
  if (documentType !== "cie" && documentType !== "cie-temporary-fingerprint" && documentType !== "passport") {
    throw new Error("UNSUPPORTED_DOCUMENT_TYPE");
  }
  return {
    documentType,
    birthDate: stringValue(record, "birthDate"),
    issueDate: stringValue(record, "issueDate"),
  };
}

const module: ToolModule = {
  run(rawInput, _context, signal): ItalianDocumentExpiryToolOutput {
    ensureNotAborted(signal);
    return calculateItalianDocumentExpiry(validateInput(rawInput));
  },
};

export default module;
