// Evaluated in the compiled Astro page by the STR-369 CDP acceptance script.
// The SSR form exists before Preact installs its file-change handler; Astro
// removes `ssr` only after the island hydrator resolves.
export const editorHydrated = `(() => {
  const input = document.querySelector('[data-pdf-watermark] input[type="file"]');
  const island = input?.closest('astro-island');
  return Boolean(island && !island.hasAttribute('ssr'));
})()`;

export const invalidPdfRejected = `(() => [...document.querySelectorAll('[data-pdf-watermark] [role="alert"]')]
  .some((alert) => Boolean(alert.textContent?.trim())))()`;
