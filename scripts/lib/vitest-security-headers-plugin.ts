import { readFileSync } from "node:fs";

// Vite/Vitest treat extensionless Cloudflare Text modules as JavaScript without this loader.
export function securityHeadersTextPlugin() {
  return {
    name: "security-headers-text-module",
    enforce: "pre" as const,
    load(id: string) {
      if (id.endsWith("/public/_headers")) return `export default ${JSON.stringify(readFileSync(id, "utf8"))}`;
      return undefined;
    },
  };
}
