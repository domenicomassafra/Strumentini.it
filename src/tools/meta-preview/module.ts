import { previewMeta } from "../../engines/url-marketing";
import type { ToolModule } from "../../runtime/types";

const module: ToolModule = {
  run(value, _context, signal): unknown {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
    const record = value as Record<string, unknown>;
    const title = record.title ?? record.metaTitle;
    const description = record.description ?? record.metaDescription;
    if (typeof title !== "string" || typeof description !== "string") throw new Error("INVALID_INPUT");
    const titleLimit = record.titleLimit;
    const descriptionLimit = record.descriptionLimit;
    if (titleLimit !== undefined && (typeof titleLimit !== "number" || !Number.isInteger(titleLimit) || titleLimit < 1)) throw new Error("INVALID_META_LIMIT");
    if (descriptionLimit !== undefined && (typeof descriptionLimit !== "number" || !Number.isInteger(descriptionLimit) || descriptionLimit < 1)) throw new Error("INVALID_META_LIMIT");
    return previewMeta(title, description, {
      ...(titleLimit === undefined ? {} : { title: titleLimit }),
      ...(descriptionLimit === undefined ? {} : { description: descriptionLimit }),
    });
  },
};

export default module;
