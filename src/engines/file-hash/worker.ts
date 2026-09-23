import { FileHashError, hashBlobIncremental } from "./index";
import type { HashWorkerRequest, HashWorkerResponse } from "./worker-client";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<HashWorkerRequest>) => void) | null;
  postMessage(message: HashWorkerResponse): void;
};

scope.onmessage = async (event) => {
  const request = event.data;
  if (request.type !== "hash") return;
  try {
    const result = await hashBlobIncremental(request.blob, {
      algorithm: request.algorithm,
      ...(request.chunkSize === undefined ? {} : { chunkSize: request.chunkSize }),
      onProgress(progress) {
        scope.postMessage({ type: "progress", progress });
      },
    });
    scope.postMessage({ type: "success", result });
  } catch (error) {
    if (error instanceof FileHashError) {
      scope.postMessage({ type: "failure", code: error.code, message: error.message });
      return;
    }
    scope.postMessage({
      type: "failure",
      code: "WORKER_FAILURE",
      message: error instanceof Error ? error.message : "Hash worker failed.",
    });
  }
};
