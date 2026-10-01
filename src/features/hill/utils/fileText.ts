import { HILL_MAX_BYTES, HILL_SIZE_ERROR } from "./limits";

export const HILL_FILE_MAX_BYTES = HILL_MAX_BYTES;

export function validateHillFile(file: File): string | null {
  if (!/\.txt$/i.test(file.name)) return "Chỉ chấp nhận file .txt.";
  return file.size > HILL_FILE_MAX_BYTES ? HILL_SIZE_ERROR : null;
}

async function fileBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("File read failed"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export async function readHillFile(file: File): Promise<string> {
  const bytes = await fileBuffer(file);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
