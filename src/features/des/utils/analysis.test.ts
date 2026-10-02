import { describe, expect, it } from "vitest";
import { analyzeDesResult } from "./analysis";
import type { DesRequest } from "../types/cipher";

const request: DesRequest = {
  inputMode: "text",
  operation: "encrypt",
  key: "133457799BBCDFF1",
  text: "Chào aa",
  format: "text",
  cipherMode: "ECB",
};
describe("DES result analysis", () => {
  it("counts UTF-8 bytes and adds an entire PKCS#7 block for aligned text", () => {
    const analysis = analyzeDesResult(request, "0123456789ABCDEF0123456789ABCDEF");
    expect(analysis.plaintextBytes).toBe(8);
    expect(analysis.paddingBytes).toBe(8);
    expect(analysis.blockCount).toBe(2);
  });
  it("counts HEX bytes independently of whitespace and does not invent padding", () => {
    const analysis = analyzeDesResult(
      { ...request, format: "hex", text: "01234567 89ABCDEF" },
      "85E813540F0AB405",
    );
    expect(analysis.plaintextBytes).toBe(8);
    expect(analysis.paddingBytes).toBeNull();
    expect(analysis.blockCount).toBe(1);
  });
  it("analyzes decrypt ciphertext rather than recovered text", () => {
    const analysis = analyzeDesResult(
      { ...request, operation: "decrypt", text: "0123456789ABCDEF0123456789ABCDEF" },
      "Chào aa",
    );
    expect(analysis.blockCount).toBe(2);
    expect(analysis.paddingBytes).toBe(8);
  });
  it("does not infer file decrypt blocks from encoded file size", () => {
    const analysis = analyzeDesResult(
      {
        inputMode: "file",
        operation: "decrypt",
        key: request.key,
        file: new File(["01234567\n89ABCDEF"], "cipher.txt"),
        format: "text",
      },
      "Hello",
    );
    expect(analysis.blockCount).toBeNull();
    expect(analysis.paddingBytes).toBeNull();
  });
  it("caps displayed blocks without truncating the total count", () => {
    const analysis = analyzeDesResult(request, "0123456789ABCDEF".repeat(100));
    expect(analysis.blockCount).toBe(100);
    expect(analysis.blocks).toHaveLength(16);
  });
});
