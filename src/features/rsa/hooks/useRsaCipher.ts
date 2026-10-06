import { useCallback, useEffect, useRef, useState } from "react";
import { RsaGatewayError, type RsaGateway } from "../services/rsaGateway";
import type {
  RsaDraft,
  RsaFieldErrors,
  RsaKeyResult,
  RsaNumberResult,
  RsaParameters,
  RsaStatus,
  RsaTask,
  RsaTextResult,
} from "../types/cipher";
import { decimal, validateNumber, validateParameters, validateText } from "../utils/validation";

const initialDraft: RsaDraft = {
  p: "17",
  q: "11",
  e: "7",
  plaintext: "88",
  text: "Xin chao",
};

const initialStatuses: Record<RsaTask, RsaStatus> = {
  key: "idle",
  number: "idle",
  text: "idle",
};

const fallbackError = "Không thể xử lý yêu cầu. Vui lòng thử lại.";

export function useRsaCipher(gateway: RsaGateway | null, active: boolean) {
  const [draft, setDraft] = useState<RsaDraft>(initialDraft);
  const [key, setKey] = useState<RsaKeyResult | null>(null);
  const [numberResult, setNumberResult] = useState<RsaNumberResult | null>(null);
  const [textResult, setTextResult] = useState<RsaTextResult | null>(null);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [fieldErrors, setFieldErrors] = useState<RsaFieldErrors>({});
  const [taskErrors, setTaskErrors] = useState<Partial<Record<RsaTask, string>>>({});
  const draftRef = useRef(draft);
  const activeRef = useRef(active);
  const started = useRef(false);
  const versions = useRef<Record<RsaTask, number>>({ key: 0, number: 0, text: 0 });
  const controllers = useRef<Partial<Record<RsaTask, AbortController>>>({});
  activeRef.current = active;

  const cancel = useCallback((task: RsaTask) => {
    versions.current[task] += 1;
    controllers.current[task]?.abort();
    delete controllers.current[task];
  }, []);

  const cancelAll = useCallback(() => {
    cancel("key");
    cancel("number");
    cancel("text");
  }, [cancel]);

  const clearResults = useCallback(() => {
    cancelAll();
    setKey(null);
    setNumberResult(null);
    setTextResult(null);
    setStatuses(initialStatuses);
    setFieldErrors({});
    setTaskErrors({});
  }, [cancelAll]);

  const runTask = useCallback(
    async <Result>(
      task: RsaTask,
      request: (signal: AbortSignal) => Promise<Result>,
      onSuccess: (result: Result) => void,
    ) => {
      if (!activeRef.current) return;
      cancel(task);
      const controller = new AbortController();
      const version = versions.current[task];
      controllers.current[task] = controller;
      const isCurrent = () =>
        !controller.signal.aborted && version === versions.current[task] && activeRef.current;
      setTaskErrors((previous) => ({ ...previous, [task]: undefined }));
      setStatuses((previous) => ({ ...previous, [task]: "loading" }));
      try {
        const result = await request(controller.signal);
        if (!isCurrent()) return;
        onSuccess(result);
        setStatuses((previous) => ({ ...previous, [task]: "success" }));
      } catch (error) {
        if (!isCurrent()) return;
        setTaskErrors((previous) => ({
          ...previous,
          [task]:
            error instanceof RsaGatewayError && error.message.trim()
              ? error.message
              : fallbackError,
        }));
        setStatuses((previous) => ({ ...previous, [task]: "error" }));
      } finally {
        if (version === versions.current[task]) delete controllers.current[task];
      }
    },
    [cancel],
  );

  const startNumber = useCallback(
    async (parameters: RsaParameters, plaintext: string) => {
      if (!gateway || !activeRef.current) return;
      const errors = validateNumber({ ...draftRef.current, plaintext });
      setFieldErrors((previous) => ({ ...previous, plaintext: errors.plaintext }));
      if (errors.plaintext) return;
      setNumberResult(null);
      await runTask(
        "number",
        (signal) =>
          gateway.roundTripNumber({ ...parameters, plaintext: decimal(plaintext)! }, signal),
        setNumberResult,
      );
    },
    [gateway, runTask],
  );

  const startText = useCallback(
    async (parameters: RsaParameters, text: string) => {
      if (!gateway || !activeRef.current) return;
      const errors = validateText({ ...draftRef.current, text });
      setFieldErrors((previous) => ({ ...previous, text: errors.text }));
      if (errors.text) return;
      setTextResult(null);
      await runTask(
        "text",
        (signal) => gateway.roundTripText({ ...parameters, text }, signal),
        setTextResult,
      );
    },
    [gateway, runTask],
  );

  const generateKey = useCallback(
    async (parameters: RsaParameters = draftRef.current, runExamples = false) => {
      if (!gateway || !activeRef.current) return;
      clearResults();
      const errors = validateParameters(parameters);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;

      const normalized: RsaParameters = {
        p: decimal(parameters.p)!,
        q: decimal(parameters.q)!,
        e: decimal(parameters.e)!,
      };
      await runTask(
        "key",
        (signal) => gateway.generateKey(normalized, signal),
        (result) => {
          setKey(result);
          if (runExamples) {
            void startNumber(normalized, draftRef.current.plaintext);
            void startText(normalized, draftRef.current.text);
          }
        },
      );
    },
    [clearResults, gateway, runTask, startNumber, startText],
  );

  useEffect(() => {
    if (!active || !gateway || started.current) return;
    started.current = true;
    void generateKey(initialDraft, true);
  }, [active, gateway, generateKey]);

  useEffect(() => {
    if (active) return;
    clearResults();
  }, [active, clearResults]);

  useEffect(() => () => cancelAll(), [cancelAll]);

  function setParameter(field: keyof RsaParameters, value: string) {
    clearResults();
    draftRef.current = { ...draftRef.current, [field]: value };
    setDraft(draftRef.current);
  }

  function choosePreset(parameters: RsaParameters) {
    draftRef.current = { ...draftRef.current, ...parameters };
    setDraft(draftRef.current);
    void generateKey(parameters);
  }

  function setPlaintext(value: string) {
    cancel("number");
    draftRef.current = { ...draftRef.current, plaintext: value };
    setDraft(draftRef.current);
    setNumberResult(null);
    setStatuses((previous) => ({ ...previous, number: "idle" }));
    setFieldErrors((previous) => ({ ...previous, plaintext: undefined }));
    setTaskErrors((previous) => ({ ...previous, number: undefined }));
  }

  function setText(value: string) {
    cancel("text");
    draftRef.current = { ...draftRef.current, text: value };
    setDraft(draftRef.current);
    setTextResult(null);
    setStatuses((previous) => ({ ...previous, text: "idle" }));
    setFieldErrors((previous) => ({ ...previous, text: undefined }));
    setTaskErrors((previous) => ({ ...previous, text: undefined }));
  }

  function processNumber() {
    if (!key) return;
    void startNumber({ p: key.p, q: key.q, e: key.e }, draftRef.current.plaintext);
  }

  function processText() {
    if (!key) return;
    void startText({ p: key.p, q: key.q, e: key.e }, draftRef.current.text);
  }

  function resetAll() {
    clearResults();
    draftRef.current = initialDraft;
    setDraft(initialDraft);
  }

  return {
    draft,
    key,
    numberResult,
    textResult,
    statuses,
    fieldErrors,
    taskErrors,
    isBusy: Object.values(statuses).includes("loading"),
    hasGateway: gateway !== null,
    setParameter,
    choosePreset,
    generateKey,
    setPlaintext,
    setText,
    processNumber,
    processText,
    resetAll,
  };
}

export type RsaCipherController = ReturnType<typeof useRsaCipher>;
