import { spawnSync } from "node:child_process";

const cases = [
  ["missing-oracle", "required Gold fixture family is missing"],
  ["privacy", "LOCAL privacy declaration is missing or contradictory"],
];

for (const [mode, expected] of cases) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/gold-certify.ts", "--sabotage", mode],
    { encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status === 0) {
    console.error(`Gold sabotage unexpectedly passed: ${mode}`);
    process.exit(1);
  }
  if (!output.includes(expected)) {
    console.error(`Gold sabotage ${mode} failed for the wrong reason:\n${output}`);
    process.exit(1);
  }
}
console.log("Gold sabotage PASS: oracle and privacy policy both fail closed");
