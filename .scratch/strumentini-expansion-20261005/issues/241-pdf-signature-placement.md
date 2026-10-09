# 241 — PDF signature placement

**What to build:** Add local visible signature image/drawing/text placement on selected pages with precise scope; do not label it cryptographic digital signing unless a certificate-signing stack is separately implemented and verified.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → security-audit → interaction-design → code-tdd → qa-browser

- [ ] Visible signature mode is named accurately and previewed.
- [ ] No cryptographic validity claim is made for image/drawn signatures.
- [ ] Placed appearance/page/order survive independent render/reopen.

**Verification:** Signature placement corpus and visual/reopen verification.

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
