import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesRequest } from "../types/cipher";
import { desApi } from "./desApi";

afterEach(() => vi.restoreAllMocks());
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const success = { success: true, result: " \nresult\n ", warnings: [] };
const signal = new AbortController().signal;
const request: DesRequest = {
  inputMode: "text",
  operation: "encrypt",
  text: " raw text ",
  key: " 13345779 9bbcdff1 ",
  cipherMode: "ECB",
  format: "text",
  iv: "discarded",
};

describe("DES API contract", () => {
  it("sends strict encrypt fields and raw text/key; omits ECB IV", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(success));
    const result = await desApi.process(request, signal);
    expect(fetch).toHaveBeenCalledWith(
      "/api/des/encrypt",
      expect.objectContaining({
        signal,
        body: JSON.stringify({
          text: request.text,
          key: request.key,
          mode: "ECB",
          inputFormat: "text",
        }),
      }),
    );
    expect(result.text).toBe(success.result);
  });

  it("maps decrypt format and CBC IV without extra operation/source fields", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(success));
    await desApi.process(
      {
        ...request,
        operation: "decrypt",
        format: "hex",
        cipherMode: "CBC",
        iv: " 00000000 00000000 ",
      },
      signal,
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/des/decrypt",
      expect.objectContaining({
        body: JSON.stringify({
          text: request.text,
          key: request.key,
          mode: "CBC",
          iv: " 00000000 00000000 ",
          outputFormat: "hex",
        }),
      }),
    );
  });

  it("previews and downloads the original file with distinct response_mode and server bytes/name", async () => {
    const file = new File(["\ufeffHello"], "input.TXT");
    const fileRequest: DesRequest = {
      inputMode: "file",
      operation: "encrypt",
      key: request.key,
      file,
      cipherMode: "CBC",
      iv: "0000000000000000",
      format: "hex",
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(success))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0xef, 0xbb, 0xbf, 65]), {
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
            "Content-Disposition": "attachment; filename*=UTF-8''b%C3%A0i.encrypted.txt",
          },
        }),
      );
    await desApi.process(fileRequest, signal);
    const download = await desApi.download!(fileRequest, signal);
    for (const [index, mode] of ["content", "file"].entries()) {
      const init = fetch.mock.calls[index][1];
      expect(init?.headers).toBeUndefined();
      expect(init?.signal).toBe(signal);
      const form = init?.body;
      expect(form).toBeInstanceOf(FormData);
      if (!(form instanceof FormData)) throw new Error("Expected FormData");
      expect([...form.keys()]).toEqual(["file", "key", "action", "mode", "iv", "response_mode"]);
      expect(form.get("file")).toBe(file);
      expect(form.get("action")).toBe("encrypt");
      expect(form.get("response_mode")).toBe(mode);
    }
    expect(download.filename).toBe("bài.encrypted.txt");
    expect(new Uint8Array(await download.blob.arrayBuffer())).toEqual(
      new Uint8Array([0xef, 0xbb, 0xbf, 65]),
    );
  });

  it("preserves trusted error messages for text and attachment failures", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        json(
          { success: false, message: "Padding không hợp lệ: sai khóa hoặc bản mã bị hỏng." },
          422,
        ),
      )
      .mockResolvedValueOnce(json({ success: false, message: "File phải sử dụng UTF-8." }, 415));
    await expect(desApi.process(request, signal)).rejects.toThrow(
      "Padding không hợp lệ: sai khóa hoặc bản mã bị hỏng.",
    );
    await expect(
      desApi.download!(
        { inputMode: "file", operation: "decrypt", key: "k", file: new File(["x"], "x.txt") },
        signal,
      ),
    ).rejects.toThrow("File phải sử dụng UTF-8.");
  });

  it.each([
    { success: true, result: "x" },
    { success: true, result: 3, warnings: [] },
    { success: true, result: "x", warnings: [{ code: "W04", message: "x", details: {} }] },
    {
      success: true,
      result: "x",
      warnings: [{ code: "W03", message: "x", details: { repeatedBlocks: 0 } }],
    },
  ])("rejects malformed success responses", async (body) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(body));
    await expect(desApi.process(request, signal)).rejects.toThrow("Đã xảy ra lỗi hệ thống.");
  });

  it("preserves valid warnings in server order", async () => {
    const warnings = [
      { code: "W01", message: "weak", details: {} },
      { code: "W03", message: "repeat", details: { repeatedBlocks: 1 } },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ ...success, warnings }));
    expect((await desApi.process(request, signal)).warnings).toEqual(warnings);
  });
});
