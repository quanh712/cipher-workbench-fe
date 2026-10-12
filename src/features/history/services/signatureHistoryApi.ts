import { HistoryApiError, type HistoryItem } from "./historyApi";

export interface VerificationDraft {
  m: string;
  signature: string;
  e: string;
  n: string;
}
export interface SignatureHistoryItem extends Omit<HistoryItem, "operation"> {
  operation: "sign" | "verify";
  valid: boolean | null;
  processingState: string;
}
export interface SignatureHistoryDetail extends SignatureHistoryItem {
  payload: Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HistoryApiError("Phản hồi lịch sử chữ ký không hợp lệ.", 200);
  return value as Record<string, unknown>;
}
function item(value: unknown): SignatureHistoryItem {
  const row = object(value);
  if (
    !Number.isSafeInteger(row.id) ||
    typeof row.createdAt !== "string" ||
    !Number.isFinite(Date.parse(row.createdAt)) ||
    row.cipher !== "rsa" ||
    !["sign", "verify"].includes(String(row.operation)) ||
    !["text", "file"].includes(String(row.source)) ||
    typeof row.succeeded !== "boolean" ||
    typeof row.httpStatus !== "number" ||
    typeof row.durationMs !== "number" ||
    ![null, true, false].includes(row.valid as boolean | null)
  )
    throw new HistoryApiError("Phản hồi lịch sử chữ ký không hợp lệ.", 200);
  return row as unknown as SignatureHistoryItem;
}
async function request(path: string, signal?: AbortSignal, method = "GET") {
  const response = await fetch(`/api/rsa/history${path}`, {
    signal,
    method,
    credentials: "same-origin",
    cache: "no-store",
  });
  let body: Record<string, unknown>;
  try {
    body = object(await response.json());
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new HistoryApiError(
      "Không thể đọc phản hồi lịch sử chữ ký. Vui lòng thử lại.",
      response.status,
    );
  }
  if (!response.ok || body.success !== true)
    throw new HistoryApiError(
      response.status === 404
        ? "Bản ghi đã hết hạn, bị xóa hoặc lịch sử chữ ký chưa được bật."
        : typeof body.message === "string"
          ? body.message
          : "Không thể tải lịch sử chữ ký. Vui lòng thử lại.",
      response.status,
    );
  return body.result;
}
export async function getSignatureHistory(
  operation: "sign" | "verify",
  cursor?: string,
  signal?: AbortSignal,
): Promise<{ items: SignatureHistoryItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: "20", cipher: "rsa", operation });
  if (cursor) params.set("cursor", cursor);
  const page = object(await request(`?${params}`, signal));
  if (
    !Array.isArray(page.items) ||
    (page.nextCursor !== null && typeof page.nextCursor !== "string")
  )
    throw new HistoryApiError("Phản hồi lịch sử chữ ký không hợp lệ.", 200);
  return { items: page.items.map(item), nextCursor: page.nextCursor as string | null };
}
export async function getSignatureDetail(
  id: number,
  signal?: AbortSignal,
): Promise<SignatureHistoryDetail> {
  const detail = object(await request(`/${id}`, signal));
  return { ...item(detail), payload: object(detail.payload) };
}
export async function deleteSignature(id: number, signal?: AbortSignal): Promise<void> {
  await request(`/${id}`, signal, "DELETE");
}
export function verificationDraft(detail: SignatureHistoryDetail): VerificationDraft | null {
  const { numeric_input: input, public_key: key, signature, result } = detail.payload;
  if (
    !input ||
    typeof input !== "object" ||
    !key ||
    typeof key !== "object" ||
    !result ||
    typeof result !== "object" ||
    !("mode" in result) ||
    result.mode !== "raw-integer" ||
    !("m" in input) ||
    !("e" in key) ||
    !("n" in key)
  )
    return null;
  const values = [input.m, signature, key.e, key.n];
  if (!values.every((value) => typeof value === "string" && /^\d{1,128}$/.test(value))) return null;
  return { m: String(input.m), signature: String(signature), e: String(key.e), n: String(key.n) };
}
