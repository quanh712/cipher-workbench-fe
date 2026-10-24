import type { StandardSignatureRequest, StandardSignatureResponse } from "../types/signature";

export const SIGNATURE_CONTENT_LIMIT = 5 * 1024 * 1024;
export const SIGNATURE_PEM_LIMIT = 64 * 1024;
export const SIGNATURE_PASSPHRASE_LIMIT = 4 * 1024;
const INVALID_RESPONSE = "Phản hồi chữ ký RSA từ máy chủ không hợp lệ.";

export class RsaSignatureApiError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "RsaSignatureApiError";
  }
}

function utf8Size(value: string, field: string): number {
  // TextEncoder replaces unpaired surrogates; the API rejects them instead.
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))
    throw new RsaSignatureApiError("Nội dung phải dùng UTF-8 hợp lệ.", field);
  return new TextEncoder().encode(value).length;
}

export function standardSignatureErrors(request: StandardSignatureRequest): Record<string, string> {
  const errors: Record<string, string> = {};
  function bounded(value: string, field: string, limit: number, label: string, empty = false) {
    try {
      const size = utf8Size(value, field);
      if (!empty && !size) errors[field] = `Nhập ${label}.`;
      else if (size > limit)
        errors[field] = `${label} vượt quá ${limit.toLocaleString("vi-VN")} byte.`;
    } catch {
      errors[field] = "Nội dung phải dùng UTF-8 hợp lệ.";
    }
  }
  if (request.source === "text") bounded(request.text, "text", SIGNATURE_CONTENT_LIMIT, "văn bản");
  else if (!request.file) errors.file = "Chọn tệp .txt.";
  else if (!/\.txt$/i.test(request.file.name)) errors.file = "Chỉ chấp nhận tệp .txt.";
  else if (!request.file.size) errors.file = "Nội dung ký không được rỗng.";
  else if (request.file.size > SIGNATURE_CONTENT_LIMIT) errors.file = "Tệp vượt quá 5 MiB.";
  if (request.operation === "sign") {
    bounded(request.privateKeyPem, "privateKeyPem", SIGNATURE_PEM_LIMIT, "private key PEM");
    bounded(request.passphrase ?? "", "passphrase", SIGNATURE_PASSPHRASE_LIMIT, "passphrase", true);
  } else {
    bounded(request.publicKeyPem, "publicKeyPem", SIGNATURE_PEM_LIMIT, "public key PEM");
    bounded(request.signature, "signature", SIGNATURE_PEM_LIMIT, "chữ ký base64");
    if (
      request.signature &&
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(request.signature)
    )
      errors.signature = "Chữ ký phải là base64 chuẩn, có padding khi cần.";
  }
  return errors;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RsaSignatureApiError(INVALID_RESPONSE);
  return value as Record<string, unknown>;
}
function requireValue(condition: boolean): asserts condition {
  if (!condition) throw new RsaSignatureApiError(INVALID_RESPONSE);
}

function readBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new RsaSignatureApiError("Không thể đọc tệp .txt.", "file"));
    reader.readAsArrayBuffer(file);
  });
}

export async function requestStandardSignature(
  request: StandardSignatureRequest,
  signal: AbortSignal,
): Promise<StandardSignatureResponse> {
  signal.throwIfAborted();
  const errors = standardSignatureErrors(request);
  const first = Object.entries(errors)[0];
  if (first) throw new RsaSignatureApiError(first[1], first[0]);
  let body: FormData | string;
  let headers: Record<string, string> | undefined;
  const fields =
    request.operation === "sign"
      ? {
          privateKeyPem: request.privateKeyPem,
          ...(request.passphrase ? { passphrase: request.passphrase } : {}),
        }
      : { signature: request.signature, publicKeyPem: request.publicKeyPem };
  if (request.source === "file") {
    const file = request.file!;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(await readBytes(file));
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof RsaSignatureApiError) throw error;
      throw new RsaSignatureApiError("Tệp .txt phải dùng UTF-8 hợp lệ.", "file");
    }
    // Send the original File; decoding is validation only and never changes signed bytes.
    body = new FormData();
    body.append("file", file);
    for (const [name, value] of Object.entries(fields))
      if (value !== undefined) body.append(name, value);
  } else {
    body = JSON.stringify({ source: "text", text: request.text, ...fields });
    headers = { "Content-Type": "application/json" };
  }
  signal.throwIfAborted();
  const response = await fetch(`/api/rsa/${request.operation}`, {
    method: "POST",
    body,
    headers,
    credentials: "include",
    cache: "no-store",
    signal,
  });
  let payload: Record<string, unknown>;
  try {
    payload = object(await response.json());
  } catch (error) {
    signal.throwIfAborted();
    throw error instanceof RsaSignatureApiError
      ? error
      : new RsaSignatureApiError(INVALID_RESPONSE);
  }
  signal.throwIfAborted();
  if (!response.ok || payload.success !== true) {
    if (payload.success === false && typeof payload.message === "string" && payload.message.trim())
      throw new RsaSignatureApiError(
        payload.message,
        typeof payload.field === "string" ? payload.field : undefined,
        typeof payload.code === "string" ? payload.code : undefined,
      );
    throw new RsaSignatureApiError(INVALID_RESPONSE);
  }
  const result = object(payload.result);
  const algorithm = object(result.algorithm);
  requireValue(
    result.mode === "standard" &&
      result.source === request.source &&
      Number.isSafeInteger(result.contentBytes) &&
      Number(result.contentBytes) > 0 &&
      Number(result.contentBytes) <= SIGNATURE_CONTENT_LIMIT &&
      typeof result.sha256 === "string" &&
      /^[a-f0-9]{64}$/.test(result.sha256),
  );
  requireValue(
    algorithm.scheme === "RSASSA-PSS" &&
      algorithm.hash === "SHA-256" &&
      algorithm.mgf === "MGF1-SHA-256" &&
      algorithm.saltLength === 32 &&
      algorithm.signatureEncoding === "base64",
  );
  if (request.operation === "sign")
    requireValue(
      typeof result.signature === "string" &&
        result.signature.length > 0 &&
        typeof result.publicKeyPem === "string" &&
        result.publicKeyPem.length > 0,
    );
  else requireValue(typeof result.valid === "boolean");
  const history = object(payload.history);
  requireValue(
    typeof history.saved === "boolean" &&
      (history.saved
        ? Number.isSafeInteger(history.id) && Number(history.id) > 0 && history.reason === "saved"
        : history.id === null &&
          ["disabled", "unavailable", "capacity"].includes(String(history.reason))),
  );
  return { result, history } as unknown as StandardSignatureResponse;
}
