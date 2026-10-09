// Worktree-only Vite test config: the shared dependency install and generated
// read-only catalog are symlinked from the existing checkout. Vite normally
// forbids @fs/ dependencies outside this worktree, preventing client hydration.
// This config widens read access only in the isolated dev acceptance process.
import base from "../astro.config.mjs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dependencies = fileURLToPath(new URL("../../Strumentini.it/node_modules/", import.meta.url));
const generated = fileURLToPath(new URL("../../Strumentini.it/src/generated/", import.meta.url));

export default {
  ...base,
  vite: {
    ...base.vite,
    server: { ...base.vite?.server, fs: { allow: [root, dependencies, generated] } },
  },
};
