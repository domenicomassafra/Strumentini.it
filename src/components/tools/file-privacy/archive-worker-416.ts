import { runArchive416, type Archive416Action } from "../../../engines/archive-safe";

interface Request416 {
  readonly action: Archive416Action;
  readonly files: File[];
}

self.onmessage = async (event: MessageEvent<Request416>): Promise<void> => {
  try {
    const result = await runArchive416(event.data.action, event.data.files);
    self.postMessage({ ok: true, result });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code) : "CORRUPT_ARCHIVE";
    self.postMessage({ ok: false, code });
  }
};
