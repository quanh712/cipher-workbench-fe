import { DiffieHellmanGatewayError } from "./diffieHellmanGateway";
import { postDh } from "./diffieHellmanApi";
import type { DhTraceRow } from "../types/cipher";

type Decimal = string;
export type DhBits = 16 | 32 | 64 | 128;
export interface DhPrimitiveRootCheck {
  factor: Decimal;
  exponent: Decimal;
  result: Decimal;
  passes: boolean;
}
export interface DhParamsResponse {
  success: true;
  q: Decimal;
  alpha: Decimal | null;
  factors: Decimal[];
  primitiveRootChecks: DhPrimitiveRootCheck[];
  suggestedAlpha: Decimal | null;
}
export interface DhRandomParamsResponse extends Omit<DhParamsResponse, "alpha"> {
  p: Decimal;
  alpha: Decimal;
  suggestedAlpha: null;
}
export interface DhKeypairResponse {
  success: true;
  privateKey: Decimal;
  publicKey: Decimal;
  steps: DhTraceRow[];
}
export interface DhSharedSecretResponse {
  success: true;
  sharedKey: Decimal;
  steps: DhTraceRow[];
}
export interface DhCaesarResponse {
  success: true;
  sharedKey: Decimal;
  shift: Decimal;
  result: string;
  warning?: { code: "SHIFT_ZERO"; message: string };
}
type SharedRequest = { q: Decimal; privateKey: Decimal; otherPublicKey: Decimal };
type CaesarRequest = SharedRequest & { action: "encrypt" | "decrypt" } & (
    { data: string; file?: never } | { file: File; data?: never }
  );
const invalid = () => {
  throw new DiffieHellmanGatewayError(
    "Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.",
    "INVALID_RESPONSE",
  );
};
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  return v as Record<string, unknown>;
}
function shape(v: Record<string, unknown>, names: string[]) {
  if (Object.keys(v).length !== names.length || names.some((n) => !Object.hasOwn(v, n))) invalid();
}
function decimal(v: unknown): v is Decimal {
  return typeof v === "string" && /^(0|[1-9][0-9]{0,38})$/.test(v) && BigInt(v) <= 2n ** 128n - 1n;
}
function steps(v: unknown) {
  if (!Array.isArray(v) || v.length < 1 || v.length > 128) return invalid();
  v.forEach((x, index) => {
    const row = obj(x);
    shape(row, ["index", "bit", "exponentPrefix", "squared", "multiplied", "result"]);
    if (
      row.index !== index ||
      (row.bit !== 0 && row.bit !== 1) ||
      !decimal(row.exponentPrefix) ||
      !decimal(row.squared) ||
      !decimal(row.result) ||
      (row.bit === 0 ? row.multiplied !== null : !decimal(row.multiplied))
    )
      invalid();
  });
}
function params(v: Record<string, unknown>, random = false) {
  shape(v, [
    "success",
    "q",
    "alpha",
    "factors",
    "primitiveRootChecks",
    "suggestedAlpha",
    ...(random ? ["p"] : []),
  ]);
  if (
    !decimal(v.q) ||
    !(v.alpha === null || decimal(v.alpha)) ||
    !(v.suggestedAlpha === null || decimal(v.suggestedAlpha)) ||
    !Array.isArray(v.factors) ||
    !v.factors.every(decimal) ||
    !Array.isArray(v.primitiveRootChecks)
  )
    invalid();
  (v.primitiveRootChecks as unknown[]).forEach((x) => {
    const c = obj(x);
    shape(c, ["factor", "exponent", "result", "passes"]);
    if (
      !decimal(c.factor) ||
      !decimal(c.exponent) ||
      !decimal(c.result) ||
      typeof c.passes !== "boolean"
    )
      invalid();
  });
  if (random && (!decimal(v.p) || !decimal(v.alpha) || v.suggestedAlpha !== null)) invalid();
}
export const dhOperations = {
  params(input: { q: Decimal; alpha?: Decimal }, signal: AbortSignal): Promise<DhParamsResponse> {
    return postDh("params", input, signal, (v) => {
      params(v);
      return v as unknown as DhParamsResponse;
    });
  },
  randomParams(input: { bits: DhBits }, signal: AbortSignal): Promise<DhRandomParamsResponse> {
    return postDh("params/random", input, signal, (v) => {
      params(v, true);
      return v as unknown as DhRandomParamsResponse;
    });
  },
  keypair(
    input: { q: Decimal; alpha: Decimal; privateKey?: Decimal },
    signal: AbortSignal,
  ): Promise<DhKeypairResponse> {
    return postDh("keypair", input, signal, (v) => {
      shape(v, ["success", "privateKey", "publicKey", "steps"]);
      if (!decimal(v.privateKey) || !decimal(v.publicKey)) invalid();
      steps(v.steps);
      return v as unknown as DhKeypairResponse;
    });
  },
  sharedSecret(input: SharedRequest, signal: AbortSignal): Promise<DhSharedSecretResponse> {
    return postDh("shared-secret", input, signal, (v) => {
      shape(v, ["success", "sharedKey", "steps"]);
      if (!decimal(v.sharedKey)) invalid();
      steps(v.steps);
      return v as unknown as DhSharedSecretResponse;
    });
  },
  caesar(input: CaesarRequest, signal: AbortSignal): Promise<DhCaesarResponse> {
    let payload: Record<string, unknown> | FormData = input;
    if (input.file) {
      const form = new FormData();
      form.set("file", input.file);
      form.set("q", input.q);
      form.set("privateKey", input.privateKey);
      form.set("otherPublicKey", input.otherPublicKey);
      form.set("action", input.action);
      payload = form;
    }
    return postDh("caesar", payload, signal, (v) => {
      shape(v, [
        "success",
        "sharedKey",
        "shift",
        "result",
        ...(Object.hasOwn(v, "warning") ? ["warning"] : []),
      ]);
      if (
        !decimal(v.sharedKey) ||
        !decimal(v.shift) ||
        BigInt(v.shift) > 25n ||
        typeof v.result !== "string"
      )
        invalid();
      if (Object.hasOwn(v, "warning")) {
        const w = obj(v.warning);
        shape(w, ["code", "message"]);
        if (
          w.code !== "SHIFT_ZERO" ||
          typeof w.message !== "string" ||
          !w.message.trim() ||
          v.shift !== "0"
        )
          invalid();
      }
      return v as unknown as DhCaesarResponse;
    });
  },
};
