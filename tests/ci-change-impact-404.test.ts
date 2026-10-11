import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { buildImpactPlan, collectGitChanges } from "../scripts/ci-change-impact-404";

const execFileAsync = promisify(execFile);
const suites = [
  "tests/release-validation.test.ts",
  "tests/auth-worker.test.ts",
  "tests/google-auth-worker.test.ts",
  "tests/turnstile-worker.test.ts",
  "tests/vies-worker.test.ts",
  "tests/current-revision-worker-347.test.ts",
  "tests/pdf-redaction-237.test.ts",
  "tests/pdf-image-aware-218.test.ts",
  "tests/image-resize-engine.test.ts",
  "tests/italy-2026-consumers.test.ts",
  "tests/italy-source-packs.test.ts",
];

async function fixture(run: (root: string, base: string, head: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ci-change-impact-404-"));
  try {
    await execFileAsync("git", ["init", "-q"], { cwd: root });
    await execFileAsync("git", ["-c", "user.name=CI fixture", "-c", "user.email=ci@example.invalid", "commit", "--allow-empty", "-qm", "baseline"], { cwd: root });
    const base = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "about.md"), "text\n");
    await execFileAsync("git", ["add", "."], { cwd: root });
    await execFileAsync("git", ["-c", "user.name=CI fixture", "-c", "user.email=ci@example.invalid", "commit", "-qm", "docs"], { cwd: root });
    const head = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
    await run(root, base, head);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("#404 PR/source impact planning", () => {
  it("never lets a docs-only label hide a worker auth or SQL migration", () => {
    const plan = buildImpactPlan(["docs/guide.md", "worker/index.ts", "worker/migrations/0003_auth.sql"], suites);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.domains).toEqual(expect.arrayContaining(["docs", "worker-auth", "d1"]));
    expect(plan.gates.map((gate) => gate.id)).toEqual(expect.arrayContaining(["security-review", "d1-migration-review", "release-readiness"]));
    expect(plan.gates.every((gate) => gate.status === "NOT_RUN")).toBe(true);
    expect(plan.selectedTests).toContain("tests/auth-worker.test.ts");
    expect(plan.selectedTests).toContain("tests/release-validation.test.ts");
  });

  it("maps PDF, image and Italy engines to related suites and non-waivable gates", () => {
    const plan = buildImpactPlan([
      "src/engines/pdf/redact.ts", "src/engines/image/compress.ts", "src/engines/italy/tax.ts",
    ], suites);
    expect(plan.domains).toEqual(["pdf", "image", "italy"]);
    expect(plan.selectedTests).toEqual(expect.arrayContaining([
      "tests/pdf-redaction-237.test.ts", "tests/image-resize-engine.test.ts", "tests/italy-source-packs.test.ts",
    ]));
    expect(plan.gates.map((gate) => gate.id)).toEqual(expect.arrayContaining(["physical-device", "official-source-year", "release-readiness"]));
    expect(plan.commands.some((command) => command.program === "node" && command.args[0] === "node_modules/vitest/vitest.mjs")).toBe(true);
  });

  it("classifies frontend as full regression, docs-only as no source commands", () => {
    const frontend = buildImpactPlan(["src/components/Shell.astro", "src/styles/global.css"], suites);
    expect(frontend.domains).toContain("frontend");
    expect(frontend.commands.some((command) => command.program === "npm" && command.args[1] === "test")).toBe(true);
    expect(frontend.gates.map((gate) => gate.id)).toContain("browser-a11y");
    const docs = buildImpactPlan(["README.md", "docs/guide.md"], suites);
    expect(docs.status).toBe("DOCS_ONLY");
    expect(docs.commands).toEqual([]);
    expect(docs.gates).toEqual([]);
  });

  it("propagates PDF/image UI and auth-test edits to sensitive gates, not just generic frontend", () => {
    const plan = buildImpactPlan([
      "src/components/tools/pdf/PdfTool.tsx",
      "src/components/tools/image/ImageTool.tsx",
      "tests/auth-worker.test.ts",
      "docs/changelog.md",
    ], suites);
    expect(plan.domains).toEqual(expect.arrayContaining(["frontend", "pdf", "image", "worker-auth"]));
    expect(plan.gates.map((gate) => gate.id)).toEqual(expect.arrayContaining(["physical-device", "security-review", "auth-integration"]));
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
  });

  it("does not mislabel executable ticket generators as docs-only", () => {
    const generators = buildImpactPlan([
      ".scratch/strumentini-expansion-20261005/ticket_dashboard.py",
      ".scratch/strumentini-expansion-20261005/validate_backlog.py",
    ], suites);
    expect(generators.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(generators.commands).toContainEqual({ program: "npm", args: ["run", "test"] });
    expect(generators.gates.map((gate) => gate.id)).toContain("release-readiness");
    expect(buildImpactPlan([".scratch/strumentini-expansion-20261005/issues/404-note.md"], suites).status).toBe("DOCS_ONLY");
  });

  it("marks ephemeral cross-window file transfer as security sensitive", () => {
    const plan = buildImpactPlan(["src/runtime/ephemeral-file-handoff-337.ts"], suites);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.gates.map((gate) => gate.id)).toContain("security-review");
    expect(plan.gates.map((gate) => gate.id)).toContain("release-readiness");
  });

  it("requires independent security review for hostile file preflight changes", () => {
    const plan = buildImpactPlan(["src/runtime/file-threat-gate-407.ts"], suites);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.gates.map((gate) => gate.id)).toContain("security-review");
  });

  it("requires image/PDF physical gates for the real tool component directories", () => {
    const changed = buildImpactPlan([
      "src/components/tools/image-visual/ImageCompressionTool.tsx",
      "src/components/tools/image-resize/ImageResizeTool.tsx",
      "src/components/tools/PdfMergeTool.tsx",
    ], suites);
    expect(changed.domains).toEqual(expect.arrayContaining(["image", "pdf", "frontend"]));
    expect(changed.gates.map((gate) => gate.id)).toContain("physical-device");
    expect(changed.selectedTests).toEqual(expect.arrayContaining([
      "tests/image-resize-engine.test.ts", "tests/pdf-redaction-237.test.ts",
    ]));
  });

  it("fails closed on unknown path, invalid path, missing tests and release-workflow changes", () => {
    expect(buildImpactPlan(["exotic/secret.ts"], suites).status).toBe("NO_GO");
    expect(buildImpactPlan(["../docs/guide.md"], suites).status).toBe("NO_GO");
    expect(buildImpactPlan(["src/engines/pdf/new.ts"], ["tests/release-validation.test.ts"]).status).toBe("NO_GO");
    const config = buildImpactPlan([".github/workflows/ci.yml"], suites);
    expect(config.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(config.commands.some((command) => command.args.includes("test"))).toBe(true);
  });

  it("unions base..head with unstaged, staged and untracked files, without documentation overriding code", async () => {
    await fixture(async (root, base, head) => {
      await mkdir(join(root, "worker", "migrations"), { recursive: true });
      await writeFile(join(root, "worker", "migrations", "0003_auth.sql"), "ALTER TABLE users ADD COLUMN password TEXT;\n");
      await mkdir(join(root, "src", "engines", "pdf"), { recursive: true });
      await writeFile(join(root, "src", "engines", "pdf", "new.ts"), "export const n=1;\n");
      await execFileAsync("git", ["add", "src/engines/pdf/new.ts"], { cwd: root });
      await writeFile(join(root, "docs", "about.md"), "changed unstaged\n");
      const actual = await collectGitChanges(root, base, head);
      expect(actual).toEqual([
        "docs/about.md", "src/engines/pdf/new.ts", "worker/migrations/0003_auth.sql",
      ]);
      const plan = buildImpactPlan(actual, suites);
      expect(plan.domains).toContain("d1");
      expect(plan.domains).toContain("pdf");
      expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    });
  });

  it("sees both sides of a sensitive rename and rejects missing Git history", async () => {
    await fixture(async (root, _base, head) => {
      await mkdir(join(root, "worker"), { recursive: true });
      await writeFile(join(root, "worker", "auth.ts"), "export const secure=true;\n");
      await execFileAsync("git", ["add", "."], { cwd: root });
      await execFileAsync("git", ["-c", "user.name=CI fixture", "-c", "user.email=ci@example.invalid", "commit", "-qm", "worker source"], { cwd: root });
      const base = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
      await execFileAsync("git", ["mv", "worker/auth.ts", "docs/retired.md"], { cwd: root });
      const changed = await collectGitChanges(root, base);
      expect(changed).toEqual(["docs/retired.md", "worker/auth.ts"]);
      expect(buildImpactPlan(changed, suites).domains).toContain("worker-auth");
      await expect(collectGitChanges(root, "not-an-existing-revision", head)).rejects.toThrow();
    });
  });

  it("CLI is read-only for docs and fails closed on unknown paths and absent --base", async () => {
    await fixture(async (root, base) => {
      await mkdir(join(root, "tests"), { recursive: true });
      const cli = resolve(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
      const source = resolve(import.meta.dirname, "../scripts/ci-change-impact-404.ts");
      const args = [cli, source, `--base=${base}`];
      const docs = await execFileAsync(process.execPath, args, { cwd: root });
      const plan = JSON.parse(docs.stdout) as { status: string; sourceCheckStatus: string; paths: string[] };
      expect(plan).toMatchObject({ status: "DOCS_ONLY", sourceCheckStatus: "NOT_RUN", paths: ["docs/about.md"] });

      const executedDocs = await execFileAsync(process.execPath, [...args, "--run"], { cwd: root });
      expect(JSON.parse(executedDocs.stdout)).toMatchObject({ status: "DOCS_ONLY", sourceCheckStatus: "NOT_APPLICABLE" });

      await mkdir(join(root, "unspecified"));
      await writeFile(join(root, "unspecified", "source.ts"), "export const unknown = true;\n");
      await expect(execFileAsync(process.execPath, args, { cwd: root })).rejects.toMatchObject({ code: 2 });
      await expect(execFileAsync(process.execPath, [cli, source], { cwd: root })).rejects.toMatchObject({ code: 2 });
    });
  });
});
