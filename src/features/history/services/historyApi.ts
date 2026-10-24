import { readFileDownload } from "../../../shared/services/cipherApi";
import type { CipherAlgorithm } from "../../../shared/types/cipher";
import type { CipherMode } from "../../../shared/types/cipher";

export const dhHistoryOperations = {
  validate_params: "Kiểm tra tham số",
  generate_params: "Sinh tham số",
  generate_keypair: "Sinh cặp khóa",
  derive_shared_secret: "Tính bí mật chung",
  exchange: "Trao đổi khóa",
} as const;
export type DhHistoryOperation = keyof typeof dhHistoryOperations;
export type HistoryOperation = CipherMode | DhHistoryOperation | "sign" | "verify";

export interface HistoryItem {
  id: number;
  createdAt: string;
  cipher: CipherAlgorithm;
  operation: HistoryOperation | null;
  source: "text" | "file";
  responseMode: "content" | "file" | null;
  inputLength: number | null;
  outputLength: number | null;
  httpStatus: number;
  succeeded: boolean;
  durationMs: number;
  valid?: boolean | null;
  processingState?: string | null;
  contentAvailable?: boolean;
  logicalSize?: number;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

export type DatabaseStatus = "ok" | "disabled" | "unavailable";
export type HistoryStatus = "enabled" | "disabled";

export interface HealthStatus {
  database: DatabaseStatus;
  history: HistoryStatus;
}

export interface HistoryQuery {
  cipher?: CipherAlgorithm;
  operation?: HistoryOperation;
  cursor?: string;
}

export class HistoryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HistoryApiError";
  }
}

const SYSTEM_ERROR = "Không thể tải lịch sử. Vui lòng thử lại.";

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HistoryApiError(SYSTEM_ERROR, response.status);
  }
}

function readError(body: unknown, status: number): never {
  if (
    typeof body === "object" &&
    body !== null &&
    "success" in body &&
    body.success === false &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    throw new HistoryApiError(body.message, status);
  }
  throw new HistoryApiError(SYSTEM_ERROR, status);
}

export async function getHealthStatus(signal?: AbortSignal): Promise<HealthStatus> {
  const response = await fetch("/api/health", { signal });
  const body = await readBody(response);
  if (
    typeof body === "object" &&
    body !== null &&
    "success" in body &&
    body.success === true &&
    "result" in body &&
    typeof body.result === "object" &&
    body.result !== null &&
    "database" in body.result &&
    ["ok", "disabled", "unavailable"].includes(String(body.result.database)) &&
    "history" in body.result &&
    ["enabled", "disabled"].includes(String(body.result.history)) &&
    ((response.status === 200 && body.result.database !== "unavailable") ||
      (response.status === 503 && body.result.database === "unavailable"))
  ) {
    return {
      database: body.result.database as DatabaseStatus,
      history: body.result.history as HistoryStatus,
    };
  }
  return readError(body, response.status);
}

export function canShowServerHistory(health: HealthStatus): boolean {
  return health.database === "ok" && health.history === "enabled";
}

export function getHistory(query: HistoryQuery, signal?: AbortSignal): Promise<HistoryPage> {
  return readHistory("/api/history", query, signal);
}

export function getDhHistory(query: HistoryQuery, signal?: AbortSignal): Promise<HistoryPage> {
  return getHistory({ ...query, cipher: "diffie-hellman" }, signal);
}

async function readHistory(
  path: string,
  query: HistoryQuery,
  signal?: AbortSignal,
): Promise<HistoryPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (query.cipher) params.set("cipher", query.cipher === "diffie-hellman" ? "dh" : query.cipher);
  if (query.operation) params.set("operation", query.operation);
  if (query.cursor) params.set("cursor", query.cursor);
  const response = await fetch(`${path}?${params}`, {
    signal,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await readBody(response);
  if (!response.ok) return readError(body, response.status);
  if (
    typeof body !== "object" ||
    body === null ||
    !("success" in body) ||
    body.success !== true ||
    !("result" in body) ||
    typeof body.result !== "object" ||
    body.result === null ||
    !("items" in body.result) ||
    !Array.isArray(body.result.items) ||
    !("nextCursor" in body.result) ||
    (body.result.nextCursor !== null && typeof body.result.nextCursor !== "string")
  ) {
    throw new HistoryApiError(SYSTEM_ERROR, response.status);
  }
  const page = body.result as HistoryPage;
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      cipher: String(item.cipher) === "dh" ? "diffie-hellman" : item.cipher,
    })),
  };
}

export interface HistoryDetail extends HistoryItem {
  payload: Record<string, unknown>;
}

async function requestHistory(path: string, signal?: AbortSignal, method = "GET") {
  const response = await fetch(`/api/history${path}`, {
    signal,
    method,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await readBody(response);
  if (!response.ok) return readError(body, response.status);
  if (
    !body ||
    typeof body !== "object" ||
    !("success" in body) ||
    body.success !== true ||
    !("result" in body)
  )
    throw new HistoryApiError(SYSTEM_ERROR, response.status);
  return body.result;
}

export async function getHistoryDetail(id: number, signal?: AbortSignal): Promise<HistoryDetail> {
  const value = await requestHistory(`/${id}`, signal);
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    value.id !== id ||
    !("payload" in value) ||
    !value.payload ||
    typeof value.payload !== "object" ||
    Array.isArray(value.payload)
  )
    throw new HistoryApiError(SYSTEM_ERROR, 200);
  const detail = value as HistoryDetail;
  return { ...detail, cipher: String(detail.cipher) === "dh" ? "diffie-hellman" : detail.cipher };
}

export async function deleteHistoryItem(id: number, signal?: AbortSignal): Promise<void> {
  await requestHistory(`/${id}`, signal, "DELETE");
}

export async function deleteAllHistory(signal?: AbortSignal): Promise<void> {
  await requestHistory("", signal, "DELETE");
}

export async function getHistoryContent(
  id: number,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/history/${id}/content`, {
    signal,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) return readError(await readBody(response), response.status);
  return readFileDownload(response);
}
