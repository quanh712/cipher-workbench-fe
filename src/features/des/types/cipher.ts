import type { CipherMode, InputType } from "../../../shared/types/cipher";

export type DesRequest = {
  operation: CipherMode;
  key: string;
  cipherMode?: DesMode;
  format?: DesFormat;
  iv?: string;
} & (
  | { inputMode: "text"; text: string; file?: never }
  | { inputMode: "file"; file: File; text?: never }
);

export type DesMode = "ECB" | "CBC";
export type DesFormat = "text" | "hex";
export type DesWarning =
  | { code: "W01" | "W02"; message: string; details: Record<string, never> }
  | { code: "W03"; message: string; details: { repeatedBlocks: number } };

export interface DesResult {
  warnings?: DesWarning[];
  text: string | null;
  attachment: { blob: Blob; filename: string } | null;
}

export type DesField = "input" | "file" | "key" | "iv";
export type DesFieldErrors = Partial<Record<DesField, string>>;

export interface DesDraft {
  mode: CipherMode;
  inputType: InputType;
  text: string;
  file: File | null;
  key: string;
  cipherMode: DesMode;
  format: DesFormat;
  iv: string;
}
