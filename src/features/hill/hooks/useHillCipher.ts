import { useEffect, useMemo, useRef, useState } from "react";
import type { CipherMode, InputType, NoticeState } from "../../../shared/types/cipher";
import { saveBlob } from "../../../shared/utils/download";
import { HillApiError } from "../services/hillApi";
import type { HillGateway } from "../services/hillGateway";
import type {
  HillAnalyzeResponse,
  HillKeyInputMode,
  HillErrorBody,
  HillResultSnapshot,
  HillSize,
} from "../types/cipher";
import { readHillFile, validateHillFile } from "../utils/fileText";
import {
  DEFAULT_HILL_MATRIX,
  keywordMatrix,
  validateHillKey,
  validateHillText,
} from "../utils/validation";

type AnalysisState = {
  status: "idle" | "loading" | "valid" | "invalid" | "error";
  fingerprint: string | null;
  data: HillAnalyzeResponse | null;
  message: string | null;
  error?: HillErrorBody;
  retry?: "analyze" | "random";
};

type ResultError = HillErrorBody;

const idleAnalysis = (): AnalysisState => ({
  status: "idle",
  fingerprint: null,
  data: null,
  message: null,
});
const defaultMatrix = () => DEFAULT_HILL_MATRIX.map((row) => [...row]);
const NETWORK_MESSAGE = "Không kết nối được máy chủ. Thử lại.";

function errorMessage(error: unknown): ResultError {
  return error instanceof HillApiError
    ? error.detail
    : { code: "NETWORK", message: NETWORK_MESSAGE };
}
const KEY_ERRORS = new Set(["E03", "E04", "E08", "E09"]);

export function useHillCipher(gateway: HillGateway, active: boolean) {
  const [mode, setModeState] = useState<CipherMode>("encrypt");
  const [text, setTextState] = useState("");
  const [inputType, setInputTypeState] = useState<InputType>("text");
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [m, setM] = useState<HillSize>(2);
  const [keyInputMode, setKeyInputMode] = useState<HillKeyInputMode>("grid");
  const [matrix, setMatrix] = useState<string[][]>(defaultMatrix);
  const [keyword, setKeywordRaw] = useState("");
  const [stripDiacritics, setStripDiacriticsState] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisState>(idleAnalysis);
  const [analysisRetry, setAnalysisRetry] = useState(0);
  const [result, setResult] = useState<HillResultSnapshot | null>(null);
  const [filterPadding, setFilterPaddingState] = useState(true);
  const displayResult =
    result?.mode === "decrypt" && filterPadding
      ? (result.padding?.filtered ?? result.result)
      : (result?.result ?? "");
  function setFilterPadding(next: boolean) {
    if (!isBusy) setFilterPaddingState(next);
  }
  const [resultError, setResultError] = useState<ResultError | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const analyzeVersion = useRef(0);
  const analyzedFingerprint = useRef<string | null>(null);
  const analyzeStarted = useRef(false);
  const fileVersion = useRef(0);
  const randomVersion = useRef(0);
  const randomController = useRef<AbortController | null>(null);
  const processing = useRef(false);

  const keyValidation = useMemo(
    () => validateHillKey(m, keyInputMode, matrix, keyword),
    [m, keyInputMode, matrix, keyword],
  );
  const fingerprint = keyValidation.payload ? JSON.stringify(keyValidation.payload) : null;
  const sourceText = inputType === "file" ? fileText : text;
  const localInputError = useMemo(() => validateHillText(sourceText), [sourceText]);
  const inputError =
    (inputType === "file"
      ? (fileError ?? (!file ? "Chọn file .txt để bắt đầu." : localInputError))
      : localInputError) ??
    (resultError && ["E01", "E06"].includes(resultError.code) ? resultError.message : null);
  const isBusy = isProcessing || isReadingFile || isRandomizing;
  const canSubmit =
    active &&
    !isBusy &&
    !inputError &&
    fingerprint !== null &&
    analysis.status === "valid" &&
    analysis.fingerprint === fingerprint;

  const randomFailed = analysis.retry === "random" && analysis.error !== undefined;

  useEffect(() => {
    if (
      !active ||
      randomFailed ||
      isRandomizing ||
      !fingerprint ||
      analyzedFingerprint.current === fingerprint
    )
      return;
    const requestId = ++analyzeVersion.current;
    const controller = new AbortController();
    const delay = analyzeStarted.current ? 300 : 0;
    analyzeStarted.current = true;
    const timer = window.setTimeout(() => {
      setAnalysis({ status: "loading", fingerprint, data: null, message: null });
      void gateway
        .analyze(JSON.parse(fingerprint), controller.signal)
        .then((response) => {
          if (controller.signal.aborted || requestId !== analyzeVersion.current) return;
          analyzedFingerprint.current = fingerprint;
          setAnalysis({ status: "valid", fingerprint, data: response, message: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestId !== analyzeVersion.current) return;
          const mapped = errorMessage(error);
          setAnalysis({
            status: KEY_ERRORS.has(mapped.code) ? "invalid" : "error",
            fingerprint,
            data: null,
            message: mapped.message,
            error: mapped,
            retry: "analyze",
          });
        });
    }, delay);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [active, fingerprint, gateway, analysisRetry, isRandomizing, randomFailed]);

  function clearResult() {
    setResult(null);
    setResultError(null);
    setNotice(null);
  }

  function invalidateKey() {
    analyzedFingerprint.current = null;
    setAnalysis(idleAnalysis());
    setAnalysisRetry((value) => value + 1);
    clearResult();
  }

  function setMode(next: CipherMode) {
    if (isBusy || next === mode) return;
    setModeState(next);
    clearResult();
  }

  function setText(next: string) {
    if (isBusy) return false;
    fileVersion.current += 1;
    setTextState(next);
    clearResult();
    return true;
  }

  function setMatrixCell(row: number, column: number, raw: string) {
    if (isBusy) return;
    setMatrix((current) =>
      current.map((cells, index) =>
        index === row ? cells.map((cell, cellIndex) => (cellIndex === column ? raw : cell)) : cells,
      ),
    );
    invalidateKey();
  }

  function setKeywordState(next: string) {
    if (isBusy) return;
    setKeywordRaw(next);
    const derived = keywordMatrix(next, m);
    if (derived) setMatrix(derived.map((row) => row.map(String)));
    invalidateKey();
  }

  function setInputMode(next: HillKeyInputMode) {
    if (isBusy || next === keyInputMode) return;
    setKeyInputMode(next);
    invalidateKey();
  }

  async function randomKey(size: HillSize = m) {
    if (processing.current || isReadingFile) return;
    randomController.current?.abort();
    const controller = new AbortController();
    randomController.current = controller;
    const version = ++randomVersion.current;
    setIsRandomizing(true);
    invalidateKey();
    try {
      const response = await gateway.random(size, controller.signal);
      if (controller.signal.aborted || version !== randomVersion.current) return;
      const nextFingerprint = JSON.stringify({ key: response.result.matrix });
      analyzedFingerprint.current = nextFingerprint;
      setMatrix(response.result.matrix.map((row) => row.map(String)));
      setAnalysis({ status: "valid", fingerprint: nextFingerprint, data: response, message: null });
      setKeywordRaw("");
      setKeyInputMode("grid");
    } catch (error) {
      if (controller.signal.aborted || version !== randomVersion.current) return;
      const mapped = errorMessage(error);
      setAnalysis({
        status: KEY_ERRORS.has(mapped.code) ? "invalid" : "error",
        fingerprint: null,
        data: null,
        message: mapped.message,
        error: mapped,
        retry: "random",
      });
    } finally {
      if (version === randomVersion.current) setIsRandomizing(false);
    }
  }

  function setSize(next: HillSize) {
    if (processing.current || isReadingFile || next === m) return;
    setM(next);
    setKeyInputMode("grid");
    setKeywordRaw("");
    setMatrix(Array.from({ length: next }, () => Array(next).fill("")));
    invalidateKey();
    void randomKey(next);
  }

  function setStripDiacritics(next: boolean) {
    if (isBusy || next === stripDiacritics) return;
    setStripDiacriticsState(next);
    clearResult();
  }

  function setInputType(next: InputType) {
    if (isBusy || next === inputType) return;
    setInputTypeState(next);
    clearResult();
  }

  function removeFile() {
    if (isBusy) return;
    fileVersion.current += 1;
    setFile(null);
    setFileText("");
    setFileError(null);
    clearResult();
  }

  function clearInput() {
    if (inputType === "file") removeFile();
    else setText("");
  }

  async function loadFile(file: File) {
    if (isBusy) return;
    const error = validateHillFile(file);
    if (error) {
      setFileError(error);
      return;
    }
    const version = ++fileVersion.current;
    setIsReadingFile(true);
    setFileError(null);
    try {
      const content = await readHillFile(file);
      if (version !== fileVersion.current) return;
      setFileText(content);
      setFile(file);
      setInputTypeState("file");
      clearResult();
    } catch {
      if (version === fileVersion.current)
        setFileError("Không đọc được file. Lưu lại file với mã hóa UTF-8.");
    } finally {
      if (version === fileVersion.current) setIsReadingFile(false);
    }
  }

  async function processCipher(stripOverride = stripDiacritics) {
    if (!canSubmit || processing.current || !keyValidation.payload || !keyValidation.matrix) return;
    const snapshot = {
      mode,
      text: sourceText,
      payload: keyValidation.payload,
      stripDiacritics: stripOverride,
    };
    processing.current = true;
    setIsProcessing(true);
    setResult(null);
    setResultError(null);
    setNotice(null);
    try {
      const response = await gateway.process(snapshot.mode, {
        text: snapshot.text,
        ...snapshot.payload,
        options: { stripDiacritics: snapshot.stripDiacritics, padChar: "X" },
      });
      setResult({
        ...response,
        mode: snapshot.mode,
        source: snapshot.text,
      });
    } catch (error) {
      const mapped = errorMessage(error);
      if (KEY_ERRORS.has(mapped.code)) {
        analyzedFingerprint.current = null;
        setAnalysis({
          status: "invalid",
          fingerprint,
          data: null,
          message: mapped.message,
          error: mapped,
        });
      } else setResultError(mapped);
    } finally {
      processing.current = false;
      setIsProcessing(false);
    }
  }

  function enableStripAndRetry() {
    if (isBusy) return;
    setStripDiacriticsState(true);
    void processCipher(true);
  }

  function retryAnalysis() {
    if (!fingerprint || isBusy) return;
    analyzedFingerprint.current = null;
    setAnalysis(idleAnalysis());
    setAnalysisRetry((value) => value + 1);
  }

  function retryKeyRequest() {
    if (analysis.status !== "error" || isBusy) return;
    if (analysis.retry !== "random") retryAnalysis();
    else void randomKey(m);
  }

  function downloadResult() {
    if (!result) return;
    saveBlob(
      new Blob([displayResult], { type: "text/plain;charset=utf-8" }),
      `hill.${result.mode === "encrypt" ? "encrypted" : "decrypted"}.txt`,
    );
  }

  function loadExample() {
    if (isBusy) return;
    setModeState("encrypt");
    setTextState("HELP");
    setInputTypeState("text");
    setFile(null);
    setFileText("");
    setFileError(null);
    setM(2);
    setKeyInputMode("grid");
    setMatrix(defaultMatrix());
    setKeywordRaw("");
    setStripDiacriticsState(false);
    invalidateKey();
  }

  function resetAll() {
    randomController.current?.abort();
    randomVersion.current += 1;
    fileVersion.current += 1;
    analyzedFingerprint.current = null;
    setModeState("encrypt");
    setTextState("");
    setInputTypeState("text");
    setFile(null);
    setFileText("");
    setFileError(null);
    setIsReadingFile(false);
    setIsRandomizing(false);
    setM(2);
    setKeyInputMode("grid");
    setMatrix(defaultMatrix());
    setKeywordRaw("");
    setStripDiacriticsState(false);
    setAnalysis(idleAnalysis());
    clearResult();
  }

  function seedText(next: string) {
    setTextState(next);
  }

  return {
    mode,
    setMode,
    text,
    setText,
    inputType,
    setInputType,
    file,
    fileText,
    removeFile,
    clearInput,
    fileError,
    isReadingFile,
    loadFile,
    m,
    setSize,
    keyInputMode,
    setInputMode,
    matrix,
    setMatrixCell,
    keyword,
    setKeyword: setKeywordState,
    stripDiacritics,
    setStripDiacritics,
    keyValidation,
    analysis,
    retryAnalysis,
    retryKeyRequest,
    randomKey,
    isRandomizing,
    result,
    displayResult,
    filterPadding,
    setFilterPadding,
    resultError,
    notice,
    setNotice,
    isProcessing,
    isBusy,
    inputError,
    canSubmit,
    processCipher,
    enableStripAndRetry,
    downloadResult,
    loadExample,
    clearResult,
    resetAll,
    seedText,
  };
}

export type HillCipherController = ReturnType<typeof useHillCipher>;
