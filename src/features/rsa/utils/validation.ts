import type { RsaDraft, RsaFieldErrors, RsaParameters } from "../types/cipher";

const MAX_PRIME = 1_000_000_000_000n;

export function decimal(value: string): string | null {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

export function validateParameters(parameters: RsaParameters): RsaFieldErrors {
  const errors: RsaFieldErrors = {};
  const p = decimal(parameters.p);
  const q = decimal(parameters.q);
  const e = decimal(parameters.e);

  if (p === null) errors.p = "p phải là số nguyên không âm.";
  if (q === null) errors.q = "q phải là số nguyên không âm.";
  if (e === null) errors.e = "e phải là số nguyên không âm.";
  const pValue = p === null ? null : BigInt(p);
  const qValue = q === null ? null : BigInt(q);
  const eValue = e === null ? null : BigInt(e);
  if (pValue !== null && (pValue < 2n || pValue > MAX_PRIME)) errors.p = "p phải từ 2 đến 10¹².";
  if (qValue !== null && (qValue < 2n || qValue > MAX_PRIME)) errors.q = "q phải từ 2 đến 10¹².";
  if (pValue !== null && qValue !== null && pValue === qValue) {
    errors.q = "p và q phải khác nhau.";
  }
  if (!errors.p && !errors.q && pValue !== null && qValue !== null && eValue !== null) {
    const phi = (pValue - 1n) * (qValue - 1n);
    if (eValue <= 1n || eValue >= phi) errors.e = `e phải thỏa 1 < e < φ(n) = ${phi}.`;
  }
  return errors;
}

export function validateNumber(draft: RsaDraft): RsaFieldErrors {
  return decimal(draft.plaintext) === null ? { plaintext: "P phải là số nguyên không âm." } : {};
}

export function validateText(draft: RsaDraft): RsaFieldErrors {
  return draft.text.length === 0 ? { text: "Nhập thông điệp." } : {};
}
