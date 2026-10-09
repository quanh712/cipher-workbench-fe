import {
  DiffieHellmanGatewayError,
  type DiffieHellmanGateway,
} from "../../../src/features/diffieHellman/services/diffieHellmanGateway";
import type { DhTask } from "../../../src/features/diffieHellman/types/cipher";
import {
  createDhPresetResult,
  createDhRandomValues,
  createDhSwappedResult,
} from "../../../src/features/diffieHellman/test/fixtures";

type Scenario = "business" | "network" | "invalid" | "late";
interface Pending {
  resolve: () => void;
  reject: () => void;
}

declare global {
  interface Window {
    __dhTest: {
      enqueue: (task: DhTask, scenario: Scenario) => void;
      release: (id: number, reject?: boolean) => void;
      calls: { task: DhTask; aborted: boolean }[];
      pending: number[];
    };
  }
}

// Browser-test entry only; production main.tsx never imports this fixture.
// Controlled promises intentionally ignore abort to exercise stale-response guards.
const queues: Record<DhTask, Scenario[]> = { exchange: [], random: [] };
const pending = new Map<number, Pending>();
window.__dhTest = {
  calls: [],
  pending: [],
  enqueue(task, scenario) {
    queues[task].push(scenario);
  },
  release(id, reject = false) {
    const request = pending.get(id);
    if (!request) throw new Error("Unknown test request");
    pending.delete(id);
    this.pending = this.pending.filter((value) => value !== id);
    if (reject) request.reject();
    else request.resolve();
  },
};

async function run<T>(task: DhTask, signal: AbortSignal, fixture: () => T): Promise<T> {
  signal.throwIfAborted();
  const id = window.__dhTest.calls.length;
  const call = { task, aborted: false };
  window.__dhTest.calls.push(call);
  signal.addEventListener(
    "abort",
    () => {
      call.aborted = true;
    },
    { once: true },
  );
  switch (queues[task].shift()) {
    case "business":
      throw new DiffieHellmanGatewayError(
        "Lỗi thử nghiệm <Backend> & yêu cầu thử lại.",
        "INVALID_REQUEST",
        "alpha",
      );
    case "network":
      throw new Error("Private internal exception must not be displayed");
    case "invalid":
      return { matched: true } as T;
    case "late":
      return new Promise<T>((resolve, reject) => {
        window.__dhTest.pending.push(id);
        pending.set(id, {
          resolve: () => resolve(fixture()),
          reject: () => reject(new Error("Stale internal exception")),
        });
      });
    default:
      return fixture();
  }
}

export const gateway: DiffieHellmanGateway = {
  exchange(request, signal) {
    return run("exchange", signal, () =>
      request.privateA === "15" ? createDhSwappedResult() : createDhPresetResult(),
    );
  },
  generatePrivateValues(_, signal) {
    return run("random", signal, createDhRandomValues);
  },
};
