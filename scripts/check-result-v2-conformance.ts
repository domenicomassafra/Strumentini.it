import { RESULT_V2_SEMANTIC_FIXTURES } from "../quality/fixtures/result-v2-semantic-classes/fixtures";
import { assertResultV2SemanticConformance } from "../src/quality/result-v2-conformance";

const report = assertResultV2SemanticConformance(RESULT_V2_SEMANTIC_FIXTURES);
console.log(`Result v2 semantic conformance PASS: ${report.classes.length} classi coperte`);
for (const item of report.classes) {
  console.log(`- ${item.class}: ${item.slots.length} slot, ${item.actions.length} azioni, ${item.states.length} stati, ${item.a11y.length} check a11y`);
}
