/** Strict SPDX-expression metadata grammar for the locked #366 audit.
 * Recognition of an identifier never certifies legal distribution rights. */
const SPDX_IDS = new Set([
  "MIT", "Apache-2.0", "OFL-1.1", "ISC", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "Zlib",
  "Python-2.0", "CC-BY-4.0", "CC0-1.0", "BlueOak-1.0.0",
  "MPL-2.0", "LGPL-3.0", "LGPL-3.0-or-later", "AGPL-3.0-or-later", "GPL-2.0",
]);

/** 0BSD is the official SPDX identifier (https://spdx.org/licenses/0BSD.html),
 * recorded by the real installed tslib@2.8.1; it is not a rights clearance. */
export function knownSpdx366(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  // Never strip parentheses and accept malformed declarations by accident.
  const tokens = value.match(/\(|\)|[A-Za-z0-9.+-]+/gu) ?? [];
  if (!tokens.length || tokens.join("") !== value.replace(/\s+/gu, "")) return false;
  let index = 0;
  function operand(): boolean {
    const token = tokens[index++];
    if (token === "(") {
      if (!expression() || tokens[index] !== ")") return false;
      index++;
      return true;
    }
    return token !== undefined && SPDX_IDS.has(token);
  }
  function expression(): boolean {
    if (!operand()) return false;
    while (tokens[index] === "AND" || tokens[index] === "OR") {
      index++;
      if (!operand()) return false;
    }
    return true;
  }
  return expression() && index === tokens.length;
}
