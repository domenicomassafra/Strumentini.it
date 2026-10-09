import { dictionaryOrNull, nameValue, type PdfDocumentModel, type PdfValue } from "./parser";

/**
 * Narrow #218 gate for page-level visual contexts that are outside our tested
 * JPEG/Flate XObject rewrite contract.
 *
 * A simple /DeviceRGB image can still participate in transparency, pattern
 * fills or a nested Form graph. In those cases an unchanged /Contents byte
 * stream is insufficient proof of the rewritten PDF's rendered semantics.
 * Refuse to rewrite *any* image in that document until a renderer-backed
 * mixed-compositing preservation contract exists.
 */
export function pdfImageCompositingRisk218(model: PdfDocumentModel): string | null {
  const nonempty = (value: PdfValue | undefined): boolean => {
    if (value === undefined) return false;
    const resolved = dictionaryOrNull(model, value);
    // Non-dictionary, unresolved and unsupported resource graphs are not safe.
    return resolved === null || resolved.entries.size > 0;
  };
  for (const page of model.pages) {
    const value = page.object.value;
    if (value.kind !== "dict") return "unsupported-page-resource-graph";
    if (value.entries.has("Group")) return "page-transparency-group-unsupported";
    const resourceValue = value.entries.get("Resources") ?? page.inherited.Resources;
    const resources = dictionaryOrNull(model, resourceValue);
    if (resources === null) {
      if (resourceValue !== undefined) return "unsupported-page-resource-graph";
      continue;
    }
    for (const key of ["ExtGState", "Pattern", "Shading"]) {
      if (nonempty(resources.entries.get(key))) return `page-${key.toLowerCase()}-compositing-unsupported`;
    }
    const xobjects = dictionaryOrNull(model, resources.entries.get("XObject"));
    if (xobjects === null) {
      if (resources.entries.has("XObject")) return "unsupported-page-xobject-graph";
      continue;
    }
    for (const value of xobjects.entries.values()) {
      if (value.kind !== "ref") return "unsupported-page-xobject-graph";
      const object = model.objects.get(value.id);
      const objectValue = object?.value;
      if (objectValue?.kind !== "stream") return "unsupported-page-xobject-graph";
      const subtype = nameValue(objectValue.dictionary.entries.get("Subtype"));
      if (subtype === "Form") return "nested-form-xobject-compositing-unsupported";
      if (subtype !== "Image") return "unsupported-page-xobject-graph";
    }
  }
  // An indirect image mask or /SMask forms a multi-object compositing graph.
  // Rebuilding an unrelated eligible RGB image in the same PDF does not by
  // itself prove that the shared transparency graph survived intact.
  for (const object of model.objects.values()) {
    const value = object.value;
    if (value.kind !== "stream" || nameValue(value.dictionary.entries.get("Subtype")) !== "Image") continue;
    for (const key of ["SMask", "Mask"]) {
      const mask = value.dictionary.entries.get(key);
      if (mask?.kind === "ref" || mask?.kind === "dict" || mask?.kind === "stream") {
        return "indirect-image-mask-compositing-unsupported";
      }
    }
  }
  return null;
}
