import { describe, expect, it } from "vitest";
import { buildPlayfairMatrix, preparePlayfairDigraphs } from "./analysis";

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
});
