/** Identifies shipped model and runtime payloads that require a provenance pin. */
export const RUNTIME_PAYLOAD_366 = /\.(?:onnx(?:\.gz)?|wasm(?:\.js|\.bin|\.gz)?|traineddata(?:\.gz)?|ort(?:\.gz)?|tflite|safetensors|gguf|bin)$/iu;

export function auditPublicRuntime366(paths: string[], pinned: ReadonlySet<string>): string[] {
  const failures: string[] = [];
  for (const path of paths) {
    if (path.startsWith("SYMLINK:") || path.startsWith("UNKNOWN_TYPE:")) {
      failures.push(`UNSAFE_PUBLIC_ASSET ${path.slice(path.indexOf(":") + 1)}`);
    } else if (RUNTIME_PAYLOAD_366.test(path) && !pinned.has(path)) {
      failures.push(`UNPINNED_ASSET ${path}`);
    }
  }
  return failures;
}
