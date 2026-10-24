import { useCallback, useEffect, useRef, useState } from "react";
import { RsaGatewayError, type RsaGateway } from "../services/rsaGateway";
import type {
  RsaDraft,
  RsaFieldErrors,
  RsaKeyResult,
  RsaParameters,
  RsaStatus,
  RsaTask,
  RsaMode,
  RsaInputType,
  RsaTransformResult,
  RsaTransformRequest,
  RsaTextMode,
  RsaKeyBits,
} from "../types/cipher";
import { decimal, validateParameters } from "../utils/validation";

const initialDraft: RsaDraft = { p: "", q: "", e: "", plaintext: "", text: "" };
const exampleDraft: RsaDraft = { p: "17", q: "11", e: "7", plaintext: "88", text: "Xin chao" };
const initialStatuses: Record<RsaTask, RsaStatus> = { key: "idle", number: "idle", text: "idle" };
const emptyManualKey = { e: "", d: "", n: "" };
const initialInputs = {
  number: { encrypt: "", decrypt: "" },
  text: { encrypt: "", decrypt: "" },
};

export function parseRsaCipher(value: string, inputType: RsaInputType): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new RsaGatewayError('Nhập bản mã là mảng JSON chuỗi số, ví dụ ["11","76"].');
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.length ||
    !parsed.every((item) => typeof item === "string" && /^\d{1,128}$/.test(item)) ||
    (inputType === "number" && parsed.length !== 1)
  ) {
    throw new RsaGatewayError(
      inputType === "number"
        ? 'Bản mã số cần đúng một chuỗi số, ví dụ ["11"].'
        : "Bản mã cần là mảng không rỗng gồm các chuỗi số thập phân.",
    );
  }
  return parsed as string[];
}

export function parseRsaBlockCipher(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    /* Display the format hint below. */
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    ("mode" in parsed && parsed.mode !== "block") ||
    !("cipher" in parsed) ||
    !("originalUtf8ByteLength" in parsed) ||
    !Number.isSafeInteger(parsed.originalUtf8ByteLength) ||
    Number(parsed.originalUtf8ByteLength) < 1 ||
    Number(parsed.originalUtf8ByteLength) > 40_000
  )
    throw new RsaGatewayError(
      "Bản mã block cần JSON gồm cipher và originalUtf8ByteLength (1–40000 byte).",
    );
  return {
    cipher: parseRsaCipher(JSON.stringify(parsed.cipher), "text"),
    originalUtf8ByteLength: parsed.originalUtf8ByteLength as number,
  };
}

export function useRsaCipher(gateway: RsaGateway | null, active: boolean) {
  const [draft, setDraft] = useState(initialDraft);
  const [generationMode, setGenerationModeState] = useState<"manual" | "random">("manual");
  const [keyBits, setKeyBitsState] = useState<RsaKeyBits>(32);
  const [textMode, setTextModeState] = useState<RsaTextMode>("char");
  const [textSource, setTextSourceState] = useState<"text" | "file">("text");
  const [file, setFileState] = useState<File | null>(null);
  const [traceIndex, setTraceIndexState] = useState("");
  const [resetVersion, setResetVersion] = useState(0);
  const [key, setKey] = useState<RsaKeyResult | null>(null);
  const [keySource, setKeySourceState] = useState<"generate" | "manual">("generate");
  const [manualKey, setManualKeyState] = useState(emptyManualKey);
  const [modes, setModes] = useState<Record<RsaInputType, RsaMode>>({
    number: "encrypt",
    text: "encrypt",
  });
  const [inputs, setInputs] = useState(initialInputs);
  const [results, setResults] = useState<Partial<Record<RsaInputType, RsaTransformResult>>>({});
  const [statuses, setStatuses] = useState(initialStatuses);
  const [fieldErrors, setFieldErrors] = useState<RsaFieldErrors>({});
  const [taskErrors, setTaskErrors] = useState<Partial<Record<RsaTask, string>>>({});
  const activeRef = useRef(active);
  const versions = useRef<Record<RsaTask, number>>({ key: 0, number: 0, text: 0 });
  const controllers = useRef<Partial<Record<RsaTask, AbortController>>>({});
  activeRef.current = active;

  const clearTask = useCallback((task: RsaTask) => {
    versions.current[task] += 1;
    controllers.current[task]?.abort();
    delete controllers.current[task];
    setStatuses((previous) => ({ ...previous, [task]: "idle" }));
    setTaskErrors((previous) => ({ ...previous, [task]: undefined }));
    if (task !== "key") setResults((previous) => ({ ...previous, [task]: undefined }));
  }, []);
  const clearTransforms = useCallback(() => {
    clearTask("number");
    clearTask("text");
  }, [clearTask]);
  const clearResults = useCallback(() => {
    clearTask("key");
    clearTransforms();
    setKey(null);
    setFieldErrors({});
  }, [clearTask, clearTransforms]);

  const runTask = useCallback(
    async <Result>(
      task: RsaTask,
      request: (signal: AbortSignal) => Promise<Result>,
      onSuccess: (result: Result) => void,
    ) => {
      if (!activeRef.current || controllers.current[task]) return;
      clearTask(task);
      const controller = new AbortController();
      const version = versions.current[task];
      controllers.current[task] = controller;
      const isCurrent = () =>
        !controller.signal.aborted && version === versions.current[task] && activeRef.current;
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
            error instanceof RsaGatewayError
              ? error.message
              : "Không thể xử lý yêu cầu. Vui lòng thử lại.",
        }));
        setStatuses((previous) => ({ ...previous, [task]: "error" }));
      } finally {
        if (version === versions.current[task]) delete controllers.current[task];
      }
    },
    [clearTask],
  );

  useEffect(() => {
    if (!active) {
      clearResults();
      setFileState(null);
    }
  }, [active, clearResults]);
  useEffect(
    () => () => {
      for (const task of ["key", "number", "text"] as const) {
        versions.current[task] += 1;
        controllers.current[task]?.abort();
        delete controllers.current[task];
      }
    },
    [],
  );

  function setParameter(field: keyof RsaParameters, value: string) {
    clearResults();
    setDraft((previous) => ({ ...previous, [field]: value }));
  }
  function choosePreset(parameters: RsaParameters) {
    clearResults();
    setGenerationModeState("manual");
    setDraft((previous) => ({ ...previous, ...parameters }));
  }
  async function generateKey() {
    if (!gateway || !activeRef.current || controllers.current.key) return;
    clearResults();
    if (generationMode === "random") {
      await runTask(
        "key",
        (signal) => gateway.generateRandomKey(keyBits, signal),
        (result) => {
          setKey(result);
          setDraft((previous) => ({ ...previous, p: result.p, q: result.q, e: result.e }));
        },
      );
      return;
    }
    const errors = validateParameters(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setStatuses((previous) => ({ ...previous, key: "error" }));
      return;
    }
    await runTask(
      "key",
      (signal) =>
        gateway.generateKey(
          { p: decimal(draft.p)!, q: decimal(draft.q)!, e: decimal(draft.e)! },
          signal,
        ),
      setKey,
    );
  }
  function setKeySource(source: "generate" | "manual") {
    clearTask("key");
    clearTransforms();
    setKeySourceState(source);
  }
  function setManualKey(field: keyof typeof emptyManualKey, value: string) {
    clearTransforms();
    setManualKeyState((previous) => ({ ...previous, [field]: value }));
  }
  function setMode(task: RsaInputType, mode: RsaMode) {
    clearTask(task);
    if (task === "text") setFileState(null);
    setModes((previous) => ({ ...previous, [task]: mode }));
  }
  function setInput(task: RsaInputType, value: string) {
    clearTask(task);
    setInputs((previous) => ({ ...previous, [task]: { ...previous[task], [modes[task]]: value } }));
  }
  function process(task: RsaInputType) {
    if (!gateway || controllers.current[task]) return;
    clearTask(task);
    try {
      const mode = modes[task];
      const selectedKey = keySource === "manual" ? manualKey : key;
      if (!selectedKey) throw new RsaGatewayError("Hãy sinh khóa hoặc nhập khóa trước khi xử lý.");
      const exponentField = mode === "encrypt" ? "e" : "d";
      const exponent = decimal(selectedKey[exponentField]);
      const n = decimal(selectedKey.n);
      if (
        !n ||
        !exponent ||
        n.length > 128 ||
        exponent.length > 128 ||
        BigInt(n) < 2n ||
        BigInt(exponent) < 1n
      )
        throw new RsaGatewayError(
          `Nhập n ≥ 2 và ${exponentField} ≥ 1 dưới dạng số thập phân (tối đa 128 chữ số).`,
        );
      const traceBlockIndex = task === "text" ? Number(traceIndex) : 0;
      if (task === "text" && (!/^([0-9]{1,5})?$/.test(traceIndex) || traceBlockIndex > 39_999))
        throw new RsaGatewayError("Chỉ số khối trace phải từ 0 đến 39999.");
      if (task === "text" && mode === "encrypt" && textSource === "file") {
        if (!file) throw new RsaGatewayError("Vui lòng chọn file .txt.");
        if (!/\.txt$/i.test(file.name)) throw new RsaGatewayError("Chỉ chấp nhận file .txt.");
        if (!file.size || file.size > 1_000_000)
          throw new RsaGatewayError("File RSA cần từ 1 đến 1.000.000 byte, tối đa 10.000 ký tự.");
        void runTask(
          task,
          (signal) =>
            gateway.encryptFile(
              {
                file,
                n,
                e: exponent,
                mode: textMode,
                traceBlockIndex,
              },
              signal,
            ),
          (result) => setResults((previous) => ({ ...previous, [task]: result })),
        );
        return;
      }
      const input = inputs[task][mode];
      let request: RsaTransformRequest;
      if (mode === "encrypt") {
        if (!input.length) throw new RsaGatewayError("Nhập bản rõ trước khi xử lý.");
        if (task === "text" && Array.from(input).length > 10_000)
          throw new RsaGatewayError("Văn bản RSA tối đa 10.000 ký tự Unicode.");
        const data = task === "number" ? decimal(input) : input;
        if (data === null || (task === "number" && data.length > 128))
          throw new RsaGatewayError("P phải là số nguyên không âm, tối đa 128 chữ số.");
        request = { operation: mode, inputType: task, n, e: exponent, data };
      } else
        request = {
          operation: mode,
          inputType: task,
          n,
          d: exponent,
          ...(task === "text" && textMode === "block"
            ? parseRsaBlockCipher(input)
            : { cipher: parseRsaCipher(input, task) }),
        };
      if (task === "text" && textMode === "block") request.mode = "block";
      if (traceBlockIndex) request.traceBlockIndex = traceBlockIndex;
      void runTask(
        task,
        (signal) => gateway.transform(request, signal),
        (result) => setResults((previous) => ({ ...previous, [task]: result })),
      );
    } catch (error) {
      setTaskErrors((previous) => ({ ...previous, [task]: (error as Error).message }));
      setStatuses((previous) => ({ ...previous, [task]: "error" }));
    }
  }
  function resetAll() {
    setResetVersion((previous) => previous + 1);
    clearResults();
    setDraft(initialDraft);
    setManualKeyState(emptyManualKey);
    setKeySourceState("generate");
    setInputs(initialInputs);
    setGenerationModeState("manual");
    setKeyBitsState(32);
    setTextModeState("char");
    setTextSourceState("text");
    setFileState(null);
    setTraceIndexState("");
    setModes({ number: "encrypt", text: "encrypt" });
  }
  function loadExample() {
    resetAll();
    setDraft(exampleDraft);
    setInputs({
      number: { encrypt: exampleDraft.plaintext, decrypt: "" },
      text: { encrypt: exampleDraft.text, decrypt: "" },
    });
  }
  return {
    gateway,
    active,
    generationMode,
    keyBits,
    textMode,
    textSource,
    file,
    traceIndex,
    setGenerationMode: (value: "manual" | "random") => {
      clearResults();
      setGenerationModeState(value);
    },
    setKeyBits: (value: RsaKeyBits) => {
      clearResults();
      setKeyBitsState(value);
    },
    setTextMode: (value: RsaTextMode) => {
      clearTask("text");
      setTextModeState(value);
    },
    setTextSource: (value: "text" | "file") => {
      clearTask("text");
      setTextSourceState(value);
      setFileState(null);
    },
    setFile: (value: File | null) => {
      clearTask("text");
      setFileState(value);
    },
    setTraceIndex: (value: string) => {
      clearTask("text");
      setTraceIndexState(value);
    },
    resetVersion,
    draft,
    key,
    keySource,
    manualKey,
    modes,
    inputs,
    results,
    statuses,
    fieldErrors,
    taskErrors,
    hasGateway: gateway !== null,
    isBusy: Object.values(statuses).includes("loading"),
    setParameter,
    choosePreset,
    generateKey,
    setKeySource,
    setManualKey,
    setMode,
    setInput,
    process,
    clearTask,
    resetAll,
    loadExample,
  };
}
export type RsaCipherController = ReturnType<typeof useRsaCipher>;
