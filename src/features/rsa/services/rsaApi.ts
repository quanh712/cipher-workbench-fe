import { RsaGatewayError, type RsaGateway } from "./rsaGateway";
import type {
  ModPowRow,
  RsaParameters,
  RsaKeyResult,
  RsaTransformRequest,
  RsaTransformResult,
} from "../types/cipher";

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

async function post(
  path: string,
  payload: JsonObject | FormData,
  signal: AbortSignal,
): Promise<JsonObject> {
  signal.throwIfAborted();
  const response = await fetch(`/api/rsa/${path}`, {
    method: "POST",
    headers: payload instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
    credentials: "include",
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

function traceRows(
  value: unknown,
  operation: "encrypt" | "decrypt" | "sign" | "verify",
  blockIndex = 0,
): ModPowRow[] {
  const trace = object(value);
  requireValue(trace.operation === operation);
  if (operation === "encrypt" || operation === "decrypt")
    requireValue(trace.blockIndex === blockIndex);
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
  async signature(parameters, signal) {
    const { operation, ...payload } = parameters;
    const body = await post(`${operation}/raw`, payload, signal);
    const result = object(body.result);
    requireValue(result.mode === "raw-integer" && typeof result.warning === "string");
    requireValue(BigInt(decimal(result.m)) === BigInt(parameters.m));
    const publicKey = object(result.publicKey);
    requireValue(BigInt(decimal(publicKey.n)) === BigInt(parameters.n));
    requireValue(BigInt(decimal(publicKey.e)) === BigInt(parameters.e));
    const signature = decimal(result.signature);
    const trace = object(result.trace);
    const recoveredMessage = operation === "verify" ? decimal(result.recoveredMessage) : undefined;
    requireValue(
      BigInt(decimal(trace.input)) ===
        BigInt(operation === "sign" ? parameters.m : parameters.signature),
    );
    requireValue(
      BigInt(decimal(trace.exponent)) ===
        BigInt(operation === "sign" ? parameters.d : parameters.e),
    );
    requireValue(BigInt(decimal(trace.modulus)) === BigInt(parameters.n));
    requireValue(decimal(trace.result) === (recoveredMessage ?? signature));
    if (operation === "verify") {
      requireValue(typeof result.valid === "boolean");
      requireValue(BigInt(signature) === BigInt(parameters.signature));
    }
    const history = object(body.history);
    requireValue(
      typeof history.saved === "boolean" &&
        ["saved", "disabled", "unavailable", "capacity"].includes(history.reason as string),
    );
    if (history.saved) requireValue(integer(history.id) > 0 && history.reason === "saved");
    else requireValue(history.id === null && history.reason !== "saved");
    const kind = operation === "sign" ? "signed" : result.valid ? "valid" : "invalid";
    return {
      kind,
      signature,
      recoveredMessage,
      warning: result.warning as string,
      history: {
        saved: history.saved as boolean,
        id: history.id as number | null,
        reason: history.reason as string,
      },
      message:
        kind === "signed"
          ? "Ký thành công."
          : kind === "valid"
            ? "Chữ ký hợp lệ: thông điệp khôi phục khớp thông điệp gốc."
            : "Chữ ký không hợp lệ: thông điệp khôi phục khác thông điệp gốc.",
      steps: [],
      rows: traceRows(trace, operation),
    };
  },
  async transform(parameters, signal) {
    const { operation, inputType, n } = parameters;
    const payload: JsonObject = { n, inputType, traceBlockIndex: parameters.traceBlockIndex ?? 0 };
    if (inputType === "text") payload.mode = parameters.mode ?? "char";
    if (operation === "encrypt") {
      payload.e = parameters.e;
      payload.data = parameters.data;
    } else {
      payload.d = parameters.d;
      payload.cipher = parameters.cipher;
      if (inputType === "text" && parameters.mode === "block")
        payload.originalUtf8ByteLength = parameters.originalUtf8ByteLength;
    }
    const body = await post(operation, payload, signal);
    return transformResult(body, parameters);
  },
  async encryptFile(parameters, signal) {
    const payload = new FormData();
    payload.set("file", parameters.file);
    payload.set("e", parameters.e);
    payload.set("n", parameters.n);
    payload.set("mode", parameters.mode);
    payload.set("traceBlockIndex", String(parameters.traceBlockIndex ?? 0));
    const body = await post("encrypt", payload, signal);
    return transformResult(body, {
      operation: "encrypt",
      inputType: "text",
      n: parameters.n,
      e: parameters.e,
      mode: parameters.mode,
      traceBlockIndex: parameters.traceBlockIndex,
    });
  },
  async generateRandomKey(bits, signal) {
    const body = await post("keys/random", { bits }, signal);
    return keyResult(body, { p: decimal(body.p), q: decimal(body.q), e: decimal(body.e) });
  },
  async generateKey(parameters, signal) {
    const body = await post("keys", { p: parameters.p, q: parameters.q, e: parameters.e }, signal);
    return keyResult(body, parameters);
  },
};

function keyResult(body: JsonObject, parameters: RsaParameters): RsaKeyResult {
  const n = decimal(body.n);
  const e = decimal(body.e);
  const d = decimal(body.d);
  const publicKey = object(body.publicKey);
  const privateKey = object(body.privateKey);
  requireValue(publicKey.n === n && publicKey.e === e && privateKey.n === n && privateKey.d === d);
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
}

function transformResult(
  body: JsonObject,
  parameters:
    | (Omit<Extract<RsaTransformRequest, { operation: "encrypt" }>, "data"> & { data?: string })
    | Extract<RsaTransformRequest, { operation: "decrypt" }>,
): RsaTransformResult {
  const { operation, inputType } = parameters;
  const mode = parameters.mode ?? "char";
  requireValue(body.inputType === inputType);
  if (inputType === "text") {
    requireValue(body.mode === mode);
    const size = integer(body.blockSize);
    requireValue(mode === "char" ? size === 1 : size >= 1 && size <= 15);
    requireValue(integer(body.originalUtf8ByteLength) > 0);
  } else requireValue(body.blockSize === null);
  const blocks = decimals(body.blocks);
  if (inputType === "number") requireValue(blocks.length === 1);
  let cipher: string[];
  let output: string;
  if (operation === "encrypt") {
    cipher = decimals(body.cipher);
    requireValue(cipher.length === blocks.length);
    if (inputType === "number") requireValue(blocks.length === 1);
    else if (mode === "char" && parameters.data !== undefined)
      requireValue(blocks.length === Array.from(parameters.data).length);
    if (inputType === "text" && parameters.data !== undefined)
      requireValue(
        body.originalUtf8ByteLength === new TextEncoder().encode(parameters.data).length,
      );
    output =
      inputType === "text" && mode === "block"
        ? JSON.stringify({
            mode: "block",
            cipher,
            originalUtf8ByteLength: body.originalUtf8ByteLength,
          })
        : JSON.stringify(cipher);
  } else {
    cipher = parameters.cipher;
    requireValue(blocks.length === cipher.length && typeof body.plaintext === "string");
    output = body.plaintext as string;
    if (inputType === "number") requireValue(decimal(output) === blocks[0]);
    else {
      requireValue(new TextEncoder().encode(output).length === body.originalUtf8ByteLength);
      if (mode === "char") requireValue(Array.from(output).length === blocks.length);
      else requireValue(body.originalUtf8ByteLength === parameters.originalUtf8ByteLength);
    }
  }
  if (inputType === "text" && mode === "block")
    requireValue(
      Math.ceil(Number(body.originalUtf8ByteLength) / Number(body.blockSize)) === blocks.length,
    );
  const traceBlockIndex = parameters.traceBlockIndex ?? 0;
  requireValue(traceBlockIndex < blocks.length);
  return {
    operation,
    inputType,
    output,
    blocks,
    cipher,
    rows: traceRows(body.trace, operation, traceBlockIndex),
    traceBlockIndex,
    ...(inputType === "text"
      ? {
          mode,
          blockSize: body.blockSize as number,
          originalUtf8ByteLength: body.originalUtf8ByteLength as number,
        }
      : {}),
  };
}
