import { regexTestOperation } from "./encoding-crypto";
import type { RegexWorkerRequest, RegexWorkerResponse } from "./regex-worker-client";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RegexWorkerRequest>) => void) | null;
  postMessage(message: RegexWorkerResponse): void;
};

scope.onmessage = (event) => {
  const request = event.data;
  if (request.type !== "regex-test") return;
  try {
    scope.postMessage({
      type: "success",
      result: regexTestOperation(request.pattern, request.flags, request.text, request.replacement),
    });
  } catch (error) {
    scope.postMessage({
      type: "failure",
      message: error instanceof Error ? error.message : "REGEX_WORKER_FAILURE: Il worker regex non ha completato l'operazione.",
    });
  }
};
