import type { ToolManifest } from "../../catalog/manifest";

export const keyboardEventDiagnosticManifest = {
  id: "keyboard-event-diagnostic",
  route: "/tools/keyboard-event-diagnostic",
  name: "Keyboard Event Diagnostic",
  summary: "Inspect focused keyboard events locally with bounded ephemeral history and no shortcut trapping or typed-content persistence.",
  aliases: ["keyboard event tester", "key code inspector", "keydown debugger", "keyup diagnostic"],
  jobs: ["inspect keyboard events", "inspect key and code", "debug keyboard modifiers and composition"],
  category: "developer",
  inputTypes: ["keyboard-event"],
  implementation: "../tools/keyboard-event-diagnostic/module.ts",
  engine: "browser-diagnostics",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["reset"] },
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-220",
    fixtureFamilies: ["browser-diagnostics"],
  },
} as const satisfies ToolManifest;

export default keyboardEventDiagnosticManifest;
