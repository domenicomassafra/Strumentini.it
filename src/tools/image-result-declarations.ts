import type { ResultDeclaration } from "../catalog/manifest";

/**
 * Ticket 97 semantic result contracts for the image/image-visual routes.
 *
 * Image-producing operations use the image workspace contract. Pure inspection,
 * planning and color/dimension calculations remain calculator results, while
 * comparison/contrast tools are validators. Presentation migration must not
 * change any engine or codec semantics.
 */
export const IMAGE_RESULT_DECLARATIONS = {
  "aspect-ratio-calculator": { class: "calculator", capabilities: ["copy", "reset"] },
  "color-blindness-image-simulation": { class: "image", capabilities: ["download", "retry", "reset"] },
  "color-converter": { class: "calculator", capabilities: ["copy", "reset"] },
  "color-picker": { class: "calculator", capabilities: ["copy", "reset"] },
  "contact-sheet-generator": { class: "image", capabilities: ["download", "retry", "reset"] },
  "contrast-checker": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "dominant-color-extractor": { class: "calculator", capabilities: ["copy", "reset"] },
  "exif-remover": { class: "image", capabilities: ["download", "retry", "reset"] },
  "favicon-app-icon-size-generator": { class: "image", capabilities: ["download", "retry", "reset"] },
  "image-compare-slider": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "image-compression": { class: "image", capabilities: ["download", "retry", "reset"] },
  "image-crop": { class: "image", capabilities: ["download", "retry", "reset"] },
  "image-dimensions-batch-inspector": { class: "calculator", capabilities: ["copy", "reset"] },
  "image-format-conversion": { class: "image", capabilities: ["download", "retry", "reset"] },
  "image-metadata-viewer": { class: "calculator", capabilities: ["copy", "reset"] },
  "image-rename-batch-preview": { class: "calculator", capabilities: ["copy", "reset"] },
  "image-resize": { class: "image", capabilities: ["download", "retry", "reset"] },
  "palette-extractor": { class: "calculator", capabilities: ["copy", "reset"] },
  "perceptual-duplicate-finder": { class: "validator", capabilities: ["copy", "retry", "reset"] },
  "platform-size-presets": { class: "calculator", capabilities: ["copy", "reset"] },
  "screenshot-border-background-helper": { class: "image", capabilities: ["download", "retry", "reset"] },
} as const satisfies Readonly<Record<string, ResultDeclaration>>;

export type ImageResultToolId = keyof typeof IMAGE_RESULT_DECLARATIONS;

export function imageResultDeclaration(toolId: ImageResultToolId): ResultDeclaration {
  return IMAGE_RESULT_DECLARATIONS[toolId];
}
