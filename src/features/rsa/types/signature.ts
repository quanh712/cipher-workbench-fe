import type { ModPowRow } from "./cipher";

export type RsaSignatureMode = "sign" | "verify";

export type RsaSignatureScenarioId =
  "sign-success" | "verify-valid" | "verify-invalid" | "service-error";

export interface RsaSignatureResult {
  kind: "signed" | "valid" | "invalid" | "error";
  signature?: string;
  recoveredMessage?: string;
  message: string;
  steps: string[];
  rows?: ModPowRow[];
  warning?: string;
  history?: { saved: boolean; id: number | null; reason: string };
}

export interface RsaSignatureFieldErrors {
  message?: string;
  signature?: string;
  key?: string;
}

export interface RsaSignatureScenario {
  id: RsaSignatureScenarioId;
  label: string;
  mode: RsaSignatureMode;
  message: string;
  signature: string;
  key: { n: string; e: string; d: string };
  result: RsaSignatureResult;
}

export type RsaSignatureRequest = { n: string; e: string; m: string } & (
  { operation: "sign"; d: string } | { operation: "verify"; signature: string }
);
