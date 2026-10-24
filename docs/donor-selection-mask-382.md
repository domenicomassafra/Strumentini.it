# STR-382 — selection masks: reuse and provenance

Verified 2026-10-22. This feature reuses the owner's existing `applyImageTransformPixels`, `readImageTransformSource`, `pixelFrameToCanvas` and `outputBlob` implementations. The selection operation composes a coverage channel into existing RGBA alpha and uses the same local PNG path as the image-crop tool. No new runtime dependency, donor source copy, or third-party source patch is introduced.

| Source | Version / commit and license | Decision |
| --- | --- | --- |
| [HTML Canvas 2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) / [MDN content](https://github.com/mdn/content/blob/f336c5b6795a562c64fe859aa9ee2becf223ad8a/files/en-us/web/api/canvasrenderingcontext2d/globalcompositeoperation/index.md) | Documentation commit `f336c5b6795a562c64fe859aa9ee2becf223ad8a` (2025-11-03); docs CC-BY-SA 2.5, browser API is native | Canvas `getImageData` / `putImageData` and the project's existing pixel pipeline suffice; no external editor engine needed. No documentation source copied. |
| [sharp 0.35.5](https://github.com/lovell/sharp/tree/v0.35.5) | `51a990faa26ade5586a4934ac9673c98d8893326`, Apache-2.0 | Existing test/oracle dependency as used for STR-381 #140. Use independently for PNG reopen; do not bundle sharp in browser. |
| [STR-381 #140 PR #390](https://github.com/domenicomassafra/Strumentini.it/pull/390) | Pending, unmerged on 2026-10-22 | Canvas/layer editor is the future integration surface. This tranche attaches to the already-shipped image-crop tool until the UI/layer integration is available; no copy of its draft compositor. |

The only new logic is the feature-specific geometry and fractional 4×4 elliptical coverage, plus an accessible mouse/touch/keyboard selection UI. Inputs remain intact and invalid dimensions, coverage and pixel budgets fail closed. A 4 MP guard bounds software work but is **not** an observed mobile-memory budget; see #124. Built-browser and installed-production proof remain separate acceptance gates.
