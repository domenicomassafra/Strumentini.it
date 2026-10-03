/**
 * The theme contract, in one place.
 *
 * Three states, stored as one string:
 *   absent    → light. The designed world is what a visitor gets by default,
 *               whatever their operating system prefers.
 *   "light"   → light, chosen explicitly.
 *   "dark"    → dark, chosen explicitly.
 *   "system"  → follow the operating system, chosen explicitly in /impostazioni.
 *
 * The boot script is inlined in `<head>` before the stylesheet paints, so a
 * choice never flashes the other ground.
 */

export const THEME_STORAGE_KEY = "strumentiutili:theme:v1";

export type ThemeChoice = "light" | "dark" | "system";

/** The two grounds a resolved choice can land on. */
export type ResolvedTheme = "light" | "dark";

export function resolveTheme(stored: string | null, systemPrefersDark: boolean): ResolvedTheme {
  if (stored === "dark") return "dark";
  if (stored === "system") return systemPrefersDark ? "dark" : "light";
  return "light";
}

/**
 * Runs before first paint. Kept as a string because it must stay inline: a
 * bundled module script is deferred and would let the wrong ground paint first.
 */
export function themeBootScript(storageKey: string): string {
  return `(function(){try{var c=localStorage.getItem(${JSON.stringify(storageKey)});var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=c==="dark"||c==="system"?(c==="dark"?"dark":(d?"dark":"light")):"light";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`;
}
