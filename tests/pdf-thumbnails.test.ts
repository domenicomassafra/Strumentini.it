import { describe, expect, it } from "vitest";
import {
  PDF_THUMBNAIL_WINDOW,
  PDF_THUMBNAIL_MAX_WIDTH,
  PDF_THUMBNAIL_MAX_HEIGHT,
  pdfThumbnailWindow,
} from "../src/engines/pdf/thumbnails";

describe("ticket 215 — bounded PDF thumbnails", () => {
  it("does not eagerly materialize 200 pages", () => {
    expect(PDF_THUMBNAIL_WINDOW).toBe(4);
    expect(pdfThumbnailWindow(200, 1)).toEqual([1, 2, 3, 4]);
    expect(pdfThumbnailWindow(200, 49)).toEqual([49, 50, 51, 52]);
    expect(pdfThumbnailWindow(200, 199)).toEqual([199, 200]);
    expect(pdfThumbnailWindow(1, 1)).toEqual([1]);
    expect(PDF_THUMBNAIL_MAX_WIDTH * PDF_THUMBNAIL_MAX_HEIGHT * 4).toBeLessThan(256 * 1024);
  });
  it("refuses invalid page counts and bad page identity", () => {
    for (const [count, start] of [[0, 1], [201, 1], [3, 0], [3, 4], [2.5, 1], [3, 1.2], [Infinity, 1]] as Array<[number, number]>) {
      expect(() => pdfThumbnailWindow(count, start)).toThrow();
    }
  });
});
