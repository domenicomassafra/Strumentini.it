import type { FactoryToolManifest } from "../tool-factory/manifest";

const fixtureFamilies = ["image-metadata", "mime-file-signatures"] as const;

export const imageVisualToolDefinitions = [
  ["image-crop", "Image Crop", "Crop a local image to an exact rectangle with a bounded browser-local output.", ["image crop", "crop photo"], ["crop an image", "crop image to size"], "image", "H", "cand-142", ["file-read", "image-decode"]],
  ["image-format-conversion", "Image Format Conversion", "Convert a local JPEG, PNG, or WebP image to a verified browser-supported output format.", ["convert image format", "image format converter"], ["convert image format", "change image file format"], "image", "H", "cand-143", ["file-read", "image-decode"]],
  ["image-compression", "Image Compression", "Compress a local image with an explicit quality setting and verified output.", ["compress image", "image compressor"], ["compress an image", "reduce image file size"], "image", "H", "cand-144", ["file-read", "image-decode"]],
  ["aspect-ratio-calculator", "Aspect Ratio Calculator", "Calculate a simplified image aspect ratio and bounded fit dimensions without uploading dimensions.", ["image ratio calculator", "picture ratio"], ["calculate image aspect ratio", "find image ratio"], "image-visual", "E", "cand-145", []],
  ["platform-size-presets", "Platform Size Presets", "Preview common social and app image dimensions with contain and cover calculations.", ["social image sizes", "platform image presets"], ["choose social image size", "calculate platform image size"], "image-visual", "E", "cand-146", []],
  ["image-metadata-viewer", "Image Metadata Viewer", "Inspect bounded local image headers, dimensions, signatures, and file size without decoding or uploading the file.", ["image metadata", "image header viewer"], ["inspect image metadata", "view image dimensions"], "image", "E", "cand-147", ["file-read"]],
  ["exif-remover", "EXIF Remover", "Create a new local image output from decoded pixels and state the bounded metadata policy explicitly.", ["remove exif", "strip image metadata"], ["remove exif metadata", "strip image metadata"], "image", "H", "cand-148", ["file-read", "image-decode"]],
  ["color-picker", "Color Picker", "Pick a color with a native browser control and inspect its exact RGB, HSL, and hexadecimal values.", ["pick color", "colour picker"], ["choose a color", "inspect a color"], "image-visual", "E", "cand-149", []],
  ["color-converter", "Color Converter", "Convert hexadecimal colors to RGB and HSL locally with explicit channel rounding.", ["hex to rgb", "rgb to hex", "color converter"], ["convert color values", "convert hex to hsl"], "image-visual", "E", "cand-150", []],
  ["contrast-checker", "Contrast Checker", "Check a foreground and background color pair against WCAG relative-luminance contrast ratios.", ["wcag contrast", "color contrast checker"], ["check color contrast", "calculate wcag contrast"], "image-visual", "E", "cand-151", []],
  ["palette-extractor", "Palette Extractor", "Extract a bounded local color palette from decoded image pixels using deterministic quantization.", ["image palette", "extract colors from image"], ["extract image palette", "find image colors"], "image", "H", "cand-152", ["file-read", "image-decode"]],
  ["dominant-color-extractor", "Dominant Color Extractor", "Find the dominant quantized color from a bounded local image sample.", ["dominant image color", "image color finder"], ["find dominant color", "extract main image color"], "image", "H", "cand-153", ["file-read", "image-decode"]],
  ["image-dimensions-batch-inspector", "Image Dimensions Batch Inspector", "Inspect several local image headers and report dimensions, MIME signatures, and bounded size guidance.", ["batch image dimensions", "image size checker"], ["inspect image dimensions", "check multiple image sizes"], "image", "E", "cand-154", ["file-read"]],
  ["image-rename-batch-preview", "Image Rename Batch Preview", "Preview safe, deterministic filename changes for local images without writing or uploading anything.", ["batch rename images", "image filename preview"], ["preview image renames", "rename image files safely"], "image", "E", "cand-155", ["file-read"]],
  ["contact-sheet-generator", "Contact Sheet Generator", "Compose selected local images into one bounded contact sheet in a browser canvas.", ["contact sheet", "image thumbnail sheet"], ["make image contact sheet", "combine image thumbnails"], "image", "H", "cand-156", ["file-read", "image-decode"]],
  ["favicon-app-icon-size-generator", "Favicon / App Icon Size Generator", "Generate a bounded set of square favicon and app-icon PNG sizes from one local image.", ["favicon generator", "app icon sizes"], ["generate favicon sizes", "create app icon sizes"], "image", "H", "cand-157", ["file-read", "image-decode"]],
  ["screenshot-border-background-helper", "Screenshot Border / Background Helper", "Add a measured border and background around a local screenshot using a bounded canvas output.", ["screenshot border", "image background helper"], ["add border to screenshot", "add image background"], "image", "E", "cand-158", ["file-read", "image-decode"]],
  ["image-compare-slider", "Image Compare Slider", "Compare two local images with a deterministic pixel-difference summary and side-by-side preview metadata.", ["image compare", "before after image"], ["compare two images", "inspect image difference"], "image", "E", "cand-159", ["file-read", "image-decode"]],
  ["perceptual-duplicate-finder", "Perceptual Duplicate Finder", "Compare bounded local image pixel samples to find near-duplicate dimensions and color signatures.", ["duplicate image finder", "perceptual image dedupe"], ["find duplicate images", "find visually similar images"], "image", "H", "cand-160", ["file-read", "image-decode"]],
] as const;

export type ImageVisualDefinition = (typeof imageVisualToolDefinitions)[number];

function createImageVisualManifest(definition: ImageVisualDefinition): FactoryToolManifest {
  const [id, name, summary, aliases, jobs, engine, maintenanceClass, oracleEntryId, capabilities] = definition;
  return {
    id,
    route: `/tools/${id}`,
    name,
    summary,
    aliases: [...aliases],
    keywords: [...aliases, ...jobs],
    jobs: [...jobs],
    category: engine === "image-visual" ? "image-visual" : "files-assets",
    inputTypes: engine === "image-visual" ? ["color", "number"] : ["image/jpeg", "image/png", "image/webp"],
    packIds: ["creative"],
    roleTags: ["Content / creator work", "Marketing / growth"],
    implementation: `../tools/${id}/module.ts`,
    engine,
    runtime: { location: "LOCAL", network: "forbidden" },
    privacyClass: "LOCAL",
    capabilities: [...capabilities],
    profileFields: [],
    gold: { maintenanceClass, oracleEntryId, fixtureFamilies: [...fixtureFamilies] },
    version: "0.1.0",
    deterministic: true,
    dependencies: [],
    lazyDependencies: [],
    bundle: { eager: false, lazy: true, initialBytes: 0, maxBytes: 300_000 },
    offline: "FULL",
    acceptance: { independentOracle: true, fixtureFamilies: [...fixtureFamilies], privacy: true, accessibility: true, bundle: true },
    page: { component: `${id.split("-").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join("")}Tool`, clientDirective: "load" },
  };
}

export const imageVisualManifestById = Object.fromEntries(
  imageVisualToolDefinitions.map((definition) => [definition[0], createImageVisualManifest(definition)]),
) as Record<(typeof imageVisualToolDefinitions)[number][0], FactoryToolManifest>;

export function createImageVisualManifestFromId(id: (typeof imageVisualToolDefinitions)[number][0]): FactoryToolManifest {
  return imageVisualManifestById[id];
}
