import { useMemo, useRef, useState } from "react";
import { CipherApiError } from "../../../shared/services/cipherApi";
import type { CipherMode, InputType, NoticeState } from "../../../shared/types/cipher";
import { saveBlob } from "../../../shared/utils/download";
import { MAX_TEXT_FILE_BYTES, readTextFile } from "../../../shared/utils/textFileValidation";
import { playfairApi } from "../services/playfairApi";
import type { PlayfairResultSnapshot, ProcessingStatus } from "../types/cipher";
import { validatePlayfairInput, validatePlayfairKey } from "../utils/validation";

function userFacingError(error: unknown) {
  return error instanceof CipherApiError
    ? error.message
    : "Không thể kết nối tới máy chủ. Vui lòng thử lại.";
}

export function usePlayfairCipher() {
  const [mode, setModeState] = useState<CipherMode>("encrypt");
  const [inputType, setInputTypeState] = useState<InputType>("text");
  const [text, setTextState] = useState("");
  const [file, setFileState] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [key, setKeyState] = useState("");
  const [result, setResult] = useState<PlayfairResultSnapshot | null>(null);
  const [filterPadding, setFilterPaddingState] = useState(true);
  const displayResult =
    result?.mode === "decrypt" && filterPadding
      ? (result.padding?.filtered ?? result.text)
      : (result?.text ?? "");
  function setFilterPadding(next: boolean) {
    if (!isLoading) setFilterPaddingState(next);
  }
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle");
  const fileReadVersion = useRef(0);
  const requestInFlight = useRef(false);

  const inputError = useMemo(
    () => validatePlayfairInput(mode, inputType, text, file),
    [file, inputType, mode, text],
  );
  const keyError = useMemo(() => validatePlayfairKey(key), [key]);
  const canSubmit = !isLoading && !inputError && !keyError;

  function clearDerivedState() {
    setResult(null);
    setProcessingStatus("idle");
    setNotice(null);
  }

  function setMode(nextMode: CipherMode) {
    if (isLoading || nextMode === mode) return;
    setModeState(nextMode);
    clearDerivedState();
  }

  function setInputType(nextType: InputType) {
    if (isLoading || nextType === inputType) return;
    setInputTypeState(nextType);
    clearDerivedState();
  }

  function setText(nextText: string) {
    if (isLoading) return;
    setTextState(nextText);
    clearDerivedState();
  }

  function setKey(nextKey: string) {
    if (isLoading) return;
    setKeyState(nextKey);
    clearDerivedState();
  }

  async function setFile(nextFile: File | null) {
    if (isLoading) return;
    const readVersion = ++fileReadVersion.current;
    setFileState(nextFile);
    setFileText("");
    clearDerivedState();
    const canRead =
      nextFile &&
      /\.txt$/i.test(nextFile.name) &&
      nextFile.size > 0 &&
      nextFile.size <= MAX_TEXT_FILE_BYTES;
    if (!canRead) return;
    try {
      const content = await readTextFile(nextFile);
      if (fileReadVersion.current === readVersion) setFileText(content.replace(/^\uFEFF/, ""));
    } catch {
      if (fileReadVersion.current === readVersion) setFileText("");
    }
  }

  async function processCipher() {
    if (!canSubmit || requestInFlight.current) return;
    const snapshot = { mode, inputType, text, file, fileText, key };
    requestInFlight.current = true;
    setResult(null);
    setIsLoading(true);
    setProcessingStatus("loading");
    setNotice(null);
    try {
      let source = snapshot.text;
      if (snapshot.inputType === "file") {
        source = snapshot.fileText;
        if (source.length === 0) {
          try {
            source = (await readTextFile(snapshot.file!)).replace(/^\uFEFF/, "");
          } catch {
            source = "";
          }
        }
      }
      const response =
        snapshot.inputType === "text"
          ? await playfairApi.processText(snapshot.mode, snapshot.text, snapshot.key)
          : await playfairApi.previewFile(snapshot.mode, snapshot.file!, snapshot.key);
      setResult({
        text: response.result,
        padding: response.padding,
        source,
        mode: snapshot.mode,
        inputType: snapshot.inputType,
        file: snapshot.file ?? undefined,
        keyValue: snapshot.key,
      });
      setProcessingStatus("success");
      setNotice({
        kind: "success",
        message: snapshot.mode === "encrypt" ? "Mã hóa thành công." : "Giải mã thành công.",
      });
    } catch (error) {
      setResult(null);
      setProcessingStatus("error");
      setNotice({ kind: "error", message: userFacingError(error) });
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  }

  async function downloadResult() {
    const snapshot = result;
    if (!snapshot || isLoading || requestInFlight.current) return;
    requestInFlight.current = true;
    setIsLoading(true);
    setNotice(null);
    try {
      if (snapshot.inputType === "text") {
        const suffix = snapshot.mode === "encrypt" ? "encrypted" : "decrypted";
        saveBlob(
          new Blob([displayResult], { type: "text/plain;charset=utf-8" }),
          `ket-qua.${suffix}.txt`,
        );
      } else {
        const download = await playfairApi.downloadFile(
          snapshot.mode,
          snapshot.file!,
          snapshot.keyValue,
          filterPadding,
        );
        saveBlob(download.blob, download.filename);
      }
      setNotice({ kind: "success", message: "Đã tải kết quả." });
    } catch (error) {
      setResult(null);
      setProcessingStatus("error");
      setNotice({ kind: "error", message: userFacingError(error) });
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  }

  function resetInput() {
    if (isLoading) return;
    if (inputType === "text") setTextState("");
    else {
      fileReadVersion.current += 1;
      setFileState(null);
      setFileText("");
    }
    clearDerivedState();
  }

  function loadExample() {
    if (isLoading) return;
    fileReadVersion.current += 1;
    setModeState("encrypt");
    setInputTypeState("text");
    setTextState("HIDE THE GOLD IN THE TREE STUMP");
    setKeyState("PLAYFAIR EXAMPLE");
    clearDerivedState();
  }

  function clearResult() {
    if (!isLoading) clearDerivedState();
  }

  function resetAll() {
    if (isLoading) return;
    fileReadVersion.current += 1;
    setModeState("encrypt");
    setInputTypeState("text");
    setTextState("");
    setFileState(null);
    setFileText("");
    setKeyState("");
    clearDerivedState();
  }

  return {
    mode,
    setMode,
    inputType,
    setInputType,
    text,
    setText,
    file,
    fileText,
    setFile,
    key,
    setKey,
    result,
    displayResult,
    filterPadding,
    setFilterPadding,
    notice,
    setNotice,
    isLoading,
    processingStatus,
    inputError,
    keyError,
    canSubmit,
    processCipher,
    downloadResult,
    resetInput,
    loadExample,
    clearResult,
    resetAll,
    clearDerivedState,
  };
}

export type PlayfairCipherController = ReturnType<typeof usePlayfairCipher>;
