import { readPadding, type PaddingInfo } from "../utils/padding";
import type { CipherAlgorithm } from "../types/cipher";

export interface SuccessResponse {
  success: true;
  result: string;
  padding?: PaddingInfo;
}

export interface FileCipherRequest {
  cipher: Exclude<CipherAlgorithm, "affine">;
  file: File;
  key: string;
  action: "encrypt" | "decrypt";
  stripPadding?: boolean;
}

export interface DownloadResponse {
  blob: Blob;
  filename: string;
}

const SYSTEM_ERROR = "Đã xảy ra lỗi hệ thống.";

export class CipherApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CipherApiError";
  }
}

function apiError(message: string, status: number): never {
  throw new CipherApiError(message, status);
}

function isSuccessResponse(value: unknown): value is SuccessResponse {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return body.success === true && typeof body.result === "string";
}

function isErrorResponse(value: unknown): value is { success: false; message: string } {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return body.success === false && typeof body.message === "string";
}

export async function readJsonSuccess(response: Response): Promise<SuccessResponse> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) apiError(SYSTEM_ERROR, response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    apiError(SYSTEM_ERROR, response.status);
  }

  if (response.status !== 200 || !isSuccessResponse(body)) {
    apiError(isErrorResponse(body) ? body.message : SYSTEM_ERROR, response.status);
  }
  const padding = readPadding("padding" in body ? body.padding : undefined, body.result);
  return { ...body, ...(padding ? { padding } : {}) };
}

function createFileForm(request: FileCipherRequest, responseMode: "content" | "file") {
  const data = new FormData();
  data.append("file", request.file);
  data.append("key", request.key);
  data.append("action", request.action);
  data.append("response_mode", responseMode);
  if (request.cipher === "playfair" && request.action === "decrypt")
    data.append("strip_padding", String(request.stripPadding ?? false));
  return data;
}

function attachmentFilename(disposition: string): string | null {
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return null;
    }
  }

  const quoted = disposition.match(/filename="((?:\\.|[^"])*)"/i);
  return quoted ? quoted[1].replace(/\\([\\"])/g, "$1") : null;
}

export async function transformText(
  cipher: CipherAlgorithm,
  operation: "encrypt" | "decrypt",
  body: string,
): Promise<SuccessResponse> {
  const response = await fetch(`/api/${cipher}/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return readJsonSuccess(response);
}

export async function previewFile(request: FileCipherRequest): Promise<SuccessResponse> {
  const response = await fetch(`/api/${request.cipher}/file`, {
    method: "POST",
    body: createFileForm(request, "content"),
  });
  return readJsonSuccess(response);
}

export async function readFileDownload(response: Response): Promise<DownloadResponse> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (response.status !== 200 || contentType.includes("application/json")) {
    await readJsonSuccess(response);
    apiError("Không thể tải kết quả. Vui lòng thử lại.", response.status);
  }
  if (!contentType.startsWith("text/plain")) apiError(SYSTEM_ERROR, response.status);

  const filename = attachmentFilename(response.headers.get("content-disposition") ?? "");
  if (!filename) apiError(SYSTEM_ERROR, response.status);
  return { blob: await response.blob(), filename };
}

export async function downloadFile(request: FileCipherRequest): Promise<DownloadResponse> {
  const response = await fetch(`/api/${request.cipher}/file`, {
    method: "POST",
    body: createFileForm(request, "file"),
  });
  return readFileDownload(response);
}
