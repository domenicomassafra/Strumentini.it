// Independent STR-307 probe. The donor is deliberately installed only in an
// ignored, test-only prefix; this file does not activate it in the product.
// Setup: npm install --prefix node_modules/str307-donor --no-save --no-package-lock
//        --ignore-scripts fast-xml-parser@5.11.2
// Run:   node --expose-gc --import tsx src/tools/xml-formatter-validator/donor-comparison-307.mjs
//        node --expose-gc --import tsx .../donor-comparison-307.mjs --bench-local
//        node --expose-gc --import tsx .../donor-comparison-307.mjs --bench-donor
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { xmlOperation } from "../../engines/developer-web/structured-repair.ts";

let loadedDonor;
function donor() {
  loadedDonor ??= createRequire(resolve("node_modules/str307-donor/entry.cjs"))("fast-xml-parser");
  return loadedDonor;
}

const parserOptions = {
  preserveOrder: true,
  processEntities: false,
  ignoreAttributes: false,
  trimValues: false,
  parseAttributeValue: false,
  parseTagValue: false,
  commentPropName: "#comment",
  cdataPropName: "#cdata",
};

function compareDonor(source) {
  const { XMLParser, XMLValidator, XMLBuilder } = donor();
  const validation = XMLValidator.validate(source);
  if (validation !== true) return { accepted: false, validatorCode: validation.err?.code };
  try {
    const tree = new XMLParser(parserOptions).parse(source);
    const formatted = new XMLBuilder({ ...parserOptions, format: true, indentBy: "  " }).build(tree);
    return { accepted: true, formatted, tree };
  } catch (error) {
    return { accepted: false, validatorPassed: true, parserError: String(error?.message ?? error) };
  }
}

function compareLocal(source) {
  try {
    return { accepted: true, formatted: xmlOperation(source, "prettify", 2).output };
  } catch (error) {
    return { accepted: false, code: error?.code, diagnostic: error?.diagnostic };
  }
}

const examples = JSON.parse(readFileSync("quality/fixtures/developer-structured-data/vectors.json", "utf8"));
const cases = [
  ...examples.xml.map(({ name, input }) => ({ name: `repo:${name}`, input })),
  { name: "repo:xxe", input: examples.hostile.find(({ name }) => name === "external-entity").input },
  { name: "independent:mixed-svg-space", input: '<svg xmlns="http://www.w3.org/2000/svg"><text><tspan>A</tspan> <tspan>B</tspan></text></svg>' },
  { name: "independent:pi-comments-cdata", input: '<?xml version="1.0"?><r><!--x--><![CDATA[A & B]]><a/>tail</r><?finish ok?>' },
  { name: "independent:attribute-quotes", input: `<r a='left &amp; right' b="&#x20;"><e/></r>` },
  { name: "independent:unknown-entity", input: "<r>&custom;</r>" },
  { name: "independent:internal-dtd", input: '<!DOCTYPE r [<!ENTITY x "hello">]><r>&x;</r>' },
  { name: "independent:external-dtd", input: '<!DOCTYPE r SYSTEM "https://invalid.example/foo.dtd"><r/>' },
  { name: "independent:duplicate-attribute", input: '<r a="1" a="2"/>' },
  { name: "independent:unpaired-tag", input: '<r><a></r>' },
  { name: "independent:cdata-close", input: '<r>bad]]>text</r>' },
  { name: "independent:numeric-nul", input: '<r>&#0;</r>' },
  { name: "independent:illegal-control", input: `<r>${String.fromCharCode(1)}</r>` },
  { name: "independent:xml-space-inherited", input: '<r xml:space="preserve"><a> </a> <b> x </b></r>' },
  { name: "independent:namespace-prefix", input: '<r xmlns:p="urn:example"><p:tag/></r>' },
  { name: "independent:unbound-prefix", input: '<r><p:tag/></r>' },
  { name: "independent:depth-65", input: "<r>" + "<n>".repeat(65) + "</n>".repeat(65) + "</r>" },
  { name: "independent:node-limit", input: "<r>" + "<n/>".repeat(50_001) + "</r>" },
  { name: "independent:input-limit", input: "<r>" + "x".repeat(1_000_001) + "</r>" },
];

function benchmark(mode) {
  const input = `<root>${'<item a="1">hello <b>world</b> !</item>'.repeat(120)}</root>`;
  const fn = mode === "local"
    ? () => xmlOperation(input, "prettify", 2)
    : () => {
      const result = compareDonor(input);
      assert.equal(result.accepted, true);
      return result;
    };
  fn(); // warm up both paths, including module loading
  globalThis.gc?.();
  const samples = [];
  const start = performance.now();
  for (let index = 0; index < 300; index += 1) {
    fn();
    if (index % 10 === 0) samples.push(process.memoryUsage().heapUsed);
  }
  const elapsed = performance.now() - start;
  console.log(JSON.stringify({ mode, cases: 300, inputBytes: Buffer.byteLength(input), totalMs: Math.round(elapsed * 100) / 100, meanMs: Math.round(elapsed / 3) / 100,
    heapUsedSampleMaxMiB: Math.round(Math.max(...samples) / 10485.76) / 100, note: "Heap sampled each 10 iterations; OS peak RSS measured separately by /usr/bin/time -l." }));
}

if (process.argv.includes("--bench-local") || process.argv.includes("--bench-donor")) {
  benchmark(process.argv.includes("--bench-local") ? "local" : "donor");
} else {
  const results = cases.map(({ name, input }) => {
    const local = compareLocal(input);
    const candidate = compareDonor(input);
    return {
      name,
      local: local.accepted ? "ACCEPT" : `REJECT:${local.code}`,
      donor: candidate.accepted ? "ACCEPT" : `REJECT:${candidate.validatorCode ?? "PARSER"}`,
      donorValidatorBypass: candidate.validatorPassed === true,
      formatEqual: local.accepted && candidate.accepted ? local.formatted === candidate.formatted : null,
      // Compare serialization directly: parse-order mode alone does not prove
      // output text is safe for mixed-content/whitespace.
      ...(name === "independent:mixed-svg-space" || name === "repo:mixed-content-whitespace"
        ? { localFormatted: local.formatted, donorFormatted: candidate.formatted }
        : {}),
    };
  });
  assert.equal(results.length, 21);
  assert.equal(results.find(({ name }) => name === "independent:unknown-entity")?.local, "REJECT:XML_EXTERNAL_ENTITY_DISABLED");
  assert.equal(results.find(({ name }) => name === "independent:unknown-entity")?.donor, "ACCEPT");
  assert.equal(results.find(({ name }) => name === "repo:xxe")?.donorValidatorBypass, true);
  assert.equal(results.find(({ name }) => name === "independent:mixed-svg-space")?.formatEqual, false);
  const totals = {
    compared: results.length,
    donorAcceptsLocalRefusals: results.filter(({ local, donor }) => local.startsWith("REJECT") && donor === "ACCEPT").map(({ name }) => name),
    differentFormattedOutputs: results.filter(({ formatEqual }) => formatEqual === false).map(({ name }) => name),
    donorValidatorPassesParserRefusals: results.filter(({ donorValidatorBypass }) => donorValidatorBypass).map(({ name }) => name),
  };
  console.log(JSON.stringify({ totals, cases: results }, null, 2));
}
