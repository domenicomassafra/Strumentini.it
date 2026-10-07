# Strumentini.it heavy-browser isolated spikes

This folder is research-only and intentionally does not integrate production app code.

It contains three browser-local capability spikes:

- `pdf-capabilities/` — synthetic PDF create/reorder/rotate/split/merge with `pdf-lib`, plus PDF.js render/text/metadata observation.
- `image-pipeline/` — synthetic crop/resize, JPEG/WebP encoding, AVIF WASM encoding, worker-backed compression, EXIF read and decode/re-encode removal observation.
- `file-pipeline/` — ZIP create/inspect, QR encode/decode, incremental SHA-256 with progress/cancel, and signature-based type detection.

## Run

```bash
cd spikes/heavy-browser
npm ci
npm run bench
```

The browser runner uses the installed macOS Google Chrome binary at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` and writes observed evidence to `quality/benchmarks/heavy-browser/`.

The fixtures are generated locally in code and contain no third-party documents or media.
