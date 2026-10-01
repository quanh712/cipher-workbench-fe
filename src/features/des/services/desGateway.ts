import type { DesField, DesRequest, DesResult } from "../types/cipher";

export interface DesGateway {
  readonly kind?: "api" | "demo";
  download?(request: DesRequest, signal: AbortSignal): Promise<{ blob: Blob; filename: string }>;
  process(request: DesRequest, signal: AbortSignal): Promise<DesResult>;
}

// Only a validated gateway error is allowed to provide a user-facing message.
export class DesGatewayError extends Error {
  constructor(
    message: string,
    public readonly field?: DesField,
  ) {
    super(message);
    this.name = "DesGatewayError";
  }
}

export function isDesResult(value: unknown): value is DesResult {
  if (typeof value !== "object" || value === null) return false;
  if (!("text" in value) || !("attachment" in value)) return false;
  if (value.text !== null && typeof value.text !== "string") return false;
  const attachment = value.attachment;
  return (
    attachment === null ||
    (typeof attachment === "object" &&
      "blob" in attachment &&
      attachment.blob instanceof Blob &&
      "filename" in attachment &&
      typeof attachment.filename === "string" &&
      attachment.filename.length > 0)
  );
}
