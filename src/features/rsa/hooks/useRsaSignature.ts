import { RsaGatewayError } from "../services/rsaGateway";
import type { NoticeState } from "../../../shared/types/cipher";
import { useLayoutEffect, useRef, useState } from "react";
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
  notice: NoticeState | null;
  keyFingerprint: string;
  resetVersion: number;
  loading: boolean;
  active: boolean;
  enabled: boolean;
}

function emptyState(cipher: RsaCipherController, enabled: boolean): SignatureState {
  return {
    loading: false,
    active: cipher.active,
    enabled,
    mode: "sign",
    message: "",
    signature: "",
    scenario: null,
    result: null,
    notice: null,
    keyFingerprint: keyFingerprint(cipher),
    resetVersion: cipher.resetVersion,
  };
}

export function useRsaSignature(cipher: RsaCipherController, enabled = true) {
  const [state, setState] = useState(() => emptyState(cipher, enabled));
  const request = useRef<AbortController | null>(null);
  const current = useRef("");
  const fingerprint = keyFingerprint(cipher);
  const requestKey = JSON.stringify([
    fingerprint,
    cipher.resetVersion,
    cipher.active && enabled,
    state.mode,
    state.message,
    state.signature,
  ]);
  useLayoutEffect(() => {
    current.current = requestKey;
    request.current?.abort();
    request.current = null;
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [requestKey]);
  if (state.active !== cipher.active || state.enabled !== enabled) {
    setState({
      ...state,
      active: cipher.active,
      enabled,
      loading: false,
      ...(!cipher.active ? { result: null, notice: null } : {}),
    });
  }
  // Invalidate dependent results before rendering shared-key edits.
  if (state.resetVersion !== cipher.resetVersion) {
    setState(emptyState(cipher, enabled));
  } else if (state.keyFingerprint !== fingerprint) {
    setState({
      ...state,
      loading: false,
      keyFingerprint: fingerprint,
      scenario: null,
      result: null,
      notice: null,
    });
  }

  const selectedKey = cipher.keySource === "manual" ? cipher.manualKey : cipher.key;
  const n = unsignedInteger(selectedKey?.n ?? "");
  const exponentField = state.mode === "sign" ? "d" : "e";
  const exponent = unsignedInteger(selectedKey?.[exponentField] ?? "");
  const publicExponent = unsignedInteger(selectedKey?.e ?? "");
  const messageValue = unsignedInteger(state.message);
  const signatureValue = unsignedInteger(state.signature);
  const fieldErrors: RsaSignatureFieldErrors = {};
  if (
    n === null ||
    n < 2n ||
    exponent === null ||
    exponent < 1n ||
    publicExponent === null ||
    publicExponent < 1n
  ) {
    fieldErrors.key = `Nhập n ≥ 2 và ${state.mode === "sign" ? "d, e" : "e"} ≥ 1 dưới dạng số thập phân (tối đa 128 chữ số).`;
  }
  if (messageValue === null || (n !== null && messageValue >= n)) {
    fieldErrors.message = "Thông điệp m phải là số nguyên thỏa 0 ≤ m < n, tối đa 128 chữ số.";
  }
  if (state.mode === "verify" && (signatureValue === null || (n !== null && signatureValue >= n))) {
    fieldErrors.signature = "Chữ ký s phải là số nguyên thỏa 0 ≤ s < n, tối đa 128 chữ số.";
  }

  const canRun = Boolean(
    cipher.gateway &&
    cipher.active &&
    enabled &&
    !state.loading &&
    Object.keys(fieldErrors).length === 0,
  );

  function setMode(mode: RsaSignatureMode) {
    if (mode !== state.mode)
      setState((previous) => ({
        ...previous,
        loading: false,
        mode,
        scenario: null,
        result: null,
        notice: null,
      }));
  }
  function setMessage(message: string) {
    setState((previous) => ({
      ...previous,
      loading: false,
      message,
      scenario: null,
      result: null,
      notice: null,
    }));
  }
  function setSignature(signature: string) {
    setState((previous) => ({
      ...previous,
      signature,
      loading: false,
      scenario: null,
      result: null,
      notice: null,
    }));
  }
  function loadScenario(id: RsaSignatureScenarioId) {
    const scenario = rsaSignatureScenarios.find((item) => item.id === id);
    if (!scenario) return;
    request.current?.abort();
    request.current = null;
    cipher.setKeySource("manual");
    cipher.setManualKey("n", scenario.key.n);
    cipher.setManualKey("e", scenario.key.e);
    cipher.setManualKey("d", scenario.key.d);
    setState({
      loading: false,
      active: cipher.active,
      enabled,
      mode: scenario.mode,
      message: scenario.message,
      signature: scenario.signature,
      scenario: scenario.id,
      result: null,
      notice: null,
      keyFingerprint: keyFingerprint({ ...cipher, keySource: "manual", manualKey: scenario.key }),
      resetVersion: cipher.resetVersion,
    });
  }
  async function run() {
    if (!canRun || !cipher.gateway || !selectedKey || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const version = requestKey;
    const isCurrent = () => !controller.signal.aborted && current.current === version;
    setState((previous) => ({ ...previous, loading: true, result: null, notice: null }));
    try {
      const result = await cipher.gateway.signature(
        state.mode === "sign"
          ? {
              operation: "sign",
              m: state.message,
              n: selectedKey.n,
              e: selectedKey.e,
              d: selectedKey.d,
            }
          : {
              operation: "verify",
              m: state.message,
              signature: state.signature,
              n: selectedKey.n,
              e: selectedKey.e,
            },
        controller.signal,
      );
      if (!isCurrent()) return;
      setState((previous) => ({
        ...previous,
        result,
        loading: false,
        notice: { kind: result.kind === "invalid" ? "error" : "success", message: result.message },
      }));
    } catch (error) {
      if (!isCurrent()) return;
      const message =
        error instanceof RsaGatewayError
          ? error.message
          : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
      setState((previous) => ({
        ...previous,
        loading: false,
        result: { kind: "error", message, steps: [] },
        notice: { kind: "error", message },
      }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  }
  function clearResult() {
    request.current?.abort();
    request.current = null;
    setState((previous) => ({ ...previous, loading: false, result: null, notice: null }));
  }
  function reset() {
    request.current?.abort();
    request.current = null;
    setState(emptyState(cipher, enabled));
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
    notice: state.notice,
    setNotice: (notice: NoticeState | null) => setState((previous) => ({ ...previous, notice })),
    closeNotice: () => setState((previous) => ({ ...previous, notice: null })),
    fieldErrors,
    canRun,
    run,
    loading: state.loading,
    clearResult,
    reset,
  };
}
