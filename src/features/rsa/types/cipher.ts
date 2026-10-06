export interface RsaParameters {
  p: string;
  q: string;
  e: string;
}

export interface RsaDraft extends RsaParameters {
  plaintext: string;
  text: string;
}

export interface EuclidRow {
  quotient: string | null;
  remainder: string;
  coefficient: string;
}

export interface ModPowRow {
  index: number;
  bit: 0 | 1;
  base: string;
  before: string;
  after: string;
}

export interface RsaKeyResult extends RsaParameters {
  n: string;
  phi: string;
  d: string;
  verification: string;
  euclidRows: EuclidRow[];
}

export interface RsaNumberResult {
  plaintext: string;
  ciphertext: string;
  decrypted: string;
  plaintextInRange: boolean;
  encryptRows: ModPowRow[];
  decryptRows: ModPowRow[];
}

export interface RsaTextRow {
  character: string;
  plaintext: string;
  ciphertext: string;
  decrypted: string;
  recovered: boolean;
}

export interface RsaTextResult {
  rows: RsaTextRow[];
  invalidCount: number;
}

export type RsaTask = "key" | "number" | "text";
export type RsaStatus = "idle" | "loading" | "success" | "error";
export type RsaField = "p" | "q" | "e" | "plaintext" | "text";
export type RsaFieldErrors = Partial<Record<RsaField, string>>;
