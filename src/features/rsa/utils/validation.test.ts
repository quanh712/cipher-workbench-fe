import { describe, expect, it } from "vitest";
import { decimal, validateNumber, validateParameters, validateText } from "./validation";

const draft = { p: "17", q: "11", e: "7", plaintext: "88", text: "Xin chao" };

describe("RSA input validation", () => {
  it.each(["", " ", "-1", "+1", "1.0", "1e3", "0x11", "1 7", "１２"])(
    "rejects non-decimal syntax %j",
    (value) => expect(decimal(value)).toBeNull(),
  );

  it("trims only the boundaries and keeps large integers exact", () => {
    expect(decimal("  009007199254740993\n")).toBe("009007199254740993");
    expect(validateNumber({ ...draft, plaintext: "9007199254740993" })).toEqual({});
    expect(validateNumber({ ...draft, plaintext: "0" })).toEqual({});
  });

  it("compares prime bounds and equality without rounding", () => {
    expect(validateParameters({ p: "1000000000000", q: "999999999999", e: "7" })).toEqual({});
    expect(validateParameters({ p: "1000000000001", q: "11", e: "7" })).toHaveProperty("p");
    expect(validateParameters({ p: "0017", q: "17", e: "7" })).toHaveProperty("q");
  });

  it("leaves primality and modular inverse checks to the gateway", () => {
    expect(validateParameters({ p: "15", q: "11", e: "7" })).toEqual({});
    expect(validateParameters({ p: "17", q: "11", e: "8" })).toEqual({});
  });

  it("accepts whitespace and Unicode text while rejecting an empty message", () => {
    expect(validateText({ ...draft, text: "" })).toHaveProperty("text");
    expect(validateText({ ...draft, text: " \n😀<&" })).toEqual({});
  });
});
