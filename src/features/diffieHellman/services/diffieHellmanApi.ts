import { DiffieHellmanGatewayError, type DiffieHellmanGateway } from "./diffieHellmanGateway";
import { isDhExchangeResult } from "./validateDhResult";
import type {
  DhExchangeResult,
  DhField,
  DhParameters,
  DhPublicParameters,
  DhTrace,
} from "../types/cipher";
import { normalizeDhDecimal } from "../utils/validation";

const INVALID = "Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.";
const TIMEOUT = "Yêu cầu quá thời gian chờ. Vui lòng thử lại.";
const NETWORK = "Không thể kết nối máy chủ. Vui lòng thử lại.";
type ObjectValue = Record<string, unknown>;
const invalid = () => new DiffieHellmanGatewayError(INVALID, "INVALID_RESPONSE");

function object(value: unknown): ObjectValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid();
  return value as ObjectValue;
}
function keys(value: ObjectValue, expected: string[]) {
  if (Object.keys(value).length !== expected.length || expected.some((key) => !(key in value)))
    throw invalid();
}

function parseTrace(
  value: unknown,
  base: unknown,
  exponent: unknown,
  q: string,
  result: unknown,
): DhTrace {
  if (!Array.isArray(value) || value.length < 1 || value.length > 128) throw invalid();
  const steps = value.map((value) => {
    const row = object(value);
    keys(row, ["index", "bit", "exponentPrefix", "squared", "multiplied", "result"]);
    return row;
  });
  // Validate the mapped model before allowing it across the gateway boundary.
  return { base, exponent, modulus: q, result, steps } as unknown as DhTrace;
}

function parseExchange(
  dto: ObjectValue,
  request: DhPublicParameters & Partial<DhParameters>,
): DhExchangeResult {
  keys(dto, [
    "success",
    "privateKeyA",
    "privateKeyB",
    "publicKeyA",
    "publicKeyB",
    "sharedKeyA",
    "sharedKeyB",
    "match",
    "steps",
    "warning",
  ]);
  const warning = object(dto.warning);
  keys(warning, ["code", "message"]);
  if (
    warning.code !== "EDUCATIONAL_PRIVATE_KEYS" ||
    typeof warning.message !== "string" ||
    !warning.message.trim()
  )
    throw invalid();
  if (typeof dto.privateKeyA !== "string" || typeof dto.privateKeyB !== "string") throw invalid();
  const steps = object(dto.steps);
  keys(steps, ["publicKeyA", "publicKeyB", "sharedKeyA", "sharedKeyB"]);
  const parameters = {
    ...request,
    privateA: dto.privateKeyA,
    privateB: dto.privateKeyB,
    includeTrace: true,
  };
  if (
    (request.privateA !== undefined && request.privateA !== parameters.privateA) ||
    (request.privateB !== undefined && request.privateB !== parameters.privateB)
  )
    throw invalid();
  const result = {
    q: request.q,
    alpha: request.alpha,
    privateA: dto.privateKeyA,
    privateB: dto.privateKeyB,
    publicA: dto.publicKeyA,
    publicB: dto.publicKeyB,
    sharedA: dto.sharedKeyA,
    sharedB: dto.sharedKeyB,
    matched: dto.match,
    warning,
    traces: {
      publicA: parseTrace(
        steps.publicKeyA,
        request.alpha,
        dto.privateKeyA,
        request.q,
        dto.publicKeyA,
      ),
      publicB: parseTrace(
        steps.publicKeyB,
        request.alpha,
        dto.privateKeyB,
        request.q,
        dto.publicKeyB,
      ),
      sharedA: parseTrace(
        steps.sharedKeyA,
        dto.publicKeyB,
        dto.privateKeyA,
        request.q,
        dto.sharedKeyA,
      ),
      sharedB: parseTrace(
        steps.sharedKeyB,
        dto.publicKeyA,
        dto.privateKeyB,
        request.q,
        dto.sharedKeyB,
      ),
    },
  };
  if (!isDhExchangeResult(result, parameters)) throw invalid();
  return result;
}

const errors: Record<string, { status: number; fields: readonly (string | null)[] }> = {
  REQUEST_TOO_LARGE: { status: 413, fields: [null] },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, fields: [null] },
  NOT_INTEGER: { status: 422, fields: ["q", "alpha", "privateKeyA", "privateKeyB", "privateKey"] },
  Q_OUT_OF_RANGE: { status: 422, fields: ["q"] },
  NOT_PRIME: { status: 422, fields: ["q"] },
  ALPHA_OUT_OF_RANGE: { status: 422, fields: ["alpha"] },
  NOT_PRIMITIVE_ROOT: { status: 422, fields: ["alpha"] },
  PRIVATE_KEY_OUT_OF_RANGE: { status: 422, fields: ["privateKeyA", "privateKeyB", "privateKey"] },
  PRIVATE_KEY_WEAK: { status: 422, fields: ["privateKeyA", "privateKeyB", "privateKey"] },
  FACTORIZATION_FAILED: {
    status: 422,
    fields: ["value", "q", "bits", "privateKeyA", "privateKeyB", "privateKey"],
  },
  PRIMITIVE_ROOT_NOT_FOUND: {
    status: 422,
    fields: ["value", "q", "bits", "privateKeyA", "privateKeyB", "privateKey"],
  },
  GENERATION_FAILED: {
    status: 422,
    fields: ["value", "q", "bits", "privateKeyA", "privateKeyB", "privateKey"],
  },
  BITS_INVALID: { status: 422, fields: ["bits"] },
  PUBLIC_KEY_INVALID: { status: 422, fields: ["otherPublicKey"] },
  INVALID_ACTION: { status: 422, fields: ["action"] },
  EMPTY_INPUT: { status: 422, fields: ["data", "file"] },
  MISSING_FILE: { status: 422, fields: ["file"] },
  UNSUPPORTED_ENCODING: { status: 415, fields: ["file"] },
  FILE_READ_FAILED: { status: 500, fields: ["file"] },
  INTERNAL_ERROR: { status: 500, fields: [null] },
};
const fieldMap: Record<string, DhField> = {
  q: "q",
  alpha: "alpha",
  privateKeyA: "privateA",
  privateKeyB: "privateB",
};
function businessError(dto: ObjectValue, status: number): DiffieHellmanGatewayError {
  keys(dto, ["success", "code", "message", "field"]);
  if (
    dto.success !== false ||
    typeof dto.code !== "string" ||
    typeof dto.message !== "string" ||
    !dto.message.trim() ||
    dto.message.length > 2048 ||
    !(dto.field === null || typeof dto.field === "string")
  )
    throw invalid();
  const rule = Object.hasOwn(errors, dto.code) ? errors[dto.code] : undefined;
  if (dto.code === "FILE_INVALID") {
    if (![413, 415].includes(status) || dto.field !== "file") throw invalid();
  } else if (dto.code === "INVALID_REQUEST") {
    if (status !== 422) throw invalid();
  } else if (!rule || rule.status !== status || !rule.fields.includes(dto.field)) throw invalid();
  return new DiffieHellmanGatewayError(
    dto.message,
    dto.code,
    typeof dto.field === "string" && Object.hasOwn(fieldMap, dto.field)
      ? fieldMap[dto.field]
      : null,
  );
}

/** Deadline covers fetch AND body consumption, even if a transport ignores abort. */
export async function postDh<T>(
  path: string,
  payload: ObjectValue | FormData,
  signal: AbortSignal,
  parse: (dto: ObjectValue) => T,
): Promise<T> {
  signal.throwIfAborted();
  const controller = new AbortController();
  let rejectAbort!: (reason: unknown) => void;
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    controller.abort(signal.reason);
    rejectAbort(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    const error = new DiffieHellmanGatewayError(TIMEOUT, "TIMEOUT");
    controller.abort(error);
    rejectAbort(error);
  }, 15_000);
  try {
    return await Promise.race([
      cancelled,
      (async () => {
        let response: Response;
        try {
          response = await fetch(`/api/dh/${path}`, {
            method: "POST",
            headers:
              payload instanceof FormData
                ? { Accept: "application/json" }
                : { "Content-Type": "application/json", Accept: "application/json" },
            body: payload instanceof FormData ? payload : JSON.stringify(payload),
            cache: "no-store",
            signal: controller.signal,
          });
        } catch {
          if (controller.signal.aborted) throw controller.signal.reason;
          throw new DiffieHellmanGatewayError(NETWORK, "NETWORK_ERROR");
        }
        let dto: ObjectValue;
        try {
          if (
            !/^application\/json(?:\s*;\s*charset\s*=\s*"?utf-8"?)?\s*$/i.test(
              response.headers.get("Content-Type") ?? "",
            )
          )
            throw invalid();
          const text = await response.text();
          if (
            new TextEncoder().encode(text).length > (path === "caesar" ? 32 * 1024 * 1024 : 262144)
          )
            throw invalid();
          dto = object(JSON.parse(text));
        } catch {
          if (controller.signal.aborted) throw controller.signal.reason;
          throw invalid();
        }
        controller.signal.throwIfAborted();
        if (response.status !== 200 || dto.success !== true)
          throw businessError(dto, response.status);
        return parse(dto);
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

export const diffieHellmanApi: DiffieHellmanGateway = {
  exchange(parameters, signal) {
    const request = {
      q: normalizeDhDecimal(parameters.q),
      alpha: normalizeDhDecimal(parameters.alpha),
      ...(parameters.privateA ? { privateA: normalizeDhDecimal(parameters.privateA) } : {}),
      ...(parameters.privateB ? { privateB: normalizeDhDecimal(parameters.privateB) } : {}),
    };
    return postDh(
      "exchange",
      {
        q: request.q,
        alpha: request.alpha,
        ...(request.privateA ? { privateKeyA: request.privateA } : {}),
        ...(request.privateB ? { privateKeyB: request.privateB } : {}),
      },
      signal,
      (dto) => parseExchange(dto, request),
    );
  },
  async generatePrivateValues(parameters, signal) {
    const request = {
      q: normalizeDhDecimal(parameters.q),
      alpha: normalizeDhDecimal(parameters.alpha),
    };
    const result = await postDh("exchange", request, signal, (dto) => parseExchange(dto, request));
    return { ...request, privateA: result.privateA!, privateB: result.privateB! };
  },
};
