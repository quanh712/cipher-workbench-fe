import { useLayoutEffect, useRef, useState } from "react";
import {
  requestStandardSignature,
  RsaSignatureApiError,
  standardSignatureErrors,
} from "../services/rsaSignatureApi";
import type { StandardSignatureRequest, StandardSignatureResponse } from "../types/signature";

const empty = () => ({
  mode: "sign" as "sign" | "verify",
  source: "text" as "text" | "file",
  text: "",
  file: null as File | null,
  privateKeyPem: "",
  publicKeyPem: "",
  passphrase: "",
  signature: "",
});
export function useStandardRsaSignature(active: boolean) {
  const [draft, setDraft] = useState(empty);
  const [result, setResult] = useState<StandardSignatureResponse | null>(null);
  const [error, setError] = useState<RsaSignatureApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [wasActive, setWasActive] = useState(active);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  function invalidate() {
    revision.current += 1;
    request.current?.abort();
    request.current = null;
  }
  useLayoutEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
      revision.current += 1;
    },
    [active],
  );
  if (active !== wasActive) {
    setWasActive(active);
    setDraft(empty());
    setResult(null);
    setError(null);
    setLoading(false);
  }
  const input: StandardSignatureRequest = {
    ...(draft.source === "text"
      ? { source: "text", text: draft.text }
      : { source: "file", file: draft.file }),
    ...(draft.mode === "sign"
      ? { operation: "sign", privateKeyPem: draft.privateKeyPem, passphrase: draft.passphrase }
      : { operation: "verify", signature: draft.signature, publicKeyPem: draft.publicKeyPem }),
  };
  const fieldErrors = standardSignatureErrors(input);
  function update<K extends keyof ReturnType<typeof empty>>(
    field: K,
    value: ReturnType<typeof empty>[K],
  ) {
    invalidate();
    setDraft((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "mode" ? { privateKeyPem: "", passphrase: "" } : {}),
      ...(field === "source" ? { file: null } : {}),
    }));
    setResult(null);
    setError(null);
    setLoading(false);
  }
  function clear() {
    invalidate();
    setDraft(empty());
    setResult(null);
    setError(null);
    setLoading(false);
  }
  async function run() {
    if (!active || loading || request.current || Object.keys(fieldErrors).length) return;
    const controller = new AbortController();
    request.current = controller;
    const version = revision.current;
    const isCurrent = () => !controller.signal.aborted && version === revision.current;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await requestStandardSignature(input, controller.signal);
      if (!isCurrent()) return;
      setResult(response);
      // Private material only lives in this form, and is cleared after a successful sign.
      if (draft.mode === "sign")
        setDraft((previous) => ({ ...previous, privateKeyPem: "", passphrase: "" }));
    } catch (caught) {
      if (!isCurrent()) return;
      setError(
        caught instanceof RsaSignatureApiError
          ? caught
          : new RsaSignatureApiError("Không thể xử lý chữ ký RSA. Vui lòng thử lại."),
      );
    } finally {
      if (request.current === controller) request.current = null;
      if (isCurrent()) setLoading(false);
    }
  }
  function useForVerification() {
    if (!result?.result.signature || !result.result.publicKeyPem) return;
    invalidate();
    setDraft((previous) => ({
      ...previous,
      mode: "verify",
      signature: result.result.signature!,
      publicKeyPem: result.result.publicKeyPem!,
      privateKeyPem: "",
      passphrase: "",
    }));
    setResult(null);
    setError(null);
    setLoading(false);
  }
  return {
    draft,
    update,
    result,
    error,
    fieldErrors,
    loading,
    canRun: active && !loading && !Object.keys(fieldErrors).length,
    run,
    clear,
    useForVerification,
  };
}
