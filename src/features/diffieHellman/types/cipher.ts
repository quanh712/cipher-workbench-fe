/** Mathematical values stay decimal strings; API adapters validate them at runtime. */
export type DhDecimal = string;

export interface DhPublicParameters {
  q: DhDecimal;
  alpha: DhDecimal;
}

export interface DhParameters extends DhPublicParameters {
  privateA: DhDecimal;
  privateB: DhDecimal;
}

/** Raw form values, including incomplete or invalid input. Keep in memory only. */
export type DhDraft = DhParameters;

export interface DhExchangeRequest extends DhPublicParameters {
  privateA?: DhDecimal;
  privateB?: DhDecimal;
  includeTrace?: boolean;
}

export interface DhTraceRow {
  index: number;
  bit: 0 | 1;
  exponentPrefix: DhDecimal;
  squared: DhDecimal;
  multiplied: DhDecimal | null;
  result: DhDecimal;
}

/** Backend trace, ordered from the most significant exponent bit (left to right). */
export interface DhTrace {
  base: DhDecimal;
  exponent: DhDecimal;
  modulus: DhDecimal;
  result: DhDecimal;
  steps: DhTraceRow[];
}

export type DhTraceKey = "publicA" | "publicB" | "sharedA" | "sharedB";
export type DhTraces = Record<DhTraceKey, DhTrace>;

export interface DhExchangeResult extends DhPublicParameters {
  privateA: DhDecimal;
  privateB: DhDecimal;
  warning: { code: "EDUCATIONAL_PRIVATE_KEYS"; message: string };
  publicA: DhDecimal;
  publicB: DhDecimal;
  sharedA: DhDecimal;
  sharedB: DhDecimal;
  /** A mismatch must be rejected by the adapter, not shown as a successful result. */
  matched: true;
  traces: DhTraces | null;
}

/** Normalized parameters and both private values returned by Backend. */
export type DhPrivateValuesResult = DhParameters;

export type DhField = "q" | "alpha" | "privateA" | "privateB";
export type DhFieldErrors = Partial<Record<DhField, string>>;
export type DhTask = "exchange" | "random";
export type DhStatus = "idle" | "loading" | "success" | "error";
