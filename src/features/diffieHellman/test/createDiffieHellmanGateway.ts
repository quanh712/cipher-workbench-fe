import { vi } from "vitest";
import {
  DiffieHellmanGatewayError,
  type DiffieHellmanGateway,
} from "../services/diffieHellmanGateway";
import type { DhExchangeRequest, DhTask } from "../types/cipher";
import { createDhPresetResult, createDhRandomValues, createDhSwappedResult } from "./fixtures";

export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export type DhFakeScenario =
  | { kind: "success" }
  | { kind: "error"; error?: Error }
  // Remains pending until the controller aborts (e.g. its 15-second timeout).
  | { kind: "timeout" }
  // Intentionally ignores subsequent aborts to exercise stale response/error guards.
  | { kind: "late"; response: Promise<unknown> }
  // Deliberately violates the typed boundary, only for defensive consumer tests.
  | { kind: "invalid-schema"; value?: unknown };

export type DhFakeOptions = Partial<Record<DhTask, readonly DhFakeScenario[]>>;

function waitUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      signal.removeEventListener("abort", onAbort);
      onAbort();
    }
  });
}

/** Unsafe injection stays isolated here; production adapters must validate unknown values. */
function injectInvalidResponse<T>(value: unknown): T {
  return structuredClone(value) as T;
}

/**
 * Test-only gateway following RSA's canned-result approach, with per-task scenario queues.
 * No HTTP, DH arithmetic, random generation, real timer or storage side effects.
 * When a queue is exhausted the task returns its normal fixture again.
 */
export function createDiffieHellmanGateway(options: DhFakeOptions = {}) {
  const queues = { exchange: [...(options.exchange ?? [])], random: [...(options.random ?? [])] };

  async function run<T>(task: DhTask, signal: AbortSignal, fixture: () => T): Promise<T> {
    signal.throwIfAborted();
    const scenario = queues[task].shift();
    switch (scenario?.kind) {
      case "error":
        throw (
          scenario.error ??
          new DiffieHellmanGatewayError(
            "Lỗi thử nghiệm <Backend> & yêu cầu thử lại.",
            "INVALID_REQUEST",
            "alpha",
          )
        );
      case "timeout":
        return waitUntilAborted(signal);
      case "late":
        return (await scenario.response) as T;
      case "invalid-schema":
        return injectInvalidResponse<T>(
          "value" in scenario ? scenario.value : { q: 23, matched: "true" },
        );
      default:
        return fixture();
    }
  }

  function exchangeFixture(parameters: DhExchangeRequest) {
    if (parameters.q === "23" && parameters.alpha === "5") {
      if ((parameters.privateA ?? "6") === "6" && (parameters.privateB ?? "15") === "15") {
        return createDhPresetResult();
      }
      if (parameters.privateA === "15" && parameters.privateB === "6") {
        return createDhSwappedResult();
      }
    }
    throw new Error("Bộ tham số chưa có fixture DH test.");
  }

  return {
    exchange: vi.fn<DiffieHellmanGateway["exchange"]>((parameters, signal) =>
      run("exchange", signal, () => exchangeFixture(parameters)),
    ),
    generatePrivateValues: vi.fn<DiffieHellmanGateway["generatePrivateValues"]>(
      (parameters, signal) =>
        run("random", signal, () => {
          if (parameters.q !== "23" || parameters.alpha !== "5") {
            throw new Error("Bộ tham số chưa có fixture DH test.");
          }
          return createDhRandomValues();
        }),
    ),
  } satisfies DiffieHellmanGateway;
}
