import { describe, expect, it, vi } from "vitest";
import { exampleKey, exampleKey3 } from "../test/createHillGateway";
import { hillApi } from "./hillApi";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Hill API adapter", () => {
  it("uses exact Hill endpoint and payload and keeps blocks from Backend", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({
        success: true,
        result: "DPLE",
        key: exampleKey,
        blocks: [
          { input: [7, 4], output: [3, 15] },
          { input: [11, 15], output: [11, 4] },
        ],
        warnings: [],
      }),
    );
    const response = await hillApi.process("encrypt", {
      text: "HELP",
      key: [
        [-23, 29],
        [2, 5],
      ],
      options: { stripDiacritics: false, padChar: "X" },
    });
    expect(response.result).toBe("DPLE");
    expect(response.blocks[0].output).toEqual([3, 15]);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/hill/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "HELP",
        key: [
          [-23, 29],
          [2, 5],
        ],
        options: { stripDiacritics: false, padChar: "X" },
      }),
      signal: undefined,
    });
  });

  it("sends keyword and m to analyze and preserves structured E04", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ success: false, code: "E04", message: "invalid", details: { det: 2, gcd: 2 } }, 422),
    );
    await expect(hillApi.analyze({ keyword: "HILL", m: 2 })).rejects.toMatchObject({
      status: 422,
      detail: { code: "E04", details: { det: 2, gcd: 2 } },
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/hill/key/analyze");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({
      keyword: "HILL",
      m: 2,
    });
  });

  it("rejects a malformed result instead of displaying invented blocks", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ success: true, result: "DPLE", key: exampleKey, blocks: [], warnings: [] }),
    );
    await expect(
      hillApi.process("encrypt", {
        text: "HELP",
        key: [
          [3, 3],
          [2, 5],
        ],
        options: { stripDiacritics: false, padChar: "X" },
      }),
    ).rejects.toMatchObject({ detail: { code: "NETWORK" } });
  });

  it("rejects a successful analysis for the wrong matrix size", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ success: true, result: exampleKey, warnings: [] }),
    );
    await expect(
      hillApi.analyze({
        key: [
          [3, 3, 2],
          [2, 5, 1],
          [4, 1, 1],
        ],
      }),
    ).rejects.toMatchObject({
      detail: { code: "NETWORK" },
    });
  });

  it("rejects an analysis with no warnings field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ success: true, result: exampleKey }));
    await expect(
      hillApi.analyze({
        key: [
          [3, 3],
          [2, 5],
        ],
      }),
    ).rejects.toMatchObject({ detail: { code: "NETWORK" } });
  });
  it("reads the complete random-key analysis and W03 details", async () => {
    const body = {
      success: true,
      result: exampleKey3,
      warnings: [{ code: "W03", message: "Server warning", details: { reason: "self_inverse" } }],
    };
    vi.mocked(fetch).mockResolvedValueOnce(json(body));
    await expect(hillApi.random(3)).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith("/api/hill/key/random?m=3", { signal: undefined });
  });

  it("does not count an ASCII base inside a retained NFD Vietnamese cluster", async () => {
    const body = {
      success: true,
      result: "DPLE A\u0301!",
      key: exampleKey,
      blocks: [
        { input: [7, 4], output: [3, 15] },
        { input: [11, 15], output: [11, 4] },
      ],
      warnings: [{ code: "W02", message: "Server W02", details: { count: 1 } }],
    };
    vi.mocked(fetch).mockResolvedValueOnce(json(body));
    await expect(
      hillApi.process("encrypt", {
        text: "HELP A\u0301!",
        key: exampleKey.matrix,
        options: { stripDiacritics: false, padChar: "X" },
      }),
    ).resolves.toEqual(body);
  });

  it.each([
    {
      status: 413,
      body: {
        success: false,
        code: "E06",
        message: "Server size message",
        details: { actualBytes: 5242881, maxBytes: 5242880 },
      },
      code: "E06",
    },
    { status: 500, body: { success: false, message: "Server system message" }, code: "SYSTEM" },
  ])(
    "preserves flat errors and server messages at HTTP $status",
    async ({ status, body, code }) => {
      vi.mocked(fetch).mockResolvedValueOnce(json(body, status));
      await expect(hillApi.analyze({ key: exampleKey.matrix })).rejects.toMatchObject({
        status,
        detail: { code, message: body.message },
      });
    },
  );

  it.each([
    { success: false, result: exampleKey, warnings: [] },
    { success: true, result: { ...exampleKey, matrix: undefined }, warnings: [] },
    { success: true, result: { ...exampleKey, inverse: null }, warnings: [] },
    { success: true, result: exampleKey, warnings: [{ code: "W03", message: "Missing details" }] },
  ])("rejects incomplete or unsuccessful analysis envelopes", async (body) => {
    vi.mocked(fetch).mockResolvedValueOnce(json(body));
    await expect(hillApi.analyze({ key: exampleKey.matrix })).rejects.toMatchObject({
      detail: { code: "NETWORK" },
    });
  });
});
