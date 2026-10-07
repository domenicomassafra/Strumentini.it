import { describe, expect, it } from "vitest";
import {
  createBinaryHandoffEnvelope,
  isBinaryHandoffEnvelope,
  isTrustedBinaryHandoffEvent,
  MAX_BINARY_HANDOFF_BYTES,
  proposeBinaryHandoff,
  validateBinaryHandoffMessage,
} from "../src/runtime/binary-handoff";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { proposeHandoff, type TableHandoffEnvelope } from "../src/runtime/handoff";
import type { HandoffToolSummary } from "../src/catalog/manifest";

function verifiedArtifact(kind: "file" | "image" = "file", size = 3) {
  return createOutputArtifactDescriptor({
    kind,
    name: "../unsafe/path/result.bin",
    mime: kind === "image" ? "image/png" : "application/octet-stream",
    bytes: new Uint8Array(size),
    verification: {
      state: "verified",
      verifiedMime: kind === "image" ? "image/png" : "application/octet-stream",
      method: "fixture verifier",
    },
    fidelity: "unknown",
    fidelityNote: "Fixture artifact.",
  });
}

const fileTarget: HandoffToolSummary = {
  id: "target",
  route: "/tools/target",
  name: "Target",
  handoff: { accepts: [{ type: "file", format: "bin", maxBytes: 1024 }] },
};

describe("binary handoff envelope", () => {
  it("creates an ephemeral verified payload descriptor without putting raw bytes in routing metadata", () => {
    const envelope = createBinaryHandoffEnvelope("file", verifiedArtifact(), "bin");
    expect(envelope.descriptor).toMatchObject({
      type: "file",
      version: 1,
      name: "result.bin",
      mime: "application/octet-stream",
      bytes: 3,
      verification: "verified",
    });
    expect(envelope.payload).toEqual(new Uint8Array(3));
    expect(JSON.stringify(envelope.descriptor)).not.toContain("payload");
    expect(proposeBinaryHandoff(envelope, fileTarget).compatible).toBe(true);
  });

  it("rejects incompatible types and target-specific oversize payloads before transfer", () => {
    const envelope = createBinaryHandoffEnvelope("bytes", verifiedArtifact(), "bin");
    expect(proposeBinaryHandoff(envelope, fileTarget)).toMatchObject({
      compatible: false,
      reason: expect.stringContaining("descriptor type mismatch"),
    });

    const strictTarget: HandoffToolSummary = {
      ...fileTarget,
      handoff: { accepts: [{ type: "file", format: "bin", maxBytes: 2 }] },
    };
    const fileEnvelope = createBinaryHandoffEnvelope("file", verifiedArtifact(), "bin");
    expect(proposeBinaryHandoff(fileEnvelope, strictTarget)).toMatchObject({
      compatible: false,
      reason: expect.stringContaining("handoff limit"),
    });
  });

  it("rejects unverified, incompatible image and globally oversize outputs", () => {
    const unverified = createOutputArtifactDescriptor({
      kind: "file",
      name: "a.bin",
      mime: "application/octet-stream",
      bytes: new Uint8Array([1]),
      verification: { state: "unverified" },
      fidelity: "unknown",
      fidelityNote: "Fixture.",
    });
    expect(() => createBinaryHandoffEnvelope("file", unverified)).toThrow(/verified/u);
    expect(() => createBinaryHandoffEnvelope("image", verifiedArtifact("file"))).toThrow(/image artifact/u);
    expect(() => createBinaryHandoffEnvelope("file", verifiedArtifact("file", MAX_BINARY_HANDOFF_BYTES + 1))).toThrow(/global ephemeral/u);
  });

  it("validates token and phase before accepting a binary payload message", () => {
    const envelope = createBinaryHandoffEnvelope("file", verifiedArtifact(), "bin");
    const message = { kind: "strumentini-binary-handoff-v1", token: "abc", phase: "payload", envelope };
    expect(validateBinaryHandoffMessage(message, "abc", "payload")?.envelope).toEqual(envelope);
    expect(validateBinaryHandoffMessage(message, "wrong", "payload")).toBeNull();
    expect(validateBinaryHandoffMessage(message, "abc", "ready")).toBeNull();
    expect(isBinaryHandoffEnvelope({ ...envelope, descriptor: { ...envelope.descriptor, bytes: 99 } })).toBe(false);
  });

  it("requires the exact same-origin source window and survives a structured-clone round trip", () => {
    const source = {} as Window;
    expect(isTrustedBinaryHandoffEvent(
      { origin: "https://strumentini.it", source },
      "https://strumentini.it",
      source,
    )).toBe(true);
    expect(isTrustedBinaryHandoffEvent(
      { origin: "https://evil.example", source },
      "https://strumentini.it",
      source,
    )).toBe(false);
    expect(isTrustedBinaryHandoffEvent(
      { origin: "https://strumentini.it", source: {} as Window },
      "https://strumentini.it",
      source,
    )).toBe(false);

    const envelope = createBinaryHandoffEnvelope("file", verifiedArtifact(), "bin");
    const cloned = structuredClone(envelope);
    expect(isBinaryHandoffEnvelope(cloned)).toBe(true);
    expect(cloned.payload).toEqual(envelope.payload);
  });

  it("keeps the existing CSV handoff compatibility contract unchanged", () => {
    const csvTarget: HandoffToolSummary = {
      id: "csv-target",
      route: "/tools/csv-target",
      name: "CSV target",
      handoff: { accepts: [{ type: "table", format: "csv", maxBytes: 100 }] },
    };
    const csv: TableHandoffEnvelope = {
      descriptor: {
        type: "table",
        format: "csv",
        version: 1,
        encoding: "utf-8",
        bytes: 8,
        rowCount: 1,
        columnCount: 2,
        columns: ["a", "b"],
        duplicateHeaders: false,
        raggedRows: false,
      },
      payload: "a,b\n1,2\n",
    };
    expect(proposeHandoff(csv, csvTarget).compatible).toBe(true);
  });
});
