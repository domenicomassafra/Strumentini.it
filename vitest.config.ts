import { configDefaults, defineConfig } from "vitest/config";
import { securityHeadersTextPlugin } from "./scripts/lib/vitest-security-headers-plugin.ts";

export default defineConfig({
  plugins: [securityHeadersTextPlugin()],
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "tests/workerd/**/*.test.ts"],
  },
});
