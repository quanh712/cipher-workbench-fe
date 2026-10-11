import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRsaGateway } from "../test/createRsaGateway";
import { RsaGatewayError } from "../services/rsaGateway";
import type { RsaSignatureResult } from "../types/signature";
import { useRsaCipher } from "./useRsaCipher";
import { useRsaSignature } from "./useRsaSignature";

function setup() {
  const gateway = createRsaGateway();
  const call = vi.spyOn(gateway, "signature");
  const hook = renderHook(
    ({ active }) => {
      const cipher = useRsaCipher(gateway, active);
      return { cipher, signature: useRsaSignature(cipher) };
    },
    { initialProps: { active: true } },
  );
  act(() => hook.result.current.signature.loadScenario("sign-success"));
  return { ...hook, call };
}

describe("RSA backend signatures", () => {
  it("fills examples without requests and signs arbitrary valid input explicitly", async () => {
    const hook = setup();
    expect(hook.call).not.toHaveBeenCalled();
    act(() => hook.result.current.signature.setMessage("42"));
    await act(() => hook.result.current.signature.run());
    expect(hook.call).toHaveBeenCalledWith(
      { operation: "sign", m: "42", n: "187", e: "7", d: "23" },
      expect.any(AbortSignal),
    );
    expect(hook.result.current.signature.result).toMatchObject({ kind: "signed", signature: "11" });
  });

  it("requires e for signing but allows verification without d", () => {
    const hook = setup();
    act(() => hook.result.current.cipher.setManualKey("e", ""));
    expect(hook.result.current.signature.canRun).toBe(false);
    act(() => hook.result.current.signature.loadScenario("verify-valid"));
    act(() => hook.result.current.cipher.setManualKey("d", ""));
    expect(hook.result.current.signature.canRun).toBe(true);
  });

  it.each(["verify-valid", "verify-invalid"] as const)(
    "uses backend outcome for %s",
    async (id) => {
      const hook = setup();
      act(() => hook.result.current.signature.loadScenario(id));
      await act(() => hook.result.current.signature.run());
      expect(hook.result.current.signature.result?.kind).toBe(
        id === "verify-valid" ? "valid" : "invalid",
      );
      expect(hook.call.mock.calls[0][0]).not.toHaveProperty("d");
    },
  );

  it("shows service errors independently and allows retry", async () => {
    const hook = setup();
    hook.call.mockRejectedValueOnce(new RsaGatewayError("Backend <error>"));
    await act(() => hook.result.current.signature.run());
    expect(hook.result.current.signature.result).toMatchObject({
      kind: "error",
      message: "Backend <error>",
    });
    expect(hook.result.current.signature.canRun).toBe(true);
    await act(() => hook.result.current.signature.run());
    expect(hook.result.current.signature.result?.kind).toBe("signed");
  });

  it.each([
    "message",
    "signature",
    "key",
    "draft",
    "mode",
    "source",
    "reset",
    "inactive",
    "clear",
  ] as const)("aborts and discards delayed response after %s", async (change) => {
    const hook = setup();
    let resolve!: (result: RsaSignatureResult) => void;
    hook.call.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => {
      void hook.result.current.signature.run();
    });
    const signal = hook.call.mock.calls[0][1];
    expect(hook.result.current.signature.loading).toBe(true);
    act(() => {
      const { cipher, signature } = hook.result.current;
      if (change === "message") signature.setMessage("89");
      if (change === "signature") signature.setSignature("12");
      if (change === "key") cipher.setManualKey("n", "188");
      if (change === "draft") cipher.setParameter("p", "17");
      if (change === "mode") signature.setMode("verify");
      if (change === "source") cipher.setKeySource("generate");
      if (change === "reset") cipher.resetAll();
      if (change === "clear") signature.clearResult();
    });
    if (change === "inactive") hook.rerender({ active: false });
    expect(signal.aborted).toBe(true);
    await act(async () => {
      resolve({ kind: "signed", signature: "11", message: "old", steps: [] });
    });
    expect(hook.result.current.signature.result).toBeNull();
    expect(hook.result.current.signature.loading).toBe(false);
  });

  it("blocks duplicate submissions and aborts on unmount", () => {
    const hook = setup();
    hook.call.mockImplementation(() => new Promise(() => {}));
    act(() => {
      void hook.result.current.signature.run();
      void hook.result.current.signature.run();
    });
    expect(hook.call).toHaveBeenCalledTimes(1);
    hook.unmount();
    expect(hook.call.mock.calls[0][1].aborted).toBe(true);
  });

  it.each(["-1", "1.5", "187", "9".repeat(129), "", " 88 "])(
    "rejects %s without a request",
    async (input) => {
      const hook = setup();
      act(() => hook.result.current.signature.setMessage(input));
      await act(() => hook.result.current.signature.run());
      expect(hook.result.current.signature.fieldErrors.message).toBeDefined();
      expect(hook.call).not.toHaveBeenCalled();
    },
  );
});
