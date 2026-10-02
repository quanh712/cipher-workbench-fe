import type { DesRequest } from "../types/cipher";

export interface DesTrace {
  operation: "encrypt" | "decrypt";
  input: string;
  key: string;
  pc1: string;
  ip: string;
  l0: string;
  r0: string;
  preOutput: string;
  subkeys: Array<{ n: number; shift: number; c: string; d: string; k: string }>;
  rounds: Array<{
    n: number;
    subkey: number;
    expansion: string;
    xorKey: string;
    sbox: Array<{ row: number; col: number; value: number }>;
    sboxOutput: string;
    f: string;
    l: string;
    r: string;
  }>;
}
const compact = (value: string) => value.replace(/[ \t\r\n\v\f]/g, "").toUpperCase();
export function xorBlock(block: string, iv: string) {
  return Array.from({ length: 8 }, (_, i) =>
    (parseInt(block.slice(i * 2, i * 2 + 2), 16) ^ parseInt(iv.slice(i * 2, i * 2 + 2), 16))
      .toString(16)
      .padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
}
export async function firstTraceBlock(request: DesRequest): Promise<string> {
  const source =
    request.inputMode === "text"
      ? request.text
      : new TextDecoder("utf-8", { fatal: true }).decode(await request.file.arrayBuffer());
  let block: string;
  if (
    request.operation === "decrypt" ||
    (request.inputMode === "text" && request.format === "hex")
  ) {
    block = compact(source).slice(0, 16);
  } else {
    const bytes = new TextEncoder().encode(source);
    const padding = 8 - (bytes.length % 8);
    block = Array.from({ length: 8 }, (_, i) => (bytes[i] ?? padding).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  if (!/^[0-9A-F]{16}$/.test(block)) throw new Error("Không lấy được khối đầu để phân tích.");
  return request.operation === "encrypt" && request.cipherMode === "CBC"
    ? xorBlock(block, compact(request.iv ?? ""))
    : block;
}
function obj(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Phản hồi trace không hợp lệ.");
  return value as Record<string, unknown>;
}
function hex(value: unknown, length: number) {
  return typeof value === "string" && new RegExp(`^[0-9A-F]{${length}}$`).test(value);
}
export async function loadDesTrace(request: DesRequest, signal: AbortSignal) {
  const block = await firstTraceBlock(request);
  signal.throwIfAborted();
  const response = await fetch("/api/des/trace", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ block, key: request.key, operation: request.operation }),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Không tải được phân tích DES.");
  const body = obj(await response.json());
  if (!response.ok || body.success !== true)
    throw new Error(
      typeof body.message === "string" ? body.message : "Không tải được phân tích DES.",
    );
  const trace = obj(body.trace);
  const lengths = { input: 16, key: 16, pc1: 14, ip: 16, l0: 8, r0: 8, preOutput: 16 };
  if (
    !hex(body.result, 16) ||
    trace.operation !== request.operation ||
    trace.input !== block ||
    trace.key !== compact(request.key) ||
    !Object.entries(lengths).every(([field, length]) => hex(trace[field], length)) ||
    !Array.isArray(trace.subkeys) ||
    trace.subkeys.length !== 16 ||
    !Array.isArray(trace.rounds) ||
    trace.rounds.length !== 16
  )
    throw new Error("Phản hồi trace không hợp lệ.");
  trace.subkeys.forEach((item, i) => {
    const k = obj(item);
    if (
      k.n !== i + 1 ||
      ![1, 2].includes(Number(k.shift)) ||
      !hex(k.c, 7) ||
      !hex(k.d, 7) ||
      !hex(k.k, 12)
    )
      throw new Error("Phản hồi khóa con không hợp lệ.");
  });
  trace.rounds.forEach((item, i) => {
    const r = obj(item);
    if (
      r.n !== i + 1 ||
      r.subkey !== (request.operation === "encrypt" ? i + 1 : 16 - i) ||
      !hex(r.expansion, 12) ||
      !hex(r.xorKey, 12) ||
      ![r.sboxOutput, r.f, r.l, r.r].every((v) => hex(v, 8)) ||
      !Array.isArray(r.sbox) ||
      r.sbox.length !== 8 ||
      !r.sbox.every((item) => {
        const box = obj(item);
        return [
          [box.row, 3],
          [box.col, 15],
          [box.value, 15],
        ].every(([v, max]) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= Number(max));
      })
    )
      throw new Error("Phản hồi vòng DES không hợp lệ.");
  });
  return { trace: trace as unknown as DesTrace, result: body.result as string };
}
