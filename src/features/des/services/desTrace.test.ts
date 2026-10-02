import { describe, expect, it } from "vitest";
import { firstTraceBlock } from "./desTrace";
const base = { inputMode: "text", key: "133457799BBCDFF1", operation: "encrypt" } as const;
describe("first block for backend DES trace", () => {
  it("pads UTF-8 bytes rather than characters", async () => {
    expect(await firstTraceBlock({ ...base, text: "é" })).toBe("C3A9060606060606");
    expect(await firstTraceBlock({ ...base, text: "12345678" })).toBe("3132333435363738");
  });
  it("XORs the first plaintext block with IV for CBC", async () => {
    expect(
      await firstTraceBlock({
        ...base,
        text: "Hello World",
        cipherMode: "CBC",
        iv: "1234567890ABCDEF",
      }),
    ).toBe("5A513A14FF8B9A80");
  });
  it("traces ciphertext directly on decrypt and normalizes HEX", async () => {
    expect(
      await firstTraceBlock({
        ...base,
        operation: "decrypt",
        text: "85e81354 0f0ab405",
        cipherMode: "CBC",
        iv: "1234567890ABCDEF",
      }),
    ).toBe("85E813540F0AB405");
  });
});
