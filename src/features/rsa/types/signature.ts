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

export type StandardSignatureRequest = (
  { source: "text"; text: string } | { source: "file"; file: File | null }
) &
  (
    | { operation: "sign"; privateKeyPem: string; passphrase?: string }
    | { operation: "verify"; publicKeyPem: string; signature: string }
  );

export interface StandardSignatureResponse {
  result: {
    mode: "standard";
    source: "text" | "file";
    signature?: string;
    publicKeyPem?: string;
    valid?: boolean;
    contentBytes: number;
    sha256: string;
    algorithm: {
      scheme: "RSASSA-PSS";
      hash: "SHA-256";
      mgf: "MGF1-SHA-256";
      saltLength: 32;
      signatureEncoding: "base64";
    };
  };
  history: {
    saved: boolean;
    id: number | null;
    reason: "saved" | "disabled" | "unavailable" | "capacity";
  };
}
