# 241 — PDF signature placement

**What to build:** Add local visible signature image/drawing/text placement on selected pages with precise scope; do not label it cryptographic digital signing unless a certificate-signing stack is separately implemented and verified.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** completed

**Suggested skills:** pdf → security-audit → interaction-design → code-tdd → qa-browser

- [x] Visible signature mode is named accurately and previewed (bounded local candidate; proof below).
- [x] No cryptographic validity claim is made for image/drawn/text signatures (proof below).
- [x] Placed appearance/page/order survive independent render/reopen (actual pixels and page order; proof below).

**Verification:** Signature placement corpus and visual/reopen verification.

**2026-10-10 functional closure and public integration (supersedes the earlier candidate-only status):** The three original ACs are now verified end-to-end in the **bounded, explicitly non-cryptographic** use case. Rather than creating a second catalog renderer or an unreviewed public route, the existing public `/tools/pdf-watermark/` renderer mounts `PdfVisualSignature241Tool` as its separate **“Firma grafica visiva su PDF semplice”** section (`#firma-grafica-visiva`). The watermark's own form, output and underlying engine remain independent; the catalog continues to have exactly one renderer per tool, preserves its route inventory, and does not invent a new Gold claim or alter the existing watermark's historical receipt. The separate experimental development-only/noindex `/tools/pdf-visual-signature/` candidate remains excluded from static production builds. The section clearly states that it is **not** a certificate-backed digital, qualified electronic, or authenticated signature. It refuses encrypted, signed/certified, incremental/linearized, form-bearing, annotated, active or structurally unsupported PDFs rather than invalidating their security or silently discarding content.

**Independently verified compiled public release acceptance:** The isolated clean source checkout plus only the two-file scoped #241 integration/test delta passed `npm run check` (**1929 files, 0 errors/0 warnings**) and `npm run build` (**291 pages, `build inspection PASS`, one renderer/catalog entry per page**). A separately served copy of that actual static `dist` passed the full existing real file/browser acceptance in **Chromium 51/51, Firefox 51/51 and WebKit 51/51**, **153/153 checks** at 320, 390 and 1440px CSS viewports. All three browsers selected multiple PDF pages, previewed independent PDF.js page renders, generated actual PNG/text/freehand overlays, downloaded real PDF outputs and independently reopened their pixels in PDF.js (`@napi-rs/canvas`), verified original page order plus only selected pages painted, refused signed/certified/form-bearing sources, cleared stale results after input changes and prevented premature downloads. No task-time offsite requests, unexpected JavaScript errors or horizontal overflow. The public placement canvas is scrolled into view before low-level pointer simulation; unlike the old development-only short page, it is below a separate existing editor. The static server's `GET /api/auth/session` response 404 is the expected **test-server-only** backend omission, not an application failure; the browser assertion bounds 404 to that route. Existing PDF writer focused **8/8 Vitest PASS**, and independent PDF.js rotation/CropBox raster acceptance from earlier work covers 0/90/180/270 rotations.

**Scope and release boundaries:** The writer only overlays up to eight chosen pages of a simple **unsigned** PDF (≤25 MiB, ≤40 pages) using PNG RGB/RGBA ≤2 MiB/262144 pixels or generated text/drawing. It rewrites bytes and preserves/rechecks original page streams and geometry only for supported files. It does **not** sign, certify authenticity, redact, preserve arbitrary PDF semantics, or guarantee legal validity. Physical iOS/Android hardware runs, formal human accessibility/security sign-off and Gold re-certification remain **NOT RUN** and are tracked separately by existing release gates #280/#281; this is a functional ticket closure, not a universal PDF signing/security or Gold pass. Cloudflare promotion is separate and must be confirmed by Wrangler + HTTP/browser smoke; no production claim is inferred from a successful local build alone.

**Worker subset (2026-10-09, local candidate; status remains `ready-for-agent`):**
`src/engines/pdf/visual-signature-241.ts` implements a strictly bounded, **visible image overlay**
for simple unsigned PDFs. It does not create an `/FT /Sig` field, sign any byte range,
use certificates, or assert legal/cryptographic validity. The output filename and plan
explicitly say `VISIBLE_IMAGE_ONLY_NO_CRYPTOGRAPHIC_SIGNATURE` / `NON-digitale`.
No public manifest, registration, catalog, copy, frontend preview, or production route
has been added pending PRIME security review.

The caller supplies a 1-indexed page range and `rect: [x0,y0,x1,y1]` in visible
CropBox-relative **display-space PDF points** (origin bottom left, taking `/Rotate`
0/90/180/270 into account). Every selected rect is checked against that page's
actual bounds; out-of-bounds placement refuses. The engine embeds a CRC-validated,
noninterlaced PNG RGB8 or RGBA8 (max 2 MiB, 262144 pixels); RGB rows are decoded
through filters 0–4 and bounded inflate, FlateDecode XObjects use `/DeviceRGB`,
and RGBA produces a grayscale `/SMask` preserving transparency. `pHYs` density is
ignored because placement is explicit PDF points; unknown profile/gamma/palette/
animation/ancillary chunks refuse rather than silently altering color semantics.
This is a **painted page-content overlay**, not a signature widget or annotation
with `/Rect`; the `rect` is part of the audited placement plan.

Safety gate rejects encrypted, linearized, incremental, certified/signed or
form-bearing files (`/ByteRange`, `/DocMDP`, `/FT /Sig`, `/AcroForm`, `/Perms`,
etc.), annotations/actions and unsupported catalog/page structures. The writer
wraps each original selected page content stream between `q`/`Q`, then paints the
image inside a separate `q`/`Q`; original source stream bytes, page order, page
count and CropBox/Rotate are rechecked after output. Caller cancellation refuses
publication. The input is **rewritten** (byte identity not preserved); PDFs with
complex structure or signatures are refused rather than invalidating signed bytes.

**Automated proof:** `tests/pdf-visual-signature-241.test.ts` exercises synthetic
three-page PDF source/output, RGB/RGBA CRC and exact pixel/alpha data, soft-mask
reopen, page selection, rotated CropBox, corrupt/spoofed PNG and bounded inflate,
signed/form/annotation refusals, cancellation, original stream equality. Independent
PDF.js reopens the generated output, verifies all source texts and image-paint
operator only on the selected page. No browser run, cross-engine pixel rendering,
physical device acceptance or user-facing placement preview has yet been proved.
Existing #215 renderer remains independent; #269 did not approve an external editor.
Therefore all original #241 ACs are **not** marked satisfied and status must stay
`ready-for-agent`. The pending gate is actual rendered appearance parity plus
security review before production wiring.

**PRIME independent raster acceptance (2026-10-09, DESKTOP NODE ONLY):**
`scripts/acceptance-pdf-visual-signature-241.ts` now constructs a source three-page PDF,
produces an actual signed-looking-but-**NOT digitally signed** output with an RGBA PNG,
and asks **independent PDF.js** to render the source and all output pages onto native
`@napi-rs/canvas` pixels. The actual painted page-2 region has RGBA `[230,12,32,255]`;
the transparent bottom region is `[255,255,255,255]` (white original background),
and pages 1 and 3 remain white at the same sample location. **PASS**, no browser/mobile
claim. This proves visible placement and soft-mask appearance on a real renderer;
it does NOT prove signature authenticity, cross-engine/browser parity, user-facing
placement UI, physical-device performance, or safe handling of arbitrary PDFs.
No public route/manifest is enabled and #241 remains `ready-for-agent` (OPEN).

**2026-10-09 isolated worker #241 UI tranche (candidate; keep status `ready-for-agent`):**
Added `src/components/tools/pdf/PdfVisualSignature241Tool.tsx` and
an isolated fallback Astro route (later moved to `src/pages/tools/pdf-visual-signature/[...route].astro`, `BaseLayout noindex`),
plus `tests/pdf-visual-signature-ui-241.browser.ts` and isolated
`tests/astro-visual-signature-241.config.mjs` (worktree symlink read allowance).
The browser UI accepts local simple unsigned PDF + PNG RGB/RGBA, chooses a
1-indexed page, and exposes keyboard/numeric `x/y/width/height` in visible
CropBox-relative **bottom-left PDF points**, with positioned outline overlay
on an independent PDF.js-rendered source preview. It clearly calls the operation
**firma grafica VISIVA (NON digitale)**, never cryptographic signing. A link to
download is shown **only after** the existing writer checks its output,
`inspectPdfBytes` reopens it, and a separate lazy PDF.js session verifies the
page count and successfully renders the selected output page. Changing input,
selection or geometry invalidates previous download state; reset clears both
file pickers and previews, with cancellation through AbortController and
generation-token guards around asynchronous work. No engine, shared catalog,
manifest, registry or other production route was edited.

**Real browser acceptance (isolated Astro/Vite, Chromium desktop viewport
390×844): 36/36 checks PASS** via
`./node_modules/.bin/tsx tests/pdf-visual-signature-ui-241.browser.ts`.
Test uploads a genuine three-page PDF and real 16×8 RGBA PNG, places red
opaque/green transparent pixels at `[100,100,200,160]` on page 2, checks
original overlay, downloaded NON-digitale filename, and independently renders
downloaded output with native PDF.js canvas. The red region is present on page
2, transparent half leaves the white PDF background, and pages 1 and 3 remain
visibly unchanged at the sampled pixel. The browser refuses an invalid
oversized rectangle, an existing `/Perms /DocMDP` certification reference,
a `/ByteRange` signature marker and an `/AcroForm` PDF: no downloadable output.
Reset removes controls/results; no offsite requests, no JS page exceptions,
no horizontal overflow at 390 px. The isolated Vite shell's local
`/api/auth/session` probe responds 404, as expected without an auth backend;
the acceptance specifically permits only that unrelated local response.
Existing engine Vitest **7/7 PASS**; `astro check` **0 errors / 0 warnings
(21 pre-existing hints)**. This is development-server UI validation, **not**
production build/real iOS, Android, Safari, Firefox, screen-reader, keyboard-only
human, physical cancellation-under-load, document-wide visual diff or legal
signature certification. PRIME must review security, register the manifest/copy
and run built-bundle plus physical/device acceptance before closing #241 or
promoting Gold. The generated PDF is never an authenticated digital signature.

**PRIME build-gate correction 2026-10-09 17:19:** The first integrated static-page version correctly failed `scripts/inspect-build.ts`: `Unexpected HTML page set ... tools/pdf-visual-signature/index.html` because the source-only candidate is absent from the approved catalog. The Astro candidate was moved to a dynamic development-only route `src/pages/tools/pdf-visual-signature/[...route].astro`: `getStaticPaths` returns its local preview path only in dev and returns **zero pages for production builds**. The actual Chromium development UI test reran **36/36 PASS**, `npm run check` **0 errors / 0 warnings** and `npm run build` **289 pages PASS** with unchanged public route inventory, no stray #241 HTML, no sitemap entry, and no catalog or Gold changes. This temporary development availability is **not** a production release or permission to advertise signing; ticket stays OPEN for the same physical/browser/human acceptance gates.

**2026-10-09 PRIME independent preview readiness RED→GREEN (no production release):** The development-only UI previously enabled **Applica immagine visiva** when the plan validated, even though the original-page PDF.js render/thumbnail had not finished. The browser test suspended the actual canvas `toBlob` and demonstrated **RED**: submit was enabled without visible preview. `PdfVisualSignature241Tool.tsx` now tags its preview with the exact source `File`, parsed-document identity and page; download-generation and submit require the current thumbnail's object URL to be loaded by `<img onLoad>`. A stale previous-page thumbnail is immediately hidden and cannot authorize a different page's placement. The deterministic browser proof also pauses the second-page render and checks the old preview and submit remain unavailable until the new page is ready. `tests/pdf-visual-signature-ui-241.browser.ts` isolated desktop Chromium 390×844 **39/39 PASS**, including independently reopened image/alpha output, refusal corpus and no offsite; existing #241 engine Vitest **7/7 PASS**; worker-scoped Astro check **1849 files, 0 errors, 0 warnings**, diff check PASS. This remains a bounded **graphic image only, NOT a cryptographic signature**; physical iOS/Android, wider browser/human usability, full document appearance/security review and approval to register a public tool are **NOT VERIFIED**. The ticket remains `ready-for-agent`/OPEN, no Gold, deploy or new static route.

**2026-10-10 #241 worker local completion wave (release gate still open):** The previous image-only UI now also rasterizes **text** (bounded 512×160 Georgia italic, refuses overlong strings) and **freehand pointer/touch drawings** into profile-free CRC-protected RGBA PNG. Blank drawings and fully transparent input PNGs fail closed. The user can select up to eight distinct pages with the canonical range grammar (`2,3-4`) and independently inspect a selected original page before placement. An invalid/shared rectangle refuses on any selected rotated CropBox; changing source/mode/page/geometry invalidates a stale result. PDF.js now independently opens the written PDF and renders **every** selected final page; download remains unavailable until all preview images have loaded. No electronic signature, certificate, byte-range signing or legal validity is asserted; signed, form-bearing, active and structurally unsupported PDFs remain refused.

**Measured local acceptance:** `vitest run tests/pdf-visual-signature-241.test.ts` covers source preservation, transparency, PNG pixel bounds, empty-alpha rejection and PDF.js reopen. `tsx scripts/acceptance-pdf-visual-signature-241.ts` independently rasterizes the exported PDF on real PDF.js canvas for **all 0°/90°/180°/270° rotations with shifted CropBox**, checking colored opaque pixels, transparent pixels, and the original pixels outside the signature; every case passed. `tsx tests/pdf-visual-signature-ui-241.browser.ts` drives actual isolated Chromium **320/390/1440 CSS-pixel viewports**, real three-page PDF input, real PNG, text and mouse drawing, confirms per-mode independent output/ink pixels, multi-page order, page-preview switching, signed/certified/form refusal, reset/stale guards, no offsite traffic and no horizontal overflow (**51 checks passed**). Visual screenshots: `.scratch/strumentini-expansion-20261005/evidence/ticket241/chromium-{320,390,1440}.png`. Test optimizer cache is isolated to avoid cross-worker Vite races. Source/engine execution remains bounded to simple unsigned PDF; screenshots are **desktop Chromium viewport emulation**, not a real physical mobile device.

**Decision / remaining gates:** All three original source-level ACs have local proof within the clearly stated supported subset: correct visible-mode naming and preview, explicit no-crypto representation, and independent pixel/reopen verification of selected page appearance/order. The issue stays **`ready-for-agent` (OPEN)** pending the issue's existing physical iOS/Android, Safari/Firefox, keyboard-only/manual accessibility, independent security/publication and production built-bundle review, then catalog/manifest/public route acceptance. The `/tools/pdf-visual-signature/` page remains an isolated **dev-only `noindex` candidate**; no Gold, claim of physical acceptance, public manifest, push or Cloudflare deploy is authorized by this evidence.
