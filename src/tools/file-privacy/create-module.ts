import { runFilePrivacyOperation, type FilePrivacyOperation } from "../../engines/file-privacy";
import type { ToolModule } from "../../runtime/types";

export function createFilePrivacyModule(operation: FilePrivacyOperation): ToolModule {
  return {
    run(input, _context, signal) {
      return runFilePrivacyOperation(operation, input, signal);
    },
  };
}
