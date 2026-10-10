import { useState } from "react";
import { rsaSignatureScenarios } from "../demo/signatureScenarios";
import type {
  RsaSignatureFieldErrors,
  RsaSignatureMode,
  RsaSignatureResult,
  RsaSignatureScenarioId,
} from "../types/signature";
import type { RsaCipherController } from "./useRsaCipher";

function keyFingerprint(cipher: RsaCipherController): string {
  return JSON.stringify([
    cipher.draft,
    cipher.keySource,
    cipher.manualKey.n,
    cipher.manualKey.e,
    cipher.manualKey.d,
    cipher.key,
  ]);
}

function unsignedInteger(value: string): bigint | null {
  return /^\d{1,128}$/.test(value) ? BigInt(value) : null;
}

interface SignatureState {
  mode: RsaSignatureMode;
  message: string;
  signature: string;
  scenario: RsaSignatureScenarioId | null;
  result: RsaSignatureResult | null;
  keyFingerprint: string;
  resetVersion: number;
}

function emptyState(cipher: RsaCipherController): SignatureState {
  return {
    mode: "sign",
    message: "",
    signature: "",
    scenario: null,
    result: null,
    keyFingerprint: keyFingerprint(cipher),
    resetVersion: cipher.resetVersion,
  };
}

export function useRsaSignature(cipher: RsaCipherController) {
  const [state, setState] = useState(() => emptyState(cipher));
  const fingerprint = keyFingerprint(cipher);
  // Synchronize shared-key edits before rendering any stale demonstration outcome.
  // Once invalidated, undoing an edit cannot silently re-enable a demo.
  if (state.resetVersion !== cipher.resetVersion) {
    setState(emptyState(cipher));
  } else if (state.keyFingerprint !== fingerprint) {
    setState({ ...state, keyFingerprint: fingerprint, scenario: null, result: null });
  }

  const selectedKey = cipher.keySource === "manual" ? cipher.manualKey : cipher.key;
  const n = unsignedInteger(selectedKey?.n ?? "");
  const exponentField = state.mode === "sign" ? "d" : "e";
  const exponent = unsignedInteger(selectedKey?.[exponentField] ?? "");
  const messageValue = unsignedInteger(state.message);
  const signatureValue = unsignedInteger(state.signature);
  const fieldErrors: RsaSignatureFieldErrors = {};
  if (n === null || n < 2n || exponent === null || exponent < 1n) {
    fieldErrors.key = `Nhập n ≥ 2 và ${exponentField} ≥ 1 dưới dạng số thập phân (tối đa 128 chữ số).`;
  }
  if (messageValue === null || (n !== null && messageValue >= n)) {
    fieldErrors.message = "Thông điệp m phải là số nguyên thỏa 0 ≤ m < n, tối đa 128 chữ số.";
  }
  if (state.mode === "verify" && (signatureValue === null || (n !== null && signatureValue >= n))) {
    fieldErrors.signature = "Chữ ký s phải là số nguyên thỏa 0 ≤ s < n, tối đa 128 chữ số.";
  }

  const fixture = rsaSignatureScenarios.find((item) => item.id === state.scenario);
  const canRunDemo = Boolean(
    fixture &&
    state.keyFingerprint === fingerprint &&
    state.resetVersion === cipher.resetVersion &&
    state.mode === fixture.mode &&
    state.message === fixture.message &&
    state.signature === fixture.signature &&
    selectedKey?.n === fixture.key.n &&
    selectedKey?.[exponentField] === fixture.key[exponentField] &&
    Object.keys(fieldErrors).length === 0,
  );

  function setMode(mode: RsaSignatureMode) {
    if (mode !== state.mode)
      setState((previous) => ({ ...previous, mode, scenario: null, result: null }));
  }
  function setMessage(message: string) {
    setState((previous) => ({ ...previous, message, scenario: null, result: null }));
  }
  function setSignature(signature: string) {
    setState((previous) => ({ ...previous, signature, scenario: null, result: null }));
  }
  function loadScenario(id: RsaSignatureScenarioId) {
    const scenario = rsaSignatureScenarios.find((item) => item.id === id);
    if (!scenario) return;
    cipher.setKeySource("manual");
    cipher.setManualKey("n", scenario.key.n);
    cipher.setManualKey("e", scenario.key.e);
    cipher.setManualKey("d", scenario.key.d);
    setState({
      mode: scenario.mode,
      message: scenario.message,
      signature: scenario.signature,
      scenario: scenario.id,
      result: null,
      keyFingerprint: keyFingerprint({ ...cipher, keySource: "manual", manualKey: scenario.key }),
      resetVersion: cipher.resetVersion,
    });
  }
  function runDemo() {
    if (!canRunDemo || !fixture) return;
    setState((previous) => ({ ...previous, result: fixture.result }));
  }
  function clearResult() {
    setState((previous) => ({ ...previous, result: null }));
  }
  function reset() {
    setState(emptyState(cipher));
  }

  return {
    mode: state.mode,
    setMode,
    message: state.message,
    setMessage,
    signature: state.signature,
    setSignature,
    scenario: state.scenario,
    loadScenario,
    scenarios: rsaSignatureScenarios.map(({ id, label }) => ({ id, label })),
    result: state.result,
    fieldErrors,
    canRunDemo,
    runDemo,
    clearResult,
    reset,
  };
}
