import { describe, expect, it } from "vitest";
import { buildPlayfairMatrix, preparePlayfairDigraphs, suggestPlayfairPlaintext } from "./analysis";

describe("Playfair visualization", () => {
  it("builds the canonical matrix", () => {
    expect(buildPlayfairMatrix("PLAYFAIR EXAMPLE")).toEqual([
      ["P", "L", "A", "Y", "F"],
      ["I", "R", "E", "X", "M"],
      ["B", "C", "D", "G", "H"],
      ["K", "N", "O", "Q", "S"],
      ["T", "U", "V", "W", "Z"],
    ]);
  });

  it("prepares repeated letters and trailing plaintext", () => {
    expect(preparePlayfairDigraphs("BALLOON", "encrypt")).toEqual(["BA", "LX", "LO", "ON"]);
    expect(preparePlayfairDigraphs("X", "encrypt")).toEqual(["XQ"]);
  });

  it("suggests only internal duplicate fillers after Backend removes a terminal filler", () => {
    expect(suggestPlayfairPlaintext("CNTXT")).toEqual({ text: "CNTT", removedCount: 1 });
    expect(suggestPlayfairPlaintext("KHOACNTXT")).toEqual({ text: "KHOACNTT", removedCount: 1 });
    expect(suggestPlayfairPlaintext("HELXLO")).toEqual({ text: "HELLO", removedCount: 1 });
    expect(suggestPlayfairPlaintext("XQX")).toEqual({ text: "XX", removedCount: 1 });
  });

  it("does not remove another terminal character in the minimal TXTX digraph stream", () => {
    expect(suggestPlayfairPlaintext("TXT")).toEqual({ text: "TT", removedCount: 1 });
  });

  it("does not suggest deleting ordinary X/Q or malformed output", () => {
    expect(suggestPlayfairPlaintext("AXBY")).toBeNull();
    expect(suggestPlayfairPlaintext("AQAQ")).toBeNull();
    expect(suggestPlayfairPlaintext("ABX")).toBeNull();
    expect(suggestPlayfairPlaintext("HIDETHEGOLD")).toBeNull();
    expect(suggestPlayfairPlaintext("AX")).toBeNull();
    expect(suggestPlayfairPlaintext("XQ")).toBeNull();
    expect(suggestPlayfairPlaintext("HELXLO!")).toBeNull();
  });
});
