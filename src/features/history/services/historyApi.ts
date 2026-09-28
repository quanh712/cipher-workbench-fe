import type { CipherAlgorithm } from "../../../shared/types/cipher";
import type { CipherMode } from "../../../shared/types/cipher";

export interface HistoryItem {
  id: number;
  createdAt: string;
  cipher: CipherAlgorithm;
  operation: CipherMode | null;
  source: "text" | "file";
  responseMode: "content" | "file" | null;
  inputLength: number | null;
  outputLength: number | null;
  httpStatus: number;
  succeeded: boolean;
  durationMs: number;
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
  operation?: CipherMode;
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

export async function getHistory(query: HistoryQuery, signal?: AbortSignal): Promise<HistoryPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (query.cipher) params.set("cipher", query.cipher);
  if (query.operation) params.set("operation", query.operation);
  if (query.cursor) params.set("cursor", query.cursor);
  const response = await fetch(`/api/history?${params}`, { signal });
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
  return body.result as HistoryPage;
}
