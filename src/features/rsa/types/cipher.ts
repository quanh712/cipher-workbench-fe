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
  verification?: string;
  euclidRows: EuclidRow[];
}

export type RsaTask = "key" | "number" | "text";
export type RsaStatus = "idle" | "loading" | "success" | "error";
export type RsaField = "p" | "q" | "e" | "plaintext" | "text";
export type RsaFieldErrors = Partial<Record<RsaField, string>>;

export type RsaMode = "encrypt" | "decrypt";
export type RsaInputType = "number" | "text";
export type RsaTransformRequest = { n: string; inputType: RsaInputType } & (
  | { operation: "encrypt"; e: string; data: string }
  | { operation: "decrypt"; d: string; cipher: string[] }
);
export interface RsaTransformResult {
  operation: RsaMode;
  inputType: RsaInputType;
  output: string;
  blocks: string[];
  cipher: string[];
  rows: ModPowRow[];
}
