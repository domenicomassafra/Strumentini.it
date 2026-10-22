import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { assessMobileMemory363Compiled } from "./lib/mobile-memory-363-compiled";

const checkoutRoot = resolve(import.meta.dirname, "..");
const receiptPath = resolve(checkoutRoot, process.argv[2] ?? "quality/receipts/mobile-memory-363-simulated.json");
if (!receiptPath.startsWith(checkoutRoot + sep)) {
  console.error("STR-363: receipt path must remain inside the checked-out repository");
  process.exitCode = 1;
} else {
  try {
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    const result = await assessMobileMemory363Compiled(receipt, checkoutRoot);
    console.log(JSON.stringify(result, null, 2));
    // Both states require action: a matching build/trace still needs an
    // independent human review of the actual emulator/simulator session.
    process.exitCode = result.status === "BLOCKED" ? 1 : 2;
  } catch (error) {
    console.error("STR-363: receipt read/parse failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
