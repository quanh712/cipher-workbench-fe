import type { HillKeyInputMode, HillKeyPayload, HillMatrix, HillSize } from "../types/cipher";
import { HILL_MAX_BYTES, HILL_SIZE_ERROR } from "./limits";

export const DEFAULT_HILL_MATRIX = [
  ["3", "3"],
  ["2", "5"],
];

export interface HillKeyValidation {
  payload: HillKeyPayload | null;
  matrix: HillMatrix | null;
  error: string | null;
  badCell: [number, number] | null;
}

export function mod26(value: number): number {
  return ((value % 26) + 26) % 26;
}

export function keywordMatrix(keyword: string, m: HillSize): HillMatrix | null {
  if (keyword.length !== m * m || !/^[A-Za-z]+$/.test(keyword)) return null;
  const values = [...keyword.toUpperCase()].map((letter) => letter.charCodeAt(0) - 65);
  return Array.from({ length: m }, (_, row) => values.slice(row * m, (row + 1) * m));
}

export function validateHillKey(
  m: HillSize,
  inputMode: HillKeyInputMode,
  rawMatrix: string[][],
  keyword: string,
): HillKeyValidation {
  if (inputMode === "keyword") {
    const matrix = keywordMatrix(keyword, m);
    if (matrix) return { payload: { keyword, m }, matrix, error: null, badCell: null };
    const count = [...keyword].filter((character) => /[A-Za-z]/.test(character)).length;
    return {
      payload: null,
      matrix: null,
      error: `Từ khóa cần đúng ${m * m} chữ cái, hiện có ${count}.`,
      badCell: null,
    };
  }

  const key: HillMatrix = [];
  for (let row = 0; row < m; row += 1) {
    const parsedRow: number[] = [];
    for (let column = 0; column < m; column += 1) {
      const raw = rawMatrix[row]?.[column]?.trim() ?? "";
      const value = Number(raw);
      if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(value)) {
        return {
          payload: null,
          matrix: null,
          error: `Ô hàng ${row + 1} cột ${column + 1} phải là số nguyên.`,
          badCell: [row, column],
        };
      }
      parsedRow.push(value);
    }
    key.push(parsedRow);
  }
  return { payload: { key }, matrix: key.map((row) => row.map(mod26)), error: null, badCell: null };
}

export function validateHillText(text: string): string | null {
  if (new TextEncoder().encode(text).byteLength > HILL_MAX_BYTES) return HILL_SIZE_ERROR;
  return text.trim() ? null : "Nhập văn bản hoặc tải file .txt để bắt đầu.";
}
