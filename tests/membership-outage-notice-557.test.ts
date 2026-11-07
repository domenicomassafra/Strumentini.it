import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { expect, it, vi } from "vitest";

it("explains a 503 on the disabled catalogue toggle even without a membership counter", async () => {
  const component = readFileSync(new URL("../src/components/account/MembershipBootstrap.astro", import.meta.url), "utf8");
  const script = component.match(/<script>([\s\S]*?)<\/script>/u)?.[1];
  expect(script).toBeDefined();
  const compiled = ts.transpileModule(
    script!.replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/u, ""),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
  ).outputText;

  const attributes = new Map<string, string>();
  const toggle = {
    dataset: { membershipToggle: "json-formatter" },
    disabled: false,
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
  };
  const events: string[] = [];
  const sandbox = {
    fetch: async () => ({ ok: false, status: 503 }),
    navigator: { onLine: true },
    sessionStorage: { getItem: () => "previously-verified-account" },
    document: {
      querySelectorAll: (selector: string) => selector === "[data-membership-toggle]" ? [toggle] : [],
      addEventListener() {},
      dispatchEvent: (event: { type: string }) => { events.push(event.type); },
    },
    window: { addEventListener() {} },
    Event: class { constructor(public readonly type: string) {} },
    CustomEvent: class { constructor(public readonly type: string) {} },
    loadMembership: async () => ({ installed: [], recent: [] }),
    membershipBaselineOwner: async () => "previously-verified-account",
    subscribeMembership() {},
    syncMembershipWithAccount: async () => undefined,
    pushMembershipChange() {},
    toggleInstalled() {},
  };
  runInNewContext(compiled, sandbox);
  await vi.waitFor(() => expect(events).toContain("strumentini:membership-ready"));

  expect(toggle.disabled).toBe(true);
  expect(attributes.get("title")).toBe("Account temporaneamente non disponibile: riprova tra poco");
});
