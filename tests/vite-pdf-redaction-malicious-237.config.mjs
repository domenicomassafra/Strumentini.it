import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dependencies = fileURLToPath(new URL("../../Strumentini.it/node_modules/", import.meta.url));
export default defineConfig({ root, server: { host: "127.0.0.1", strictPort: true,
  port: 18479, fs: { allow: [root, dependencies] } } });
