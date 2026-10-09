import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  DiffieHellmanGatewayError,
  type DiffieHellmanGateway,
} from "../services/diffieHellmanGateway";
import { isDhExchangeResult, isDhPrivateValuesResult } from "../services/validateDhResult";
import type {
  DhDraft,
  DhExchangeRequest,
  DhExchangeResult,
  DhField,
  DhFieldErrors,
  DhParameters,
  DhStatus,
  DhTask,
} from "../types/cipher";
import { DH_FIELDS, normalizeDhDecimal, validateDhDraft } from "../utils/validation";

const EMPTY_DRAFT: DhDraft = { q: "", alpha: "", privateA: "", privateB: "" };
const PRESET: DhDraft = { q: "23", alpha: "5", privateA: "6", privateB: "15" };
const TIMEOUT_MESSAGE = "Yêu cầu quá thời gian chờ. Vui lòng thử lại.";
const RESPONSE_MESSAGE = "Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.";
const REQUEST_MESSAGE = "Không thể xử lý yêu cầu. Vui lòng thử lại.";

interface OperationState {
  supplementalBusy: boolean;
  status: DhStatus;
  task: DhTask | null;
  error: string | null;
  fieldErrors: DhFieldErrors;
  snapshot: DhParameters | null;
  result: DhExchangeResult | null;
}

const idleState = (): OperationState => ({
  supplementalBusy: false,
  status: "idle",
  task: null,
  error: null,
  fieldErrors: {},
  snapshot: null,
  result: null,
});

interface PendingRequest {
  kind: "main" | "supplemental";
  controller: AbortController;
  revision: number;
  timer?: ReturnType<typeof setTimeout>;
}

export function useDiffieHellman(gateway: DiffieHellmanGateway | null, active: boolean) {
  const [draft, setDraft] = useState<DhDraft>(() => ({ ...EMPTY_DRAFT }));
  const [operation, setOperation] = useState(idleState);
  const [resetVersion, setResetVersion] = useState(0);
  const [context, setContext] = useState({ active, gateway });
  const draftRef = useRef(draft);
  const activeRef = useRef(active);
  const gatewayRef = useRef(gateway);
  const mounted = useRef(true);
  const revision = useRef(0);
  const pending = useRef<PendingRequest | null>(null);

  // Reset view state when its owning context changes, without a cascading effect update.
  if (context.active !== active || context.gateway !== gateway) {
    setContext({ active, gateway });
    setOperation(idleState());
  }

  const invalidate = useCallback(() => {
    revision.current += 1;
    const old = pending.current;
    pending.current = null;
    if (old) {
      clearTimeout(old.timer);
      old.controller.abort();
    }
  }, []);

  const clearResults = useCallback(() => {
    invalidate();
    setOperation(idleState());
  }, [invalidate]);

  // Invalidate before async callbacks can observe a newly committed workspace/gateway.
  useLayoutEffect(() => {
    mounted.current = true;
    activeRef.current = active;
    gatewayRef.current = gateway;
    invalidate();
    return () => {
      mounted.current = false;
      invalidate();
    };
  }, [active, gateway, invalidate]);

  function replaceDraft(next: DhDraft) {
    draftRef.current = { ...next };
    setDraft(draftRef.current);
  }

  function setParameter(field: DhField, value: string) {
    clearResults();
    replaceDraft({ ...draftRef.current, [field]: value });
  }

  function updateParameters(values: Partial<DhDraft>) {
    clearResults();
    replaceDraft({ ...draftRef.current, ...values });
  }

  function cancelSupplemental() {
    if (pending.current?.kind !== "supplemental") return;
    invalidate();
    setOperation((previous) => ({ ...previous, supplementalBusy: false }));
  }

  async function runSupplemental<T>(action: (signal: AbortSignal) => Promise<T>) {
    if (!gatewayRef.current || !activeRef.current || !mounted.current || pending.current)
      return undefined;
    const controller = new AbortController();
    const current: PendingRequest = {
      kind: "supplemental",
      controller,
      revision: revision.current,
    };
    pending.current = current;
    const isCurrent = () =>
      mounted.current &&
      activeRef.current &&
      pending.current === current &&
      revision.current === current.revision &&
      !controller.signal.aborted;
    let rejectAbort!: (reason: unknown) => void;
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = reject;
    });
    const onAbort = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener("abort", onAbort, { once: true });
    setOperation((previous) => ({ ...previous, supplementalBusy: true }));
    try {
      const response = await Promise.race([action(controller.signal), aborted]);
      return isCurrent() ? response : undefined;
    } catch (error) {
      if (isCurrent()) throw error;
      return undefined;
    } finally {
      controller.signal.removeEventListener("abort", onAbort);
      if (pending.current === current) {
        pending.current = null;
        setOperation((previous) => ({ ...previous, supplementalBusy: false }));
      }
    }
  }

  function choosePreset(parameters: DhParameters) {
    clearResults();
    replaceDraft(parameters);
    setResetVersion((previous) => previous + 1);
  }

  function resetAll() {
    choosePreset(EMPTY_DRAFT);
  }

  async function run(task: DhTask) {
    // The ref prevents double submits and exchange/random overlap before React rerenders.
    if (
      !gateway ||
      gatewayRef.current !== gateway ||
      !activeRef.current ||
      !mounted.current ||
      pending.current
    )
      return;
    clearResults();
    const fields =
      task === "exchange"
        ? DH_FIELDS.filter(
            (field) => field === "q" || field === "alpha" || draftRef.current[field].trim() !== "",
          )
        : (["q", "alpha"] as const);
    const fieldErrors = validateDhDraft(draftRef.current, fields);
    const error = Object.values(fieldErrors)[0];
    if (error) {
      setOperation({ ...idleState(), status: "error", task, error, fieldErrors });
      return;
    }
    const source = { ...draftRef.current };
    const request: DhExchangeRequest = {
      q: normalizeDhDecimal(source.q),
      alpha: normalizeDhDecimal(source.alpha),
      ...(task === "exchange" && source.privateA.trim() !== ""
        ? { privateA: normalizeDhDecimal(source.privateA) }
        : {}),
      ...(task === "exchange" && source.privateB.trim() !== ""
        ? { privateB: normalizeDhDecimal(source.privateB) }
        : {}),
    };
    const controller = new AbortController();
    const current: PendingRequest = { kind: "main", controller, revision: revision.current };
    pending.current = current;
    let timedOut = false;
    const isCurrent = () =>
      mounted.current &&
      activeRef.current &&
      gatewayRef.current === gateway &&
      revision.current === current.revision &&
      pending.current === current;

    let rejectAbort!: (reason?: unknown) => void;
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = reject;
    });
    const onAbort = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener("abort", onAbort, { once: true });
    current.timer = setTimeout(() => {
      if (!isCurrent()) return;
      timedOut = true;
      controller.abort(new DOMException("Request timed out", "TimeoutError"));
    }, 15_000);
    setOperation({ ...idleState(), status: "loading", task });

    try {
      const response = await Promise.race([
        task === "exchange"
          ? gateway.exchange(request, controller.signal)
          : gateway.generatePrivateValues(
              { q: request.q, alpha: request.alpha },
              controller.signal,
            ),
        aborted,
      ]);
      if (!isCurrent() || controller.signal.aborted) return;
      if (task === "exchange") {
        if (!isDhExchangeResult(response, request)) {
          setOperation({ ...idleState(), status: "error", task, error: RESPONSE_MESSAGE });
          return;
        }
        const { q, alpha, privateA, privateB } = response;
        setOperation({
          ...idleState(),
          status: "success",
          task,
          snapshot: { q, alpha, privateA, privateB },
          result: response,
        });
      } else {
        if (!isDhPrivateValuesResult(response, request)) {
          setOperation({ ...idleState(), status: "error", task, error: RESPONSE_MESSAGE });
          return;
        }
        replaceDraft({ ...source, privateA: response.privateA, privateB: response.privateB });
        setOperation({ ...idleState(), status: "success", task });
      }
    } catch (failure) {
      if (!isCurrent()) return;
      if (controller.signal.aborted && !timedOut) {
        setOperation(idleState());
        return;
      }
      const business = failure instanceof DiffieHellmanGatewayError ? failure : null;
      const error = timedOut ? TIMEOUT_MESSAGE : business?.message || REQUEST_MESSAGE;
      const fieldErrors: DhFieldErrors = {};
      if (!timedOut && business?.field && DH_FIELDS.includes(business.field)) {
        fieldErrors[business.field] = error;
      }
      setOperation({ ...idleState(), status: "error", task, error, fieldErrors });
    } finally {
      clearTimeout(current.timer);
      controller.signal.removeEventListener("abort", onAbort);
      // Never clear a new task's lock when an older request finishes.
      if (pending.current === current) pending.current = null;
    }
  }

  return {
    draft,
    ...operation,
    resetVersion,
    isBusy: operation.status === "loading" || operation.supplementalBusy,
    hasGateway: gateway !== null,
    setParameter,
    updateParameters,
    runSupplemental,
    cancelSupplemental,
    choosePreset,
    resetAll,
    loadExample: () => choosePreset(PRESET),
    clearResults,
    exchange: () => run("exchange"),
    generatePrivateValues: () => run("random"),
  };
}

export type DiffieHellmanController = ReturnType<typeof useDiffieHellman>;
