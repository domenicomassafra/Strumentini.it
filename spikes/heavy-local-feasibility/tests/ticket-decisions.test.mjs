import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const evidenceDir = path.join(repoRoot, "quality/benchmarks/heavy-local-feasibility");
const decisions = JSON.parse(await readFile(path.join(evidenceDir, "ticket-decisions-267-275.json"), "utf8"));
const runtime = JSON.parse(await readFile(path.join(evidenceDir, "desktop-runtime.json"), "utf8"));
const corpus = JSON.parse(await readFile(path.join(root, "public/corpus/manifest.json"), "utf8"));

const byTicket = new Map(decisions.tickets.map((item) => [item.ticket, item]));
const corpusByName = new Map(corpus.files.map((item) => [item.name, item]));

test("the supplement covers each feasibility ticket exactly once without promoting a dependency", () => {
  assert.deepEqual([...byTicket.keys()].sort((a, b) => a - b), [267, 268, 269, 270, 271, 272, 273, 274, 275]);
  assert.match(decisions.scope, /no dependency.+production-promoted/iu);
  assert.equal(decisions.physicalMobile.iosSafari.status, "NOT_RUN");
  assert.equal(decisions.physicalMobile.androidChrome.status, "NOT_RUN");
});

test("P7M parsing proves envelope/payload/certificate metadata while trust remains unevaluated", () => {
  const ticket = byTicket.get(267);
  assert.equal(ticket.decision, "REFUSE");
  assert.equal(ticket.selectedCandidate.version, "3.4.1");
  assert.equal(ticket.selectedCandidate.license, "BSD-3-Clause");
  for (const engine of ticket.runtime) {
    assert.equal(engine.status, "PASS");
    assert.equal(engine.externalRequestsObserved, 0);
    assert.equal(engine.value.corruptRejected, true);
    assert.equal(engine.value.unsupportedRejected, true);
    assert.equal(engine.value.trustChainStatus, "NOT_EVALUATED");
  }
});

test("image feasibility closes as a refusal while preserving the missing real-iPhone blocker", () => {
  const ticket = byTicket.get(268);
  assert.equal(ticket.decision, "REFUSE");
  assert.equal(ticket.ticketClosureEligible, true);
  assert.equal(ticket.evidence.realIphoneHeicPresent, false);
  assert.doesNotMatch(corpusByName.get("sample.heic").provenance, /iphone/iu);
  assert.ok(corpusByName.get("sample-animated.gif").bytes > 0);
  assert.equal(ticket.modes.avifEncode, "REFUSE_AS_UNIFORM_NATIVE_PATH");
  assert.ok(ticket.remainingEvidence.some((item) => /real-iPhone/iu.test(item)));
});

test("archive evidence exposes traversal/expansion risk and therefore refuses promotion", () => {
  const ticket = byTicket.get(272);
  assert.equal(ticket.decision, "REFUSE");
  assert.equal(ticket.selectedCandidate.version, "0.8.3");
  assert.equal(ticket.selectedCandidate.license, "MIT");
  for (const engine of ticket.evidence.runtime) {
    assert.equal(engine.status, "PASS");
    assert.ok(engine.value.unsafeNames.includes("../escape.txt"));
    assert.ok(engine.value.zipExpansionRatio > 200);
    assert.ok(engine.value.gzipExpansionRatio > 300);
    assert.equal(engine.value.corruptZipRejected, true);
    assert.equal(engine.value.corruptGzipRejected, true);
  }
  assert.ok(ticket.requiredWrapperIfReopened.some((item) => /parent-traversal/iu.test(item)));
  assert.ok(ticket.requiredWrapperIfReopened.some((item) => /expansion ratio/iu.test(item)));
});

test("physical evidence remains a promotion blocker without keeping completed refusal decisions open", () => {
  for (const number of [268, 269, 273, 274]) {
    const ticket = byTicket.get(number);
    assert.equal(ticket.ticketClosureEligible, true, `ticket ${number} should close as a refusal decision`);
    assert.equal(ticket.decision, "REFUSE");
    assert.ok(ticket.remainingEvidence.some((item) => /mobile|ios|android/iu.test(item)));
  }
  for (const number of [270, 271]) {
    const ticket = byTicket.get(number);
    assert.equal(ticket.ticketClosureEligible, true, `ticket ${number} should close as a refusal decision`);
    assert.equal(ticket.decision, "REFUSE");
    assert.ok(ticket.remainingEvidence.some((item) => /mobile|ios|android/iu.test(item)));
  }
  assert.equal(decisions.umbrella34.decision, "READY_FOR_REVIEW");
  assert.deepEqual(decisions.umbrella34.blockers, []);
  assert.equal(decisions.physicalMobile.iosSafari.status, "NOT_RUN");
  assert.equal(decisions.physicalMobile.androidChrome.status, "NOT_RUN");
});

test("EML MSG and EPUB remain refused and hostile content is never rendered", () => {
  const ticket = byTicket.get(275);
  assert.equal(ticket.decision, "REFUSE");
  assert.equal(ticket.ticketClosureEligible, true);
  assert.deepEqual(ticket.capabilities, {
    eml: "REFUSE_NO_APPROVED_PARSER",
    msg: "REFUSE_NO_APPROVED_PARSER",
    epub: "REFUSE_NO_APPROVED_PARSER",
    activeRemoteContentPolicy: "REJECT_BEFORE_RENDER_OR_EXTERNAL_RESOURCE_RESOLUTION",
  });
  for (const engine of ticket.evidence.runtime) {
    assert.equal(engine.status, "PASS");
    assert.equal(engine.externalRequestsObserved, 0);
    assert.equal(engine.value.eml.activeContentDetected, true);
    assert.equal(engine.value.epub.activeContentDetected, true);
  }
});

test("all new desktop cases stay local and pass in every observed engine", () => {
  const ids = new Set(["cms-pkijs", "archive-fflate", "image-native-modes", "pdf-large-200", "video-large-inspect", "mail-epub-refusal-policy"]);
  for (const engine of runtime.results) {
    assert.deepEqual(engine.externalRequests, []);
    const selected = engine.payload.results.filter((item) => ids.has(item.id));
    assert.equal(selected.length, ids.size);
    assert.deepEqual(selected.filter((item) => item.status !== "PASS"), []);
  }
});
