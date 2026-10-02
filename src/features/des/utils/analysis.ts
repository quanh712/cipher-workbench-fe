import type { DesRequest } from "../types/cipher";
import { stripAsciiWhitespace, utf8ByteLength } from "./validation";

export function analyzeDesResult(request: DesRequest, result: string) {
  const encrypt = request.operation === "encrypt";
  // File decrypt input remains metadata-only; do not guess its block count from file size.
  const ciphertext = encrypt ? result : request.inputMode === "text" ? request.text : null;
  const hex = ciphertext === null ? null : stripAsciiWhitespace(ciphertext).toUpperCase();
  const validHex = hex !== null && /^[0-9A-F]+$/.test(hex) && hex.length % 16 === 0;
  const ciphertextBytes = validHex ? hex.length / 2 : null;
  const blocks: string[] = validHex ? hex.slice(0, 16 * 16).match(/.{16}/g)! : [];
  const plaintextBytes =
    request.inputMode !== "text"
      ? null
      : encrypt
        ? request.format === "hex"
          ? stripAsciiWhitespace(request.text).length / 2
          : utf8ByteLength(request.text)
        : request.format === "hex"
          ? null
          : utf8ByteLength(result);
  const paddingBytes =
    request.inputMode === "text" && request.format !== "hex" && plaintextBytes !== null
      ? encrypt
        ? 8 - (plaintextBytes % 8)
        : ciphertextBytes === null
          ? null
          : ciphertextBytes - plaintextBytes
      : null;
  return {
    ciphertextBytes,
    blockCount: ciphertextBytes === null ? null : ciphertextBytes / 8,
    plaintextBytes,
    paddingBytes,
    blocks,
  };
}
