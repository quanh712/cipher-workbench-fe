import type { DhDraft, DhField, DhFieldErrors } from "../types/cipher";

export const DH_FIELDS: readonly DhField[] = ["q", "alpha", "privateA", "privateB"];

/** Format-only validation. Backend owns numeric domains, primality and primitive roots. */
export function validateDhDraft(draft: DhDraft, fields: readonly DhField[]): DhFieldErrors {
  for (const field of fields) {
    const value = draft[field].replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, "");
    if (value.length > 39) return { [field]: "Giá trị không được vượt quá 39 chữ số." };
    if (!/^[0-9]+$/.test(value)) {
      return { [field]: "Giá trị phải là chuỗi số nguyên không âm." };
    }
  }
  return {};
}

/** Call only after format validation; no conversion through Number. */
export function normalizeDhDecimal(value: string): string {
  return value.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, "").replace(/^0+(?=[0-9])/, "");
}
