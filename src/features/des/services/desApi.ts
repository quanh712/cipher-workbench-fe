import { CipherApiError, readFileDownload } from "../../../shared/services/cipherApi";
import type { DesRequest, DesWarning } from "../types/cipher";
import { DesGatewayError, type DesGateway } from "./desGateway";

const SYSTEM_ERROR = "Đã xảy ra lỗi hệ thống.";

function isWarning(value: unknown): value is DesWarning {
  if (
    typeof value !== "object" ||
    value === null ||
    !("code" in value) ||
    !("message" in value) ||
    typeof value.message !== "string" ||
    !("details" in value)
  )
    return false;
  const details = value.details;
  if (typeof details !== "object" || details === null || Array.isArray(details)) return false;
  if (value.code === "W01" || value.code === "W02") return Object.keys(details).length === 0;
  return (
    value.code === "W03" &&
    "repeatedBlocks" in details &&
    typeof details.repeatedBlocks === "number" &&
    Number.isInteger(details.repeatedBlocks) &&
    details.repeatedBlocks > 0
  );
}

async function readDes(response: Response) {
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
    throw new DesGatewayError(SYSTEM_ERROR);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DesGatewayError(SYSTEM_ERROR);
  }
  if (typeof body !== "object" || body === null) throw new DesGatewayError(SYSTEM_ERROR);
  if (
    "success" in body &&
    body.success === false &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim()
  )
    throw new DesGatewayError(body.message);
  if (
    response.status !== 200 ||
    !("success" in body) ||
    body.success !== true ||
    !("result" in body) ||
    typeof body.result !== "string" ||
    !("warnings" in body) ||
    !Array.isArray(body.warnings) ||
    !body.warnings.every(isWarning)
  )
    throw new DesGatewayError(SYSTEM_ERROR);
  const warnings = body.warnings;
  const codes = warnings.map((warning) => warning.code);
  if (new Set(codes).size !== codes.length || codes.join() !== [...codes].sort().join())
    throw new DesGatewayError(SYSTEM_ERROR);
  return { text: body.result, warnings, attachment: null };
}

function fileForm(request: DesRequest, responseMode: "content" | "file") {
  if (request.inputMode !== "file") throw new DesGatewayError(SYSTEM_ERROR);
  const body = new FormData();
  body.append("file", request.file);
  body.append("key", request.key);
  body.append("action", request.operation);
  body.append("mode", request.cipherMode ?? "ECB");
  if (request.cipherMode === "CBC") body.append("iv", request.iv ?? "");
  body.append("response_mode", responseMode);
  return body;
}

export const desApi: DesGateway = {
  kind: "api",
  async process(request, signal) {
    if (request.inputMode === "file") {
      return readDes(
        await fetch("/api/des/file", {
          method: "POST",
          body: fileForm(request, "content"),
          signal,
        }),
      );
    }
    const options = {
      mode: request.cipherMode ?? "ECB",
      ...(request.cipherMode === "CBC" ? { iv: request.iv } : {}),
    };
    const body = {
      text: request.text,
      key: request.key,
      ...options,
      ...(request.operation === "encrypt"
        ? { inputFormat: request.format ?? "text" }
        : { outputFormat: request.format ?? "text" }),
    };
    return readDes(
      await fetch(`/api/des/${request.operation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
    );
  },
  async download(request, signal) {
    const response = await fetch("/api/des/file", {
      method: "POST",
      body: fileForm(request, "file"),
      signal,
    });
    try {
      return await readFileDownload(response);
    } catch (error) {
      if (error instanceof CipherApiError) throw new DesGatewayError(error.message);
      throw error;
    }
  },
};
