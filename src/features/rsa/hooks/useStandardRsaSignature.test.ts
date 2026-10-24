import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStandardRsaSignature } from "./useStandardRsaSignature";
import type { StandardSignatureResponse } from "../types/signature";
import * as api from "../services/rsaSignatureApi";

const response: StandardSignatureResponse = {
  result: {
    mode: "standard",
    source: "text",
    signature: "c2ln",
    publicKeyPem: "PUBLIC",
    contentBytes: 3,
    sha256: "a".repeat(64),
    algorithm: {
      scheme: "RSASSA-PSS",
      hash: "SHA-256",
      mgf: "MGF1-SHA-256",
      saltLength: 32,
      signatureEncoding: "base64",
    },
  },
  history: { saved: true, id: 1, reason: "saved" },
};
function setup() {
  const call = vi.spyOn(api, "requestStandardSignature");
  const hook = renderHook(({ active }) => useStandardRsaSignature(active), {
    initialProps: { active: true },
  });
  act(() => {
    hook.result.current.update("text", "abc");
    hook.result.current.update("privateKeyPem", "PRIVATE");
    hook.result.current.update("passphrase", "secret");
  });
  return { ...hook, call };
}

describe("standard RSA signature controller", () => {
  it("clears prior file selection when switching content sources", () => {
    const hook = setup();
    act(() => hook.result.current.update("source", "file"));
    act(() => hook.result.current.update("file", new File(["abc"], "original.txt")));
    expect(hook.result.current.canRun).toBe(true);
    act(() => hook.result.current.update("source", "text"));
    expect(hook.result.current.draft.file).toBeNull();
    act(() => hook.result.current.update("source", "file"));
    expect(hook.result.current.draft.file).toBeNull();
    expect(hook.result.current.canRun).toBe(false);
  });
  it("reuses the exact selected file when transferring a signed result to verification", async () => {
    const hook = setup();
    const file = new File(["\uFEFFabc\r\n"], "original.txt");
    act(() => hook.result.current.update("source", "file"));
    act(() => hook.result.current.update("file", file));
    hook.call.mockResolvedValueOnce({
      ...response,
      result: { ...response.result, source: "file" },
    });
    await act(() => hook.result.current.run());
    act(() => hook.result.current.useForVerification());
    expect(hook.result.current.draft.source).toBe("file");
    expect(hook.result.current.draft.file).toBe(file);
    expect(hook.result.current.canRun).toBe(true);
  });
  it("clears private material after signing and transfers public fields for verification", async () => {
    const hook = setup();
    hook.call.mockResolvedValueOnce(response);
    await act(() => hook.result.current.run());
    expect(hook.result.current.draft.privateKeyPem).toBe("");
    expect(hook.result.current.draft.passphrase).toBe("");
    expect(hook.result.current.result).toEqual(response);
    act(() => hook.result.current.useForVerification());
    expect(hook.result.current.draft).toMatchObject({
      mode: "verify",
      text: "abc",
      signature: "c2ln",
      publicKeyPem: "PUBLIC",
    });
    expect(hook.result.current.canRun).toBe(true);
  });
  it.each([
    "text",
    "privateKeyPem",
    "passphrase",
    "signature",
    "publicKeyPem",
    "source",
    "mode",
    "clear",
    "inactive",
    "unmount",
  ] as const)("aborts and drops stale results after %s", async (change) => {
    const hook = setup();
    let resolve!: (value: StandardSignatureResponse) => void;
    hook.call.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => {
      void hook.result.current.run();
    });
    const signal = hook.call.mock.calls[0][1];
    act(() => {
      if (change === "clear") hook.result.current.clear();
      else if (change === "source") hook.result.current.update("source", "file");
      else if (change === "mode") hook.result.current.update("mode", "verify");
      else if (change !== "inactive" && change !== "unmount")
        hook.result.current.update(change, "changed");
    });
    if (change === "inactive") hook.rerender({ active: false });
    if (change === "unmount") hook.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(response));
    expect(hook.result.current.result).toBeNull();
    if (change !== "unmount") expect(hook.result.current.loading).toBe(false);
    if (change === "inactive") {
      expect(hook.result.current.draft.privateKeyPem).toBe("");
      hook.rerender({ active: true });
      act(() => {
        hook.result.current.update("text", "abc");
        hook.result.current.update("privateKeyPem", "NEW");
      });
      hook.call.mockResolvedValueOnce(response);
      await act(() => hook.result.current.run());
      expect(hook.call).toHaveBeenCalledTimes(2);
    }
  });
  it("blocks duplicate submissions and shows typed errors for retry", async () => {
    const hook = setup();
    hook.call.mockRejectedValueOnce(new api.RsaSignatureApiError("Bad PEM", "privateKeyPem"));
    await act(async () => {
      await Promise.all([hook.result.current.run(), hook.result.current.run()]);
    });
    expect(hook.call).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toMatchObject({ field: "privateKeyPem" });
    expect(hook.result.current.canRun).toBe(true);
  });
});
