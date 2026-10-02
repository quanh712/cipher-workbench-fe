import { describe, expect, it } from "vitest";
import { readPadding } from "./padding";

describe("backend padding metadata", () => {
  it("uses letter positions while preserving emoji, punctuation and case", () => {
    expect(
      readPadding({ count: 2, positions: [4, 5], filtered: "😀 Ab!cd\n" }, "😀 Ab!cd\nXX")
        ?.filtered,
    ).toBe("😀 Ab!cd\n");
  });
  it.each([
    { count: 1, positions: [3], filtered: "AB" },
    { count: 2, positions: [2, 2], filtered: "AB" },
    { count: 1, positions: [2], filtered: "A" },
  ])("rejects inconsistent metadata: %j", (value) => {
    expect(() => readPadding(value, "ABX")).toThrow();
  });
  it("keeps compatibility with responses without padding", () => {
    expect(readPadding(undefined, "MAX")).toBeUndefined();
    expect(readPadding({ count: 0, positions: [], filtered: "MAX" }, "MAX")?.filtered).toBe("MAX");
  });
});
