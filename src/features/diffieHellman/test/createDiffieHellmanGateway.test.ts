import { describe, expect, it, vi } from "vitest";
import {
  DiffieHellmanGatewayError,
  type DiffieHellmanGateway,
} from "../services/diffieHellmanGateway";
import type { DhTask } from "../types/cipher";
import { createDeferred, createDiffieHellmanGateway } from "./createDiffieHellmanGateway";
import { createDhPresetRequest, createDhPresetResult, createDhRandomValues } from "./fixtures";

const tasks: DhTask[] = ["exchange", "random"];
function invoke(gateway: DiffieHellmanGateway, task: DhTask, signal: AbortSignal) {
  return task === "exchange"
    ? gateway.exchange(createDhPresetRequest(), signal)
    : gateway.generatePrivateValues({ q: "23", alpha: "5" }, signal);
}
const signal = () => new AbortController().signal;

describe("test-only Diffie–Hellman gateway", () => {
  it("returns the preset with all four complete canned traces and records calls", async () => {
    const gateway = createDiffieHellmanGateway();
    const request = createDhPresetRequest();
    const abortSignal = signal();
    const result = await gateway.exchange(request, abortSignal);
    expect(result).toEqual(createDhPresetResult());
    expect(gateway.exchange).toHaveBeenCalledExactlyOnceWith(request, abortSignal);
    expect(gateway.generatePrivateValues).not.toHaveBeenCalled();
    expect(result.traces?.publicA.steps).toHaveLength(3);
    expect(result.traces?.publicB.steps).toHaveLength(4);
    expect(result.traces?.sharedA.steps).toHaveLength(3);
    expect(result.traces?.sharedB.steps).toHaveLength(4);
    expect(result.traces?.publicA.steps.at(-1)).toMatchObject({
      result: "8",
      exponentPrefix: "6",
    });
  });

  it("always returns traces regardless of legacy includeTrace flag", async () => {
    const gateway = createDiffieHellmanGateway();
    const { q, alpha, privateA, privateB } = createDhPresetRequest();
    expect((await gateway.exchange({ q, alpha, privateA, privateB }, signal())).traces).toEqual(
      createDhPresetResult().traces,
    );
    expect((await gateway.exchange(createDhPresetRequest(false), signal())).traces).toEqual(
      createDhPresetResult().traces,
    );
  });

  it("returns deterministic random values and supports their follow-up exchange", async () => {
    const gateway = createDiffieHellmanGateway();
    const values = await gateway.generatePrivateValues({ q: "23", alpha: "5" }, signal());
    expect(values).toEqual(createDhRandomValues());
    expect(await gateway.generatePrivateValues({ q: "23", alpha: "5" }, signal())).toEqual(values);
    const result = await gateway.exchange({ ...values, includeTrace: true }, signal());
    expect(result).toMatchObject({ publicA: "19", publicB: "8", sharedA: "2", sharedB: "2" });
    expect(result.traces?.publicA).toMatchObject({ exponent: "15", result: "19" });
    expect(result.traces?.sharedA).toMatchObject({ base: "8", exponent: "15", result: "2" });
  });

  it("returns fresh objects so mutation cannot contaminate other calls or instances", async () => {
    const gateway = createDiffieHellmanGateway();
    const first = await gateway.exchange(createDhPresetRequest(), signal());
    first.publicA = "bad";
    first.traces!.publicA.steps[0].result = "bad";
    expect(await gateway.exchange(createDhPresetRequest(), signal())).toEqual(
      createDhPresetResult(),
    );
    expect(await createDiffieHellmanGateway().exchange(createDhPresetRequest(), signal())).toEqual(
      createDhPresetResult(),
    );
    const random = await gateway.generatePrivateValues({ q: "23", alpha: "5" }, signal());
    random.privateA = "bad";
    expect(await gateway.generatePrivateValues({ q: "23", alpha: "5" }, signal())).toEqual(
      createDhRandomValues(),
    );
  });

  it("rejects parameters without fixtures instead of calculating a local answer", async () => {
    const gateway = createDiffieHellmanGateway();
    await expect(
      gateway.exchange({ ...createDhPresetRequest(), privateA: "7" }, signal()),
    ).rejects.toThrow("Bộ tham số chưa có fixture DH test.");
    await expect(gateway.generatePrivateValues({ q: "47", alpha: "5" }, signal())).rejects.toThrow(
      "Bộ tham số chưa có fixture DH test.",
    );
  });

  it.each(tasks)("supports a business error then successful retry for %s", async (task) => {
    const gateway = createDiffieHellmanGateway({ [task]: [{ kind: "error" }] });
    await expect(invoke(gateway, task, signal())).rejects.toMatchObject({
      name: "DiffieHellmanGatewayError",
      code: "INVALID_REQUEST",
      field: "alpha",
      message: "Lỗi thử nghiệm <Backend> & yêu cầu thử lại.",
    });
    await expect(invoke(gateway, task, signal())).resolves.toBeDefined();
  });

  it("keeps task queues independent and can inject a network or specific business error", async () => {
    const network = new TypeError("Failed to fetch");
    const business = new DiffieHellmanGatewayError("q không nguyên tố.", "Q_NOT_PRIME", "q");
    const gateway = createDiffieHellmanGateway({
      exchange: [{ kind: "error", error: network }],
      random: [{ kind: "error", error: business }],
    });
    await expect(invoke(gateway, "random", signal())).rejects.toBe(business);
    await expect(invoke(gateway, "exchange", signal())).rejects.toBe(network);
    await expect(invoke(gateway, "exchange", signal())).resolves.toBeDefined();
  });

  it.each(tasks)("lets a controller trigger a timeout for a pending %s", async (task) => {
    vi.useFakeTimers();
    try {
      const gateway = createDiffieHellmanGateway({ [task]: [{ kind: "timeout" }] });
      const controller = new AbortController();
      const promise = invoke(gateway, task, controller.signal);
      const settled = vi.fn();
      void promise.then(settled, settled);
      const reason = new DOMException("Request timed out", "TimeoutError");
      const rejection = expect(promise).rejects.toBe(reason);
      setTimeout(() => controller.abort(reason), 15_000);
      await vi.advanceTimersByTimeAsync(14_999);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await rejection;
      expect(settled).toHaveBeenCalledOnce();
      await expect(invoke(gateway, task, signal())).resolves.toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(tasks)(
    "allows a late %s response after abort and after a newer request",
    async (task) => {
      const deferred = createDeferred<unknown>();
      const gateway = createDiffieHellmanGateway({
        [task]: [{ kind: "late", response: deferred.promise }],
      });
      const controller = new AbortController();
      const old = invoke(gateway, task, controller.signal);
      const settled = vi.fn();
      void old.then(settled);
      controller.abort();
      await expect(invoke(gateway, task, signal())).resolves.toBeDefined();
      expect(settled).not.toHaveBeenCalled();
      const result = task === "exchange" ? createDhPresetResult() : createDhRandomValues();
      deferred.resolve(result);
      await expect(old).resolves.toEqual(result);
    },
  );

  it("can deliver a late rejection to exercise stale error guards", async () => {
    const deferred = createDeferred<unknown>();
    const gateway = createDiffieHellmanGateway({
      exchange: [{ kind: "late", response: deferred.promise }],
    });
    const controller = new AbortController();
    const pending = invoke(gateway, "exchange", controller.signal);
    const reason = new Error("Old request failed");
    const rejection = expect(pending).rejects.toBe(reason);
    controller.abort();
    deferred.reject(reason);
    await rejection;
  });

  it.each(tasks)("rejects a pre-aborted %s without consuming its scenario", async (task) => {
    const gateway = createDiffieHellmanGateway({ [task]: [{ kind: "error" }] });
    const controller = new AbortController();
    controller.abort();
    await expect(invoke(gateway, task, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(invoke(gateway, task, signal())).rejects.toBeInstanceOf(DiffieHellmanGatewayError);
  });

  it("honors manual cancellation of a timeout scenario", async () => {
    const gateway = createDiffieHellmanGateway({ exchange: [{ kind: "timeout" }] });
    const controller = new AbortController();
    const pending = invoke(gateway, "exchange", controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
  });

  it.each(tasks)(
    "injects invalid-schema %s values without pretending to validate them",
    async (task) => {
      const gateway = createDiffieHellmanGateway({
        [task]: [
          { kind: "invalid-schema" },
          { kind: "invalid-schema", value: null },
          { kind: "invalid-schema", value: { sharedA: "2", sharedB: "3", matched: true } },
        ],
      });
      expect(await invoke(gateway, task, signal())).toEqual({ q: 23, matched: "true" });
      expect(await invoke(gateway, task, signal())).toBeNull();
      expect(await invoke(gateway, task, signal())).toEqual({
        sharedA: "2",
        sharedB: "3",
        matched: true,
      });
      await expect(invoke(gateway, task, signal())).resolves.toBeDefined();
    },
  );
});
