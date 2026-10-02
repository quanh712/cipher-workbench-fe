import type {
  HillAnalyzeResponse,
  HillBlock,
  HillErrorBody,
  HillKeyAnalysis,
  HillKeyPayload,
  HillMatrix,
  HillProcessResponse,
  HillWarning,
} from "../types/cipher";
import type { HillGateway } from "./hillGateway";

import { readPadding } from "../../../shared/utils/padding";
import { countHillLetters } from "../utils/textClusters";

const UNAVAILABLE = "Không kết nối được máy chủ. Thử lại.";

export class HillApiError extends Error {
  constructor(
    readonly detail: HillErrorBody,
    readonly status: number,
  ) {
    super(detail.message);
    this.name = "HillApiError";
  }
}

const genericError = (status = 0) =>
  new HillApiError({ code: "NETWORK", message: UNAVAILABLE }, status);

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function matrix(value: unknown, size: number): HillMatrix {
  if (!Array.isArray(value) || value.length !== size) throw genericError();
  if (
    !value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === size &&
        row.every((n) => Number.isInteger(n) && n >= 0 && n < 26),
    )
  )
    throw genericError();
  return value as HillMatrix;
}

function keyAnalysis(value: unknown): HillKeyAnalysis {
  const data = object(value);
  if (
    !data ||
    ![2, 3, 4].includes(data.m as number) ||
    !Number.isInteger(data.det) ||
    Number(data.det) < 0 ||
    Number(data.det) > 25 ||
    data.gcd !== 1
  )
    throw genericError();
  const m = data.m as 2 | 3 | 4;
  if (
    !Number.isInteger(data.detInverse) ||
    Number(data.detInverse) < 0 ||
    Number(data.detInverse) > 25
  )
    throw genericError();
  return {
    matrix: matrix(data.matrix, m),
    m,
    det: data.det as number,
    gcd: data.gcd as number,
    detInverse: data.detInverse as number,
    adjugate: matrix(data.adjugate, m),
    inverse: matrix(data.inverse, m),
  };
}

function expectedSize(payload: HillKeyPayload): number {
  return payload.key ? payload.key.length : payload.m;
}

function checkedKey(value: unknown, expected: number): HillKeyAnalysis {
  const key = keyAnalysis(value);
  if (key.m !== expected) throw genericError();
  return key;
}

function warnings(value: unknown): HillWarning[] {
  if (!Array.isArray(value)) throw genericError();
  return value.map((item) => {
    const data = object(item);
    if (
      !data ||
      !["W01", "W02", "W03"].includes(String(data.code)) ||
      typeof data.message !== "string"
    )
      throw genericError();
    const details = object(data.details);
    if (!details) throw genericError();
    return {
      code: data.code as HillWarning["code"],
      message: data.message,
      details,
    };
  });
}

function blocks(value: unknown, size: number): HillBlock[] {
  if (!Array.isArray(value)) throw genericError();
  return value.map((item) => {
    const data = object(item);
    if (
      !data ||
      !Array.isArray(data.input) ||
      !Array.isArray(data.output) ||
      data.input.length !== size ||
      data.output.length !== size ||
      ![...data.input, ...data.output].every((n) => Number.isInteger(n) && n >= 0 && n < 26)
    )
      throw genericError();
    return { input: data.input as number[], output: data.output as number[] };
  });
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/hill/${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw genericError();
  }
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("application/json"))
    throw genericError(response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw genericError(response.status);
  }
  if (!response.ok) {
    const error = object(body);
    if (
      !error ||
      error.success !== false ||
      typeof error.message !== "string" ||
      (error.code !== undefined && (typeof error.code !== "string" || !object(error.details)))
    )
      throw genericError(response.status);
    throw new HillApiError(
      {
        code: typeof error.code === "string" ? error.code : "SYSTEM",
        message: error.message,
        details: object(error.details) ?? undefined,
      },
      response.status,
    );
  }
  if (response.status !== 200) throw genericError(response.status);
  return body;
}

const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

export const hillApi: HillGateway = {
  async analyze(payload, signal): Promise<HillAnalyzeResponse> {
    const data = object(await request("key/analyze", post(payload, signal)));
    if (!data || data.success !== true) throw genericError();
    return {
      success: true,
      result: checkedKey(data.result, expectedSize(payload)),
      warnings: warnings(data.warnings),
    };
  },
  async random(m, signal) {
    const data = object(await request(`key/random?m=${m}`, { signal }));
    if (!data || data.success !== true) throw genericError();
    return { success: true, result: checkedKey(data.result, m), warnings: warnings(data.warnings) };
  },
  async process(mode, payload): Promise<HillProcessResponse> {
    const data = object(await request(mode, post(payload)));
    if (!data || data.success !== true || typeof data.result !== "string") throw genericError();
    const key = checkedKey(data.key, expectedSize(payload));
    const parsedBlocks = blocks(data.blocks, key.m);
    if (countHillLetters(data.result) !== parsedBlocks.length * key.m) throw genericError();
    return {
      success: true,
      result: data.result,
      key,
      blocks: parsedBlocks,
      padding: mode === "decrypt" ? readPadding(data.padding, data.result) : undefined,
      warnings: warnings(data.warnings),
    };
  },
};
