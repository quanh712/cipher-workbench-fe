import { afterEach, describe, expect, it, vi } from "vitest";
import { dhOperations } from "./dhOperations";
import { createDhPresetWireResult } from "../test/fixtures";
const signal = () => new AbortController().signal;
function mock(body: unknown) {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
    );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => vi.unstubAllGlobals());
const params = {
  success: true,
  q: "23",
  alpha: null,
  factors: ["2", "11"],
  primitiveRootChecks: [],
  suggestedAlpha: "5",
};
describe("DH supplementary operations", () => {
  it("preserves a suggestion without selecting alpha", async () => {
    const fetch = mock(params);
    expect(await dhOperations.params({ q: "23" }, signal())).toEqual(params);
    expect(fetch.mock.calls[0][0]).toBe("/api/dh/params");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ q: "23" });
  });
  it("sends random bits as number and validates returned group", async () => {
    const response = { ...params, p: "11", alpha: "5", suggestedAlpha: null };
    const fetch = mock(response);
    expect(await dhOperations.randomParams({ bits: 16 }, signal())).toEqual(response);
    expect(fetch.mock.calls[0][0]).toBe("/api/dh/params/random");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ bits: 16 });
  });
  it("supports generated keypair and shared-secret with exact fields", async () => {
    const steps = createDhPresetWireResult().steps;
    const fetch = mock({ success: true, privateKey: "6", publicKey: "8", steps: steps.publicKeyA });
    expect(await dhOperations.keypair({ q: "23", alpha: "5" }, signal())).toMatchObject({
      privateKey: "6",
      publicKey: "8",
    });
    expect(fetch.mock.calls[0][0]).toBe("/api/dh/keypair");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ q: "23", alpha: "5" });
    const sharedFetch = mock({ success: true, sharedKey: "2", steps: steps.sharedKeyA });
    expect(
      await dhOperations.sharedSecret({ q: "23", privateKey: "6", otherPublicKey: "19" }, signal()),
    ).toMatchObject({ sharedKey: "2" });
    expect(sharedFetch.mock.calls[0][0]).toBe("/api/dh/shared-secret");
  });
  it("uses JSON data for Caesar and preserves SHIFT_ZERO success warning", async () => {
    const response = {
      success: true,
      sharedKey: "26",
      shift: "0",
      result: "Hello",
      warning: { code: "SHIFT_ZERO", message: "Không đổi văn bản." },
    };
    const fetch = mock(response);
    const input = {
      q: "353",
      privateKey: "97",
      otherPublicKey: "248",
      action: "encrypt" as const,
      data: "Hello",
    };
    expect(await dhOperations.caesar(input, signal())).toEqual(response);
    expect(fetch.mock.calls[0][0]).toBe("/api/dh/caesar");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(input);
  });
  it("sends exactly five multipart parts with browser-owned Content-Type", async () => {
    const fetch = mock({ success: true, sharedKey: "2", shift: "2", result: "Jgnnq" });
    const file = new File(["Hello"], "source.txt", { type: "text/plain" });
    await dhOperations.caesar(
      { q: "23", privateKey: "6", otherPublicKey: "19", action: "encrypt", file },
      signal(),
    );
    const init = fetch.mock.calls[0][1];
    expect(init.body).toBeInstanceOf(FormData);
    expect([...init.body.keys()]).toEqual(["file", "q", "privateKey", "otherPublicKey", "action"]);
    expect(init.headers).toEqual({ Accept: "application/json" });
  });
  it.each([
    { ...params, alpha: undefined },
    { ...params, factors: [2] },
    { ...params, extra: "secret" },
  ])("rejects malformed params %#", async (body) => {
    mock(body);
    await expect(dhOperations.params({ q: "23" }, signal())).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});
