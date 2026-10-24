import type { RsaSignatureRequest, RsaSignatureResult } from "../types/signature";
import type {
  RsaKeyResult,
  RsaParameters,
  RsaTransformRequest,
  RsaTransformResult,
  RsaKeyBits,
  RsaFileRequest,
} from "../types/cipher";

/**
 * Backend boundary for the RSA workspace. All integer DTO fields are decimal strings.
 * The API adapter validates Backend DTOs and maps them to the workspace model.
 * Implementations must respect AbortSignal; the controller also discards stale responses.
 * Use RsaGatewayError for displayable business errors; other failures get a generic UI message.
 * UI code consumes results/traces as returned and never computes a local fallback.
 */
export interface RsaGateway {
  signature(parameters: RsaSignatureRequest, signal: AbortSignal): Promise<RsaSignatureResult>;
  transform(parameters: RsaTransformRequest, signal: AbortSignal): Promise<RsaTransformResult>;
  generateKey(parameters: RsaParameters, signal: AbortSignal): Promise<RsaKeyResult>;
  generateRandomKey(bits: RsaKeyBits, signal: AbortSignal): Promise<RsaKeyResult>;
  encryptFile(parameters: RsaFileRequest, signal: AbortSignal): Promise<RsaTransformResult>;
}

export class RsaGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RsaGatewayError";
  }
}
