import { describe, expect, it } from "vitest";
import { buildImpactPlan, classifyPath } from "../scripts/ci-change-impact-404";

describe("STR-359 reviewed preview paths", () => {
  it("runs frontend checks for its three executable files", () => {
    for (const file of ["index.html", "preview.css", "preview.js"]) {
      expect(classifyPath(`design/str-359-owner-preview/${file}`)).toEqual(["frontend"]);
    }
  });

  it("recognizes only the selected README and eight review screenshots as docs", () => {
    expect(classifyPath("design/str-359-owner-preview/README.md")).toEqual(["docs"]);
    for (const variant of ["guide", "path"]) {
      for (const view of ["resources", "error"]) {
        for (const size of ["desktop", "mobile"]) {
          expect(classifyPath(`design/str-359-owner-preview/previews/${variant}-${view}-${size}.png`)).toEqual(["docs"]);
        }
      }
    }
    const unknown = buildImpactPlan(["design/str-359-owner-preview/previews/unreviewed-executable.js"], ["tests/release-validation.test.ts"]);
    expect(unknown.status).toBe("NO_GO");
  });
});
