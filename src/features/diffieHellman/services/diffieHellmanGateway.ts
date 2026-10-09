import type {
  DhExchangeRequest,
  DhExchangeResult,
  DhField,
  DhPrivateValuesResult,
  DhPublicParameters,
} from "../types/cipher";

/**
 * Backend boundary for the educational Diffie–Hellman workspace.
 * The HTTP API adapter validates DTOs and maps snake_case to these camelCase models.
 * All mathematical values are decimal strings; results and traces come only from Backend.
 * Implementations must respect AbortSignal; the controller must also discard stale responses.
 * No local DH calculation, random generation, persistence or production fixture fallback.
 */
export interface DiffieHellmanGateway {
  exchange(parameters: DhExchangeRequest, signal: AbortSignal): Promise<DhExchangeResult>;
  generatePrivateValues(
    parameters: DhPublicParameters,
    signal: AbortSignal,
  ): Promise<DhPrivateValuesResult>;
}

/** Only validated business errors may supply a displayable Backend message. */
export class DiffieHellmanGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field: DhField | null = null,
  ) {
    super(message);
    this.name = "DiffieHellmanGatewayError";
  }
}
