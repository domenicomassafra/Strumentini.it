import { z } from "zod";

export const FORMAT_OPERATION_STATES = ["IMPLEMENT", "SPIKE", "REFUSE"] as const;
export const FORMAT_OPERATION_PRIORITIES = ["high", "medium", "low"] as const;

export const formatOperationRowSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  source: z.string().min(1),
  operation: z.enum(["compress", "convert", "optimize", "extract", "render", "package"]),
  inputFormats: z.array(z.string().min(1)).min(1),
  outputFormats: z.array(z.string().min(1)).min(1),
  priority: z.enum(FORMAT_OPERATION_PRIORITIES),
  state: z.enum(FORMAT_OPERATION_STATES),
  fidelity: z.string().min(1),
  ticket: z.string().min(1).optional(),
  evidence: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
}).strict().superRefine((row, ctx) => {
  if (row.state === "REFUSE") {
    if (row.reason === undefined) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "REFUSE rows require a reason" });
    }
    return;
  }
  if (row.ticket === undefined && row.evidence === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["ticket"],
      message: `${row.state} rows require a ticket or evidence path`,
    });
  }
});

export type FormatOperationRow = z.infer<typeof formatOperationRowSchema>;

export interface FormatOperationRegistryReport {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly rows: readonly FormatOperationRow[];
}

export function validateFormatOperationRegistry(
  rawRows: readonly unknown[],
  requiredHighPriorityIds: readonly string[] = [],
): FormatOperationRegistryReport {
  const rows: FormatOperationRow[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();

  rawRows.forEach((raw, index) => {
    const parsed = formatOperationRowSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(`row[${index}]: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`).join("; ")}`);
      return;
    }
    if (seen.has(parsed.data.id)) issues.push(`duplicate format-operation id: ${parsed.data.id}`);
    seen.add(parsed.data.id);
    rows.push(parsed.data);
  });

  for (const id of requiredHighPriorityIds) {
    if (!seen.has(id)) issues.push(`missing high-priority format-operation row: ${id}`);
  }
  for (const row of rows) {
    if (row.priority === "high" && !requiredHighPriorityIds.includes(row.id) && requiredHighPriorityIds.length > 0) {
      issues.push(`untracked high-priority format-operation row: ${row.id}`);
    }
  }

  return { ok: issues.length === 0, issues, rows };
}

export const REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS = [
  "compress-jpeg",
  "compress-png-lossless",
  "compress-png-palette",
  "compress-webp",
  "compress-avif",
  "optimize-svg",
  "optimize-gif",
  "reduce-heic",
  "compress-image-batch",
  "compress-image-target-size",
  "compress-pdf-basic",
  "compress-pdf-images",
  "compress-pdf-scan",
  "compress-pdf-target-size",
  "compress-pdf-batch",
  "compress-zip",
  "compress-gzip",
  "inspect-7z-rar",
  "compress-docx",
  "compress-pptx",
  "compress-xlsx",
  "compress-audio",
  "compress-video",
  "convert-jpeg-png",
  "convert-jpeg-webp",
  "convert-jpeg-avif",
  "convert-png-jpeg",
  "convert-png-webp",
  "convert-png-avif",
  "convert-webp-jpeg",
  "convert-webp-png",
  "convert-webp-avif",
  "convert-avif-jpeg",
  "convert-avif-png",
  "convert-avif-webp",
  "convert-heic-jpeg",
  "convert-heic-png",
  "convert-heic-webp",
  "convert-heic-pdf",
  "convert-gif-static-raster",
  "convert-jpeg-pdf",
  "convert-png-pdf",
  "convert-webp-pdf",
  "convert-avif-pdf",
  "convert-pdf-jpeg",
  "convert-pdf-png",
  "convert-pdf-webp",
  "convert-svg-png",
  "convert-svg-jpeg",
  "convert-svg-webp",
  "convert-svg-pdf",
  "refuse-raster-svg-vectorization",
  "convert-docx-txt",
  "convert-docx-md",
  "convert-docx-html",
  "convert-docx-pdf",
  "convert-txt-docx",
  "convert-md-docx",
  "convert-html-docx",
  "convert-xlsx-csv",
  "convert-csv-xlsx",
  "convert-xlsx-pdf",
  "convert-pptx-pdf",
] as const;
