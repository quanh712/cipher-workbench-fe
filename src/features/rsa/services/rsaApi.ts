import { RsaGatewayError, type RsaGateway } from "./rsaGateway";
import type { ModPowRow } from "../types/cipher";

const INVALID_RESPONSE = "Phản hồi RSA từ máy chủ không hợp lệ.";
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RsaGatewayError(INVALID_RESPONSE);
  }
  return value as JsonObject;
}

function requireValue(condition: boolean): asserts condition {
  if (!condition) throw new RsaGatewayError(INVALID_RESPONSE);
}

function decimal(value: unknown, signed = false): string {
  requireValue(typeof value === "string" && (signed ? /^-?\d+$/ : /^\d+$/).test(value));
  return value as string;
}

function integer(value: unknown): number {
  requireValue(typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
  return value as number;
}

function decimals(value: unknown): string[] {
  requireValue(Array.isArray(value) && value.length > 0);
  return (value as unknown[]).map((item) => decimal(item));
}

async function post(path: string, payload: JsonObject, signal: AbortSignal): Promise<JsonObject> {
  signal.throwIfAborted();
  const response = await fetch(`/api/rsa/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  let body: JsonObject;
  try {
    body = object(await response.json());
  } catch (error) {
    if (signal.aborted) throw error;
    throw new RsaGatewayError(INVALID_RESPONSE);
  }
  if (!response.ok || body.success !== true) {
    if (body.success === false && typeof body.message === "string" && body.message.trim()) {
      throw new RsaGatewayError(body.message);
    }
    throw new RsaGatewayError(INVALID_RESPONSE);
  }
  signal.throwIfAborted();
  return body;
}

function traceRows(value: unknown, operation: "encrypt" | "decrypt"): ModPowRow[] {
  const trace = object(value);
  requireValue(trace.operation === operation && trace.blockIndex === 0);
  decimal(trace.input);
  decimal(trace.exponent);
  decimal(trace.modulus);
  decimal(trace.result);
  requireValue(Array.isArray(trace.steps) && trace.steps.length > 0);
  return (trace.steps as unknown[]).map((item) => {
    const step = object(item);
    requireValue(step.bit === 0 || step.bit === 1);
    return {
      index: integer(step.i),
      bit: step.bit as 0 | 1,
      base: decimal(step.base),
      before: decimal(step.before),
      after: decimal(step.result),
    };
  });
}

export const rsaApi: RsaGateway = {
  async transform(parameters, signal) {
    const { operation, inputType, n } = parameters;
    const payload: JsonObject = { n, inputType, traceBlockIndex: 0 };
    if (inputType === "text") payload.mode = "char";
    if (operation === "encrypt") {
      payload.e = parameters.e;
      payload.data = parameters.data;
    } else {
      payload.d = parameters.d;
      payload.cipher = parameters.cipher;
    }
    const body = await post(operation, payload, signal);
    requireValue(body.inputType === inputType);
    requireValue(
      inputType === "text" ? body.mode === "char" && body.blockSize === 1 : body.blockSize === null,
    );
    if (inputType === "text") integer(body.originalUtf8ByteLength);
    const blocks = decimals(body.blocks);
    if (inputType === "number") requireValue(blocks.length === 1);
    let cipher: string[];
    let output: string;
    if (operation === "encrypt") {
      cipher = decimals(body.cipher);
      requireValue(cipher.length === blocks.length);
      const expectedLength = inputType === "number" ? 1 : Array.from(parameters.data).length;
      requireValue(blocks.length === expectedLength);
      output = JSON.stringify(cipher);
    } else {
      cipher = parameters.cipher;
      requireValue(blocks.length === cipher.length && typeof body.plaintext === "string");
      output = body.plaintext as string;
      if (inputType === "number") requireValue(decimal(output) === blocks[0]);
      else requireValue(Array.from(output).length === blocks.length);
    }
    return { operation, inputType, output, blocks, cipher, rows: traceRows(body.trace, operation) };
  },
  async generateKey(parameters, signal) {
    const body = await post("keys", { p: parameters.p, q: parameters.q, e: parameters.e }, signal);
    const n = decimal(body.n);
    const e = decimal(body.e);
    const d = decimal(body.d);
    const publicKey = object(body.publicKey);
    const privateKey = object(body.privateKey);
    requireValue(
      publicKey.n === n && publicKey.e === e && privateKey.n === n && privateKey.d === d,
    );
    requireValue(Array.isArray(body.egcdSteps) && body.egcdSteps.length > 0);
    const euclidRows = (body.egcdSteps as unknown[]).map((item) => {
      const step = object(item);
      integer(step.index);
      return {
        quotient: step.q === null ? null : decimal(step.q, true),
        remainder: decimal(step.r, true),
        coefficient: decimal(step.t, true),
      };
    });
    return { p: parameters.p, q: parameters.q, e, n, d, phi: decimal(body.phi), euclidRows };
  },
};
