import { estimateDonor } from "./donor-core";

self.onmessage = (event: MessageEvent<{ password: string }>) => {
  try {
    self.postMessage({ result: estimateDonor(event.data.password) });
  } catch {
    self.postMessage({ error: "DONOR_UNAVAILABLE" });
  }
};
