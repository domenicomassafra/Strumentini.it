import { runUnitOperation, type UnitOperation } from "../engines/unit-conversion";
import type { ToolModule } from "../runtime/types";
import { assertNotAborted, inputRecord } from "./business-module";

export function createUnitModule(operation: UnitOperation): ToolModule {
  return {
    run(rawInput, _context, signal) {
      assertNotAborted(signal);
      return runUnitOperation(operation, inputRecord(rawInput));
    },
  };
}
