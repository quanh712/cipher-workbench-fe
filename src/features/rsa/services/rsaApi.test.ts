import { afterEach, describe, expect, it, vi } from "vitest";
import { rsaApi } from "./rsaApi";

const signal = () => new AbortController().signal;
const parameters = { p: "17", q: "11", e: "7" };
const key = {
  success: true,
  n: "187",
  phi: "160",
  e: "7",
  d: "23",
  publicKey: { e: "7", n: "187" },
  privateKey: { d: "23", n: "187" },
  egcdSteps: [
    { index: 0, q: null, r: "160", t: "0" },
    { index: 1, q: "22", r: "6", t: "-22" },
  ],
};
const trace = (operation: "encrypt" | "decrypt") => ({
  operation,
  blockIndex: 0,
  input: "88",
  exponent: "7",
  modulus: "187",
  result: "11",
  steps: [{ i: 0, bit: 1, base: "88", before: "1", result: "88" }],
});
function response(body: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
function payload(fetch: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetch.mock.calls[0][1].body);
}
afterEach(() => vi.unstubAllGlobals());

describe("RSA Backend adapter", () => {
  it("maps generated keys and signed coefficients", async () => {
    const fetch = response(key);
    expect(await rsaApi.generateKey(parameters, signal())).toMatchObject({
      p: "17",
      n: "187",
      d: "23",
      euclidRows: [
        { quotient: null, remainder: "160", coefficient: "0" },
        { quotient: "22", remainder: "6", coefficient: "-22" },
      ],
    });
    expect(payload(fetch)).toEqual(parameters);
  });
  it.each(["encrypt", "decrypt"] as const)(
    "sends only one number %s request with the required half-key",
    async (operation) => {
      const fetch = response({
        success: true,
        inputType: "number",
        blocks: ["88"],
        ...(operation === "encrypt" ? { cipher: ["11"] } : { plaintext: "88" }),
        blockSize: null,
        trace: trace(operation),
      });
      const request =
        operation === "encrypt"
          ? { operation, inputType: "number" as const, e: "7", n: "187", data: "88" }
          : { operation, inputType: "number" as const, d: "23", n: "187", cipher: ["11"] };
      const result = await rsaApi.transform(request, signal());
      expect(result.output).toBe(operation === "encrypt" ? '["11"]' : "88");
      expect(fetch).toHaveBeenCalledTimes(1);
      const { operation: ignored, ...expected } = request;
      void ignored;
      expect(fetch.mock.calls[0][0]).toBe(`/api/rsa/${operation}`);
      expect(payload(fetch)).toEqual({ ...expected, traceBlockIndex: 0 });
    },
  );
  it.each(["encrypt", "decrypt"] as const)(
    "preserves Unicode and big decimal strings in text %s",
    async (operation) => {
      const cipher = ["9007199254740993", "9", "10"];
      const fetch = response({
        success: true,
        inputType: "text",
        mode: "char",
        blocks: ["128512", "224", "10"],
        ...(operation === "encrypt" ? { cipher } : { plaintext: "😀à\n" }),
        blockSize: 1,
        originalUtf8ByteLength: 7,
        trace: trace(operation),
      });
      const request =
        operation === "encrypt"
          ? { operation, inputType: "text" as const, e: "7", n: "187", data: "😀à\n" }
          : { operation, inputType: "text" as const, d: "23", n: "187", cipher };
      const result = await rsaApi.transform(request, signal());
      expect(result.output).toBe(operation === "encrypt" ? JSON.stringify(cipher) : "😀à\n");
      expect(payload(fetch).mode).toBe("char");
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("preserves Backend business errors", async () => {
    response({ success: false, message: "P = 187 ≥ n = 187." }, 422);
    await expect(
      rsaApi.transform(
        { operation: "encrypt", inputType: "number", e: "7", n: "187", data: "187" },
        signal(),
      ),
    ).rejects.toThrow("P = 187 ≥ n = 187.");
  });
  it.each([
    "html",
    { ...key, n: 187 },
    { ...key, egcdSteps: [{ index: 0, q: null, r: "160", t: 0 }] },
  ])("rejects malformed keys", async (body) => {
    response(body);
    await expect(rsaApi.generateKey(parameters, signal())).rejects.toThrow(
      "Phản hồi RSA từ máy chủ không hợp lệ.",
    );
  });
  it("rejects inconsistent text arrays", async () => {
    response({
      success: true,
      inputType: "text",
      mode: "char",
      blocks: ["65"],
      cipher: ["1", "2"],
      blockSize: 1,
      originalUtf8ByteLength: 1,
      trace: trace("encrypt"),
    });
    await expect(
      rsaApi.transform(
        { operation: "encrypt", inputType: "text", e: "7", n: "187", data: "A" },
        signal(),
      ),
    ).rejects.toThrow("không hợp lệ");
  });
  it("respects abort even if fetch resolves", async () => {
    const controller = new AbortController();
    response(key).mockImplementation(async () => {
      controller.abort();
      return new Response(JSON.stringify(key));
    });
    await expect(rsaApi.generateKey(parameters, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

const rawRequest = { operation: "sign" as const, m: "65", d: "2753", e: "17", n: "3233" };
function signatureResponse(verify = false, valid = true) {
  return {
    success: true,
    result: {
      mode: "raw-integer",
      warning: "Educational only",
      m: "65",
      signature: "588",
      publicKey: { e: "17", n: "3233" },
      ...(verify ? { valid, recoveredMessage: "65" } : {}),
      trace: {
        operation: verify ? "verify" : "sign",
        input: verify ? "588" : "65",
        exponent: verify ? "17" : "2753",
        modulus: "3233",
        result: verify ? "65" : "588",
        steps: [{ i: 0, bit: 1, base: "65", before: "1", result: "65" }],
      },
    },
    history: { saved: false, id: null, reason: "disabled" },
  };
}
describe("RSA raw signature adapter", () => {
  it("posts exact decimals and credentials, maps backend trace and history", async () => {
    const fetch = response(signatureResponse());
    expect(await rsaApi.signature(rawRequest, signal())).toMatchObject({
      kind: "signed",
      signature: "588",
      rows: [{ index: 0, after: "65" }],
      history: { saved: false },
    });
    expect(fetch.mock.calls[0][0]).toBe("/api/rsa/sign/raw");
    expect(fetch.mock.calls[0][1].credentials).toBe("include");
    expect(payload(fetch)).toEqual({ m: "65", d: "2753", e: "17", n: "3233" });
  });
  it.each([true, false])("maps valid=%s as a verification outcome", async (valid) => {
    const fetch = response(signatureResponse(true, valid));
    const result = await rsaApi.signature(
      { operation: "verify", m: "65", signature: "588", e: "17", n: "3233" },
      signal(),
    );
    expect(result.kind).toBe(valid ? "valid" : "invalid");
    expect(result.recoveredMessage).toBe("65");
    expect(fetch.mock.calls[0][0]).toBe("/api/rsa/verify/raw");
    expect(payload(fetch)).not.toHaveProperty("d");
  });
  it.each(["mode", "m", "signature", "publicKey", "trace", "history", "valid"])(
    "rejects malformed %s",
    async (field) => {
      const body = signatureResponse(true);
      const malformed =
        field === "history"
          ? { ...body, history: null }
          : { ...body, result: { ...body.result, [field]: null } };
      response(malformed);
      await expect(
        rsaApi.signature(
          { operation: "verify", m: "65", signature: "588", e: "17", n: "3233" },
          signal(),
        ),
      ).rejects.toThrow("Phản hồi RSA");
    },
  );
  it("preserves backend errors and never supplies local results", async () => {
    response({ success: false, message: "Sai khóa <Backend>" }, 422);
    await expect(rsaApi.signature(rawRequest, signal())).rejects.toThrow("Sai khóa <Backend>");
  });
});
