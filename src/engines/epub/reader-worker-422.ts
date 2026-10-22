import { readEpub422 } from "./reader-422";

self.onmessage = async (event: MessageEvent<{ file: File }>): Promise<void> => {
  try {
    self.postMessage({ ok: true, book: await readEpub422(event.data.file) });
  } catch (error) {
    const code = error instanceof Error && /^EPUB_[A-Z0-9_]{1,80}$/u.test(error.message)
      ? error.message : "EPUB_INVALID";
    self.postMessage({ ok: false, code });
  }
};
