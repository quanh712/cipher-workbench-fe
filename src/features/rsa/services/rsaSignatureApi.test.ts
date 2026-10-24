import { describe, expect, it, vi } from "vitest";
import {
  requestStandardSignature,
  standardSignatureErrors,
  SIGNATURE_CONTENT_LIMIT,
} from "./rsaSignatureApi";
import type { StandardSignatureRequest } from "../types/signature";

export function standardResponse(operation = "sign", source = "text", valid = true) {
  return {
    success: true,
    result: {
      mode: "standard",
      source,
      ...(operation === "sign" ? { signature: "c2ln", publicKeyPem: "PUBLIC PEM" } : { valid }),
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
    history: { saved: false, id: null, reason: "disabled" },
  };
}
const input: StandardSignatureRequest = {
  operation: "sign",
  source: "text",
  text: " \r\n",
  privateKeyPem: "PRIVATE PEM",
  passphrase: " secret ",
};
function respond(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

describe("standard RSA signature API", () => {
  it("posts exact text and passphrase without normalizing and includes browser credentials", async () => {
    respond(standardResponse());
    await requestStandardSignature(input, new AbortController().signal);
    expect(fetch).toHaveBeenCalledWith(
      "/api/rsa/sign",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          source: "text",
          text: " \r\n",
          privateKeyPem: "PRIVATE PEM",
          passphrase: " secret ",
        }),
      }),
    );
  });
  it("sends original UTF-8 file bytes and browser-generated multipart boundary", async () => {
    const file = new File([new Uint8Array([239, 187, 191, 65, 13, 10])], "content.TXT");
    respond(standardResponse("sign", "file"));
    await requestStandardSignature(
      { operation: "sign", source: "file", file, privateKeyPem: "PEM" },
      new AbortController().signal,
    );
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    expect(init.headers).toBeUndefined();
    const form = init.body as FormData;
    expect(form.get("file")).toBe(file);
    expect(form.get("privateKeyPem")).toBe("PEM");
    expect(form.has("source")).toBe(false);
  });
  it("treats cryptographic mismatch as a completed verify", async () => {
    respond(standardResponse("verify", "text", false));
    const result = await requestStandardSignature(
      { operation: "verify", source: "text", text: "abc", signature: "c2ln", publicKeyPem: "PEM" },
      new AbortController().signal,
    );
    expect(result.result.valid).toBe(false);
    expect(fetch).toHaveBeenCalledWith("/api/rsa/verify", expect.anything());
  });
  it("bounds exact UTF-8 bytes, accepts whitespace and rejects unpaired surrogates", () => {
    const errors = (text: string) => standardSignatureErrors({ ...input, text });
    expect(errors(" ")).toEqual({});
    expect(errors("a".repeat(SIGNATURE_CONTENT_LIMIT))).toEqual({});
    expect(errors("a".repeat(SIGNATURE_CONTENT_LIMIT) + "é")).toHaveProperty("text");
    expect(errors("\ud800")).toHaveProperty("text");
    expect(errors("😀")).toEqual({});
    expect(
      standardSignatureErrors({
        ...input,
        privateKeyPem: "é".repeat(32769),
        passphrase: "a".repeat(4097),
      }),
    ).toHaveProperty("privateKeyPem");
    expect(standardSignatureErrors({ ...input, passphrase: "a".repeat(4097) })).toHaveProperty(
      "passphrase",
    );
  });
  it("rejects invalid UTF-8, unsupported and empty files before network activity", async () => {
    for (const file of [
      new File([new Uint8Array([255])], "bad.txt"),
      new File(["x"], "bad.pdf"),
      new File([], "empty.txt"),
    ]) {
      await expect(
        requestStandardSignature(
          { operation: "sign", source: "file", file, privateKeyPem: "PEM" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ field: "file" });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("maps the RSA error envelope to its field and code", async () => {
    respond(
      {
        success: false,
        code: "INVALID_PRIVATE_KEY",
        field: "privateKeyPem",
        message: "Khóa không hợp lệ.",
      },
      422,
    );
    await expect(
      requestStandardSignature(input, new AbortController().signal),
    ).rejects.toMatchObject({
      message: "Khóa không hợp lệ.",
      field: "privateKeyPem",
      code: "INVALID_PRIVATE_KEY",
    });
  });
  it("rejects malformed algorithm and history envelopes", async () => {
    const invalid = standardResponse();
    invalid.result.algorithm.saltLength = 20;
    respond(invalid);
    await expect(requestStandardSignature(input, new AbortController().signal)).rejects.toThrow(
      "Phản hồi chữ ký RSA",
    );
    const invalidHistory = standardResponse();
    invalidHistory.history.reason = "saved";
    respond(invalidHistory);
    await expect(requestStandardSignature(input, new AbortController().signal)).rejects.toThrow(
      "Phản hồi chữ ký RSA",
    );
  });
  it("does not issue an already aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(requestStandardSignature(input, controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
