import { afterEach, describe, expect, it, vi } from "vitest";
import { relative } from "../src/workbench/favorite-card-view";

afterEach(() => vi.useRealTimers());

describe("#332 favourite activity time labels", () => {
  it("uses hours for an earlier event on the same local date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 18, 18, 0));
    expect(relative(new Date(2026, 9, 18, 15, 0).toISOString())).toBe("3 ore fa");
    expect(relative(new Date(2026, 9, 18, 17, 0).toISOString())).toBe("1 ora fa");
    expect(relative(new Date(2026, 9, 18, 17, 45).toISOString())).toBe("15 minuti fa");
  });

  it("uses ieri only for the previous local calendar date, even across midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 18, 0, 10));
    expect(relative(new Date(2026, 9, 17, 23, 40).toISOString())).toBe("ieri alle 23:40");
    expect(relative(new Date(2026, 9, 16, 23, 40).toISOString())).toBe("2 giorni fa");
  });

  it("shows future times explicitly and keeps now and invalid values safe", () => {
    vi.useFakeTimers();
    const now = new Date(2026, 9, 18, 12, 0);
    vi.setSystemTime(now);
    expect(relative(new Date(now.getTime() + 10_000).toISOString())).toBe("tra meno di un minuto");
    expect(relative(new Date(now.getTime() + 5 * 60_000).toISOString())).toBe("tra 5 minuti");
    expect(relative(new Date(now.getTime() + 2 * 3_600_000).toISOString())).toBe("tra 2 ore");
    expect(relative(now.toISOString())).toBe("adesso");
    expect(relative("invalid-timestamp")).toBe("");
  });
});
