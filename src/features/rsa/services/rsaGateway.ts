import type { RsaKeyResult, RsaNumberResult, RsaParameters, RsaTextResult } from "../types/cipher";

// UI contract only. The API adapter will map this to the official Backend DTO when available.
export interface RsaGateway {
  generateKey(parameters: RsaParameters, signal: AbortSignal): Promise<RsaKeyResult>;
  roundTripNumber(
    parameters: RsaParameters & { plaintext: string },
    signal: AbortSignal,
  ): Promise<RsaNumberResult>;
  roundTripText(
    parameters: RsaParameters & { text: string },
    signal: AbortSignal,
  ): Promise<RsaTextResult>;
}

export class RsaGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RsaGatewayError";
  }
}
