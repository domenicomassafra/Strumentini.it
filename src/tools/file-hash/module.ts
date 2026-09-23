import { checksumMatches, parseExpectedChecksum } from "../../engines/file-hash";
import { hashBlobInWorker } from "../../engines/file-hash/worker-client";
import type { ToolModule } from "../../runtime/types";
import type { FileHashInput, FileHashOutput } from "./types";

function validateInput(value: unknown): FileHashInput {
  if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT");
  const candidate = value as Partial<FileHashInput>;
  if (!(candidate.blob instanceof Blob)) throw new Error("INVALID_INPUT");
  if (candidate.algorithm !== undefined && typeof candidate.algorithm !== "string") throw new Error("INVALID_INPUT");
  if (candidate.expectedChecksum !== undefined && typeof candidate.expectedChecksum !== "string") {
    throw new Error("INVALID_INPUT");
  }
  return candidate as FileHashInput;
}

const module: ToolModule = {
  async run(rawInput, _context, signal): Promise<FileHashOutput> {
    const input = validateInput(rawInput);
    const expectedChecksum = input.expectedChecksum?.trim()
      ? parseExpectedChecksum(input.expectedChecksum)
      : null;
    const result = await hashBlobInWorker(input.blob, {
      ...(input.algorithm === undefined ? {} : { algorithm: input.algorithm }),
      ...(signal === undefined ? {} : { signal }),
    });
    return {
      ...result,
      expectedChecksum,
      matchesExpected: expectedChecksum === null ? null : checksumMatches(result.digestHex, expectedChecksum),
    };
  },
};

export default module;
