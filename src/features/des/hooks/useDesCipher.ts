import { useEffect, useMemo, useRef, useState } from "react";
import type { NoticeState } from "../../../shared/types/cipher";
import { saveBlob } from "../../../shared/utils/download";
import { DesGatewayError, isDesResult, type DesGateway } from "../services/desGateway";
import type { DesDraft, DesFieldErrors, DesResult, DesRequest } from "../types/cipher";
import {
  DES_MAX_ROUND_TRIP_TEXT_BYTES,
  utf8ByteLength,
  validateDesDraft,
} from "../utils/validation";

const emptyDraft: DesDraft = {
  mode: "encrypt",
  inputType: "text",
  text: "",
  file: null,
  key: "",
  cipherMode: "ECB",
  format: "text",
  iv: "",
};
const fallback = "Không thể xử lý yêu cầu. Vui lòng thử lại.";

export function useDesCipher(gateway: DesGateway | null, active = true) {
  const isDemo = gateway?.kind !== "api";
  const [snapshot, setSnapshot] = useState<DesRequest | null>(null);
  const [draft, setDraft] = useState<DesDraft>(emptyDraft);
  const [result, setResult] = useState<DesResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DesFieldErrors>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [previousActive, setPreviousActive] = useState(active);
  if (previousActive !== active) {
    setPreviousActive(active);
    if (!active) {
      setStatus("idle");
      setSnapshot(null);
      setResult(null);
      setNotice(null);
      setFieldErrors({});
    }
  }
  const pending = useRef<AbortController | null>(null);
  const version = useRef(0);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      version.current += 1;
      pending.current?.abort();
      pending.current = null;
    }
    return () => {
      version.current += 1;
      pending.current?.abort();
      pending.current = null;
    };
  }, [active]);

  const validation = useMemo(() => validateDesDraft(draft, isDemo), [draft, isDemo]);
  const visibleErrors = { ...fieldErrors };
  if (!isDemo) {
    if (draft.key) visibleErrors.key ??= validation.key;
    if (draft.text && draft.inputType === "text") visibleErrors.input ??= validation.input;
    if (draft.file && draft.inputType === "file") visibleErrors.file ??= validation.file;
    if (draft.cipherMode === "CBC" && draft.iv) visibleErrors.iv ??= validation.iv;
  }
  const roundTripWarning =
    !isDemo &&
    draft.mode === "encrypt" &&
    (draft.inputType === "file"
      ? (draft.file?.size ?? 0)
      : draft.format === "text"
        ? utf8ByteLength(draft.text)
        : 0) > DES_MAX_ROUND_TRIP_TEXT_BYTES;

  function clearDerived() {
    setSnapshot(null);
    setResult(null);
    setNotice(null);
    setFieldErrors({});
    setStatus("idle");
  }

  function mutate(change: Partial<DesDraft>) {
    if (pending.current) return false;
    version.current += 1;
    setDraft((previous) => ({ ...previous, ...change }));
    clearDerived();
    return true;
  }

  async function processCipher(): Promise<DesFieldErrors | undefined> {
    if (pending.current || !activeRef.current || !gateway) return;
    const errors = validateDesDraft(draft, isDemo);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return errors;
    const controller = new AbortController();
    const requestVersion = ++version.current;
    pending.current = controller;
    clearDerived();
    setStatus("loading");
    const options = isDemo
      ? {}
      : {
          cipherMode: draft.cipherMode,
          format: draft.inputType === "text" ? draft.format : ("text" as const),
          ...(draft.cipherMode === "CBC" ? { iv: draft.iv } : {}),
        };
    const request: DesRequest =
      draft.inputType === "text"
        ? {
            operation: draft.mode,
            inputMode: "text" as const,
            text: draft.text,
            key: draft.key,
            ...options,
          }
        : {
            operation: draft.mode,
            inputMode: "file" as const,
            file: draft.file!,
            key: draft.key,
            ...options,
          };
    try {
      const response = await gateway.process(request, controller.signal);
      if (requestVersion !== version.current || controller.signal.aborted) return;
      if (!isDesResult(response)) throw new Error("Invalid DES gateway response");
      setResult(response);
      setSnapshot(request);
      setStatus("success");
      setNotice({
        kind: "success",
        message: isDemo
          ? "Đã nhận kết quả mô phỏng."
          : draft.mode === "encrypt"
            ? "Mã hóa thành công."
            : "Giải mã thành công.",
      });
    } catch (error) {
      if (requestVersion !== version.current || controller.signal.aborted) return;
      setResult(null);
      setStatus("error");
      const message =
        error instanceof DesGatewayError && error.message.trim() ? error.message : fallback;
      if (error instanceof DesGatewayError && error.field) {
        setFieldErrors({ [error.field]: message });
      } else {
        setNotice({ kind: "error", message });
      }
    } finally {
      if (requestVersion === version.current) pending.current = null;
    }
  }

  function clearResult() {
    if (pending.current) return;
    version.current += 1;
    setSnapshot(null);
    setResult(null);
    setNotice(null);
    setStatus("idle");
  }

  function resetAll() {
    version.current += 1;
    pending.current?.abort();
    pending.current = null;
    setDraft(emptyDraft);
    clearDerived();
  }

  async function copyResult() {
    if (!result?.text || pending.current) return;
    const currentVersion = version.current;
    try {
      await navigator.clipboard.writeText(result.text);
      if (currentVersion === version.current && activeRef.current)
        setNotice({
          kind: "success",
          message: isDemo ? "Đã sao chép kết quả mô phỏng." : "Đã sao chép kết quả.",
        });
    } catch {
      if (currentVersion === version.current && activeRef.current)
        setNotice({ kind: "error", message: "Không thể sao chép kết quả." });
    }
  }

  async function downloadResult() {
    if (!result || pending.current || !activeRef.current) return;
    if (isDemo) {
      if (!result.attachment) return;
      try {
        saveBlob(result.attachment.blob, result.attachment.filename);
        setNotice({ kind: "success", message: "Đã tải kết quả mô phỏng." });
      } catch {
        setNotice({ kind: "error", message: "Không thể tải kết quả." });
      }
      return;
    }
    if (!snapshot || !gateway) return;
    const controller = new AbortController();
    const requestVersion = ++version.current;
    pending.current = controller;
    setStatus("loading");
    setNotice(null);
    try {
      const attachment =
        snapshot.inputMode === "file"
          ? await gateway.download!(snapshot, controller.signal)
          : {
              blob: new Blob([result.text ?? ""], { type: "text/plain;charset=utf-8" }),
              filename: `des-${snapshot.operation}.txt`,
            };
      if (requestVersion !== version.current || controller.signal.aborted) return;
      saveBlob(attachment.blob, attachment.filename);
      setStatus("success");
      setNotice({ kind: "success", message: "Đã tải kết quả." });
    } catch (error) {
      if (requestVersion !== version.current || controller.signal.aborted) return;
      setStatus("error");
      setNotice({
        kind: "error",
        message: error instanceof DesGatewayError ? error.message : "Không thể tải kết quả.",
      });
    } finally {
      if (requestVersion === version.current) pending.current = null;
    }
  }

  return {
    ...draft,
    result,
    fieldErrors: visibleErrors,
    isDemo,
    roundTripWarning,
    resultOptions: snapshot,
    canSubmit: !isDemo
      ? Object.keys(validation).length === 0 && status !== "loading"
      : status !== "loading",
    canDownload: Boolean(
      result &&
      (isDemo
        ? result.attachment
        : snapshot?.inputMode === "text"
          ? result.text
          : gateway?.download),
    ),
    notice,
    setNotice,
    status,
    isBusy: status === "loading",
    setMode: (mode: DesDraft["mode"]) => mutate({ mode }),
    setInputType: (inputType: DesDraft["inputType"]) => mutate({ inputType }),
    setText: (text: string) => mutate({ text }),
    setCipherMode: (cipherMode: DesDraft["cipherMode"]) => mutate({ cipherMode }),
    setFormat: (format: DesDraft["format"]) => mutate({ format }),
    setIv: (iv: string) => mutate({ iv }),
    setKey: (key: string) => mutate({ key }),
    setFile: (file: File | null) => mutate({ file }),
    resetInput: () => mutate(draft.inputType === "text" ? { text: "" } : { file: null }),
    loadExample: () =>
      mutate({
        ...emptyDraft,
        text: "0123456789ABCDEF",
        key: "133457799BBCDFF1",
        format: "hex",
      }),
    clearResult,
    resetAll,
    processCipher,
    copyResult,
    downloadResult,
  };
}

export type DesCipherController = ReturnType<typeof useDesCipher>;
