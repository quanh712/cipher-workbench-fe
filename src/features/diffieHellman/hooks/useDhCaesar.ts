import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CipherMode, InputType, NoticeState } from "../../../shared/types/cipher";
import { readTextFile, validateTextFile } from "../../../shared/utils/textFileValidation";
import { saveBlob } from "../../../shared/utils/download";
import { dhOperations, type DhCaesarResponse } from "../services/dhOperations";
import { DiffieHellmanGatewayError } from "../services/diffieHellmanGateway";
import type { DiffieHellmanController } from "./useDiffieHellman";
import type { DhSide, SharedRecord } from "./useDhPractice";

export interface DhCaesarSnapshot {
  response: DhCaesarResponse;
  mode: CipherMode;
  inputType: InputType;
  source: string;
  fileName?: string;
  side: DhSide;
}
export function useDhCaesar(
  cipher: DiffieHellmanController,
  side: DhSide,
  practiceShared: SharedRecord | null,
) {
  const context = practiceShared ?? cipher.result;
  const [mode, setModeState] = useState<CipherMode>("encrypt");
  const [inputType, setInputTypeState] = useState<InputType>("text");
  const [text, setTextState] = useState("");
  const [file, setFileState] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [isReadingFile, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [output, setOutput] = useState<{
    result: DhCaesarSnapshot | null;
    error: string | null;
    context: typeof context;
    side: DhSide;
  }>({ result: null, error: null, context, side });
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [running, setRunning] = useState(false);
  const revision = useRef(0);
  const fileRevision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    revision.current++;
  }, [context, side]);
  if (output.context !== context || output.side !== side) {
    setOutput({ result: null, error: null, context, side });
    setNotice(null);
  }
  const current =
    output.context === context && output.side === side ? output : { result: null, error: null };
  const inputError =
    inputType === "text"
      ? text.length
        ? null
        : "Vui lòng nhập văn bản."
      : (fileError ?? validateTextFile(file));
  const source = practiceShared
    ? {
        q: practiceShared.q,
        privateKey: practiceShared.privateKey,
        otherPublicKey: practiceShared.otherPublicKey,
        sharedKey: practiceShared.response.sharedKey,
      }
    : cipher.result && cipher.snapshot
      ? {
          q: cipher.snapshot.q,
          privateKey: side === "A" ? cipher.snapshot.privateA : cipher.snapshot.privateB,
          otherPublicKey: side === "A" ? cipher.result.publicB : cipher.result.publicA,
          sharedKey: side === "A" ? cipher.result.sharedA : cipher.result.sharedB,
        }
      : null;
  function clearResult() {
    revision.current++;
    cipher.cancelSupplemental();
    setRunning(false);
    setOutput({ result: null, error: null, context, side });
    setNotice(null);
  }
  function setText(next: string) {
    clearResult();
    setTextState(next);
  }
  function setMode(next: CipherMode) {
    if (next !== mode) {
      clearResult();
      setModeState(next);
    }
  }
  function setInputType(next: InputType) {
    if (next !== inputType) {
      clearResult();
      setInputTypeState(next);
    }
  }
  async function setFile(next: File | null) {
    clearResult();
    const version = ++fileRevision.current;
    setFileState(next);
    setFileText("");
    setFileError(null);
    setReading(false);
    if (!next) return;
    const error = validateTextFile(next);
    if (error) {
      setFileError(error);
      return;
    }
    setReading(true);
    try {
      const content = await readTextFile(next);
      if (mounted.current && version === fileRevision.current)
        setFileText(content.replace(/^\uFEFF/, ""));
    } catch {
      if (mounted.current && version === fileRevision.current)
        setFileError("Không thể đọc file. Vui lòng chọn lại.");
    } finally {
      if (mounted.current && version === fileRevision.current) setReading(false);
    }
  }
  function resetInput() {
    if (inputType === "text") setText("");
    else void setFile(null);
  }
  function resetAll() {
    clearResult();
    fileRevision.current++;
    setReading(false);
    setFileError(null);
    setModeState("encrypt");
    setInputTypeState("text");
    setTextState("");
    setFileState(null);
    setFileText("");
  }
  async function process() {
    if (!source || inputError || isReadingFile || cipher.isBusy) return;
    clearResult();
    const version = revision.current;
    const snapshot = {
      mode,
      inputType,
      source: inputType === "text" ? text : fileText,
      fileName: inputType === "file" ? file?.name : undefined,
      side,
    };
    setRunning(true);
    try {
      const response = await cipher.runSupplemental((signal) =>
        dhOperations.caesar(
          {
            q: source.q,
            privateKey: source.privateKey,
            otherPublicKey: source.otherPublicKey,
            action: mode,
            ...(inputType === "text" ? { data: text } : { file: file! }),
          },
          signal,
        ),
      );
      if (!response || !mounted.current || version !== revision.current) return;
      if (
        response.sharedKey !== source.sharedKey ||
        BigInt(response.shift) !== BigInt(source.sharedKey) % 26n
      )
        throw new DiffieHellmanGatewayError(
          "Dữ liệu phản hồi không khớp khóa chung DH. Vui lòng thử lại.",
          "INVALID_RESPONSE",
        );
      setOutput({ result: { ...snapshot, response }, error: null, context, side });
    } catch (error) {
      if (mounted.current && version === revision.current)
        setOutput({
          result: null,
          error:
            error instanceof DiffieHellmanGatewayError
              ? error.message
              : "Không thể xử lý yêu cầu. Vui lòng thử lại.",
          context,
          side,
        });
    } finally {
      if (mounted.current && version === revision.current) setRunning(false);
    }
  }
  async function copy(value: string, label: string) {
    const version = revision.current;
    try {
      await navigator.clipboard.writeText(value);
      if (mounted.current && version === revision.current)
        setNotice({ kind: "success", message: `Đã sao chép ${label}.` });
    } catch {
      if (mounted.current && version === revision.current)
        setNotice({ kind: "error", message: `Không thể sao chép ${label}.` });
    }
  }
  async function paste() {
    const version = revision.current;
    try {
      const value = await navigator.clipboard.readText();
      if (mounted.current && version === revision.current) {
        setText(value);
        setNotice({ kind: "success", message: "Đã dán nội dung từ clipboard." });
      }
    } catch {
      if (mounted.current && version === revision.current)
        setNotice({ kind: "error", message: "Không thể đọc nội dung clipboard." });
    }
  }
  function download() {
    if (!current.result) return;
    const suffix = current.result.mode === "encrypt" ? "encrypted" : "decrypted";
    try {
      saveBlob(
        new Blob([current.result.response.result], { type: "text/plain;charset=utf-8" }),
        `dh-caesar.${suffix}.txt`,
      );
      setNotice({ kind: "success", message: "Đã tải kết quả." });
    } catch {
      setNotice({ kind: "error", message: "Không thể tải kết quả." });
    }
  }
  return {
    mode,
    inputType,
    text,
    file,
    fileText,
    isReadingFile,
    inputError,
    source,
    result: current.result,
    error: current.error,
    notice,
    setNotice,
    isRunning: running && cipher.supplementalBusy,
    canSubmit: Boolean(source) && !inputError && !isReadingFile && !cipher.isBusy,
    setMode,
    setInputType,
    setText,
    setFile,
    resetInput,
    resetAll,
    clearResult,
    process,
    paste,
    download,
    loadExample: () => {
      setInputType("text");
      setText(mode === "encrypt" ? "Hello World" : "Jgnnq Yqtnf");
    },
    copyInput: () => copy(inputType === "text" ? text : fileText, "đầu vào"),
    copyResult: () =>
      current.result ? copy(current.result.response.result, "kết quả") : undefined,
  };
}
export type DhCaesarController = ReturnType<typeof useDhCaesar>;
