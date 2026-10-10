import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRsaGateway } from "../test/createRsaGateway";
import { useRsaCipher } from "./useRsaCipher";
import { useRsaSignature } from "./useRsaSignature";

function setup() {
  const gateway = createRsaGateway();
  const generateKey = vi.spyOn(gateway, "generateKey");
  const transform = vi.spyOn(gateway, "transform");
  const hook = renderHook(() => {
    const cipher = useRsaCipher(gateway, true);
    const signature = useRsaSignature(cipher);
    return { cipher, signature };
  });
  return { ...hook, generateKey, transform };
}

describe("RSA signature educational fixtures", () => {
  it("requires explicit execution, keeps keys shared and never calls the gateway", () => {
    const hook = setup();
    act(() => hook.result.current.signature.loadScenario("sign-success"));
    expect(hook.result.current.cipher.manualKey).toEqual({ n: "187", e: "7", d: "23" });
    expect(hook.result.current.signature.result).toBeNull();
    expect(hook.result.current.signature.canRunDemo).toBe(true);
    act(() => hook.result.current.signature.runDemo());
    expect(hook.result.current.signature.result).toMatchObject({ kind: "signed", signature: "11" });
    expect(hook.generateKey).not.toHaveBeenCalled();
    expect(hook.transform).not.toHaveBeenCalled();
  });

  it.each([
    ["verify-valid", "valid"],
    ["verify-invalid", "invalid"],
    ["service-error", "error"],
  ] as const)("distinguishes %s from other outcomes", (id, kind) => {
    const hook = setup();
    act(() => hook.result.current.signature.loadScenario(id));
    act(() => hook.result.current.signature.runDemo());
    expect(hook.result.current.signature.result?.kind).toBe(kind);
    expect(hook.result.current.signature.fieldErrors).toEqual({});
    expect(hook.generateKey).not.toHaveBeenCalled();
    expect(hook.transform).not.toHaveBeenCalled();
  });

  it.each(["message", "signature", "key", "draft", "mode", "source"] as const)(
    "permanently invalidates a loaded demo after a %s edit, even when undone",
    (change) => {
      const hook = setup();
      act(() => hook.result.current.signature.loadScenario("verify-valid"));
      act(() => hook.result.current.signature.runDemo());
      act(() => {
        const { cipher, signature } = hook.result.current;
        if (change === "message") signature.setMessage("89");
        if (change === "signature") signature.setSignature("12");
        if (change === "key") cipher.setManualKey("n", "188");
        if (change === "draft") cipher.setParameter("p", "17");
        if (change === "mode") signature.setMode("sign");
        if (change === "source") cipher.setKeySource("generate");
      });
      expect(hook.result.current.signature.result).toBeNull();
      expect(hook.result.current.signature.scenario).toBeNull();
      act(() => {
        const { cipher, signature } = hook.result.current;
        if (change === "message") signature.setMessage("88");
        if (change === "signature") signature.setSignature("11");
        if (change === "key") cipher.setManualKey("n", "187");
        if (change === "draft") cipher.setParameter("p", "");
        if (change === "mode") signature.setMode("verify");
        if (change === "source") cipher.setKeySource("manual");
      });
      act(() => hook.result.current.signature.runDemo());
      expect(hook.result.current.signature.canRunDemo).toBe(false);
      expect(hook.result.current.signature.result).toBeNull();
    },
  );

  it("validates only the key half relevant to the current operation", () => {
    const hook = setup();
    act(() => hook.result.current.signature.loadScenario("sign-success"));
    act(() => hook.result.current.cipher.setManualKey("e", ""));
    expect(hook.result.current.signature.fieldErrors.key).toBeUndefined();
    act(() => hook.result.current.cipher.setManualKey("d", ""));
    expect(hook.result.current.signature.fieldErrors.key).toContain("d ≥ 1");
    act(() => hook.result.current.signature.loadScenario("verify-valid"));
    act(() => hook.result.current.cipher.setManualKey("d", ""));
    expect(hook.result.current.signature.fieldErrors.key).toBeUndefined();
    act(() => hook.result.current.cipher.setManualKey("e", "0"));
    expect(hook.result.current.signature.fieldErrors.key).toContain("e ≥ 1");
  });

  it.each(["-1", "1.5", "187", "9".repeat(129), "", " 88 "])(
    "rejects invalid message and signature inputs: %s",
    (input) => {
      const hook = setup();
      act(() => hook.result.current.signature.loadScenario("verify-valid"));
      act(() => {
        hook.result.current.signature.setMessage(input);
        hook.result.current.signature.setSignature(input);
      });
      expect(hook.result.current.signature.fieldErrors.message).toBeDefined();
      expect(hook.result.current.signature.fieldErrors.signature).toBeDefined();
      expect(hook.result.current.signature.canRunDemo).toBe(false);
    },
  );

  it("accepts zero and large decimals for validation without enabling arbitrary execution", () => {
    const hook = setup();
    act(() => hook.result.current.signature.loadScenario("verify-valid"));
    act(() => {
      hook.result.current.cipher.setManualKey("n", "9007199254740995");
      hook.result.current.signature.setMessage("9007199254740993");
      hook.result.current.signature.setSignature("0");
    });
    expect(hook.result.current.signature.fieldErrors).toEqual({});
    act(() => hook.result.current.signature.runDemo());
    expect(hook.result.current.signature.result).toBeNull();
    expect(hook.result.current.signature.canRunDemo).toBe(false);
  });

  it.each(["1", "-2", "1.5", "9".repeat(129)])("rejects invalid modulo: %s", (n) => {
    const hook = setup();
    act(() => hook.result.current.signature.loadScenario("sign-success"));
    act(() => hook.result.current.cipher.setManualKey("n", n));
    expect(hook.result.current.signature.fieldErrors.key).toBeDefined();
    expect(hook.result.current.signature.canRunDemo).toBe(false);
  });

  it("resets the signature draft without erasing the shared keys", () => {
    const hook = setup();
    act(() => hook.result.current.signature.loadScenario("verify-invalid"));
    act(() => hook.result.current.signature.runDemo());
    act(() => hook.result.current.signature.reset());
    expect(hook.result.current.signature).toMatchObject({
      mode: "sign",
      message: "",
      signature: "",
      scenario: null,
      result: null,
    });
    expect(hook.result.current.cipher.manualKey.n).toBe("187");
  });

  it("clears only the output on clearResult and resets all signature fields with shared reset", () => {
    const hook = setup();
    act(() => hook.result.current.signature.loadScenario("verify-valid"));
    act(() => hook.result.current.signature.runDemo());
    act(() => hook.result.current.signature.clearResult());
    expect(hook.result.current.signature.result).toBeNull();
    expect(hook.result.current.signature.canRunDemo).toBe(true);
    act(() => hook.result.current.cipher.resetAll());
    expect(hook.result.current.signature).toMatchObject({
      mode: "sign",
      message: "",
      signature: "",
      scenario: null,
      result: null,
      canRunDemo: false,
    });
    expect(hook.result.current.cipher.manualKey).toEqual({ n: "", e: "", d: "" });
  });
});
