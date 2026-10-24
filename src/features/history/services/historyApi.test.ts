import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canShowServerHistory,
  getHealthStatus,
  getHistory,
  getDhHistory,
  getHistoryDetail,
  getHistoryContent,
  deleteHistoryItem,
  deleteAllHistory,
  HistoryApiError,
} from "./historyApi";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("history API", () => {
  it("accepts the database status and history gate even when health returns 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(
        { success: true, result: { app: "ok", database: "unavailable", history: "enabled" } },
        503,
      ),
    );
    await expect(getHealthStatus()).resolves.toEqual({
      database: "unavailable",
      history: "enabled",
    });
  });

  it("requires both a healthy database and enabled history to read server history", () => {
    expect(canShowServerHistory({ database: "ok", history: "enabled" })).toBe(true);
    expect(canShowServerHistory({ database: "ok", history: "disabled" })).toBe(false);
    expect(canShowServerHistory({ database: "disabled", history: "enabled" })).toBe(false);
    expect(canShowServerHistory({ database: "unavailable", history: "enabled" })).toBe(false);
  });

  it("does not treat an older health response without the history gate as enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ success: true, result: { app: "ok", database: "ok" } }),
    );
    await expect(getHealthStatus()).rejects.toEqual(
      new HistoryApiError("Không thể tải lịch sử. Vui lòng thử lại.", 200),
    );
  });

  it("passes the server cursor unchanged with filters", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ success: true, result: { items: [], nextCursor: null } }));
    await getHistory({ cipher: "playfair", operation: "decrypt", cursor: "a+/=" });
    const url = new URL(String(fetch.mock.calls[0][0]), "http://localhost");
    expect(url.pathname).toBe("/api/history");
    expect(url.searchParams.get("cursor")).toBe("a+/=");
    expect(url.searchParams.get("cipher")).toBe("playfair");
    expect(url.searchParams.get("operation")).toBe("decrypt");
  });

  it("keeps the backend error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ success: false, message: "Lịch sử tạm thời không khả dụng." }, 503),
    );
    await expect(getHistory({})).rejects.toEqual(
      new HistoryApiError("Lịch sử tạm thời không khả dụng.", 503),
    );
  });

  it.each([
    "validate_params",
    "generate_params",
    "generate_keypair",
    "derive_shared_secret",
    "exchange",
    "encrypt",
    "decrypt",
  ] as const)("maps DH filters and rows for %s without changing metadata", async (operation) => {
    const row = {
      id: 7,
      cipher: "dh",
      operation,
      createdAt: "2026-10-13T00:00:00Z",
      source: "text",
      responseMode: null,
      inputLength: null,
      outputLength: null,
      succeeded: false,
      httpStatus: 422,
      durationMs: 3,
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ success: true, result: { items: [row], nextCursor: "next+/=" } }));
    const controller = new AbortController();
    await expect(
      getHistory({ cipher: "diffie-hellman", operation, cursor: "old+/=" }, controller.signal),
    ).resolves.toEqual({ items: [{ ...row, cipher: "diffie-hellman" }], nextCursor: "next+/=" });
    const [path, options] = fetch.mock.calls[0];
    const url = new URL(String(path), "http://localhost");
    expect(url.searchParams.get("cipher")).toBe("dh");
    expect(url.searchParams.get("operation")).toBe(operation);
    expect(url.searchParams.get("cursor")).toBe("old+/=");
    expect(options).toMatchObject({
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  });
});

it("reads DH metadata from the canonical endpoint", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(json({ success: true, result: { items: [], nextCursor: null } }));
  await getDhHistory({ operation: "exchange" });
  const url = new URL(String(fetch.mock.calls[0][0]), "http://localhost");
  expect(url.pathname).toBe("/api/history");
  expect(url.searchParams.get("cipher")).toBe("dh");
  expect(url.searchParams.get("operation")).toBe("exchange");
});

it("reads detail from the canonical owner-scoped endpoint and maps DH", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(json({ success: true, result: { id: 7, cipher: "dh", payload: {} } }));
  const controller = new AbortController();
  await expect(getHistoryDetail(7, controller.signal)).resolves.toEqual({
    id: 7,
    cipher: "diffie-hellman",
    payload: {},
  });
  expect(fetch).toHaveBeenCalledWith(
    "/api/history/7",
    expect.objectContaining({
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    }),
  );
});

it.each([null, { id: 7, payload: [] }, { id: 8, payload: {} }])(
  "rejects malformed or mismatched detail %s",
  async (result) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ success: true, result }));
    await expect(getHistoryDetail(7)).rejects.toBeInstanceOf(HistoryApiError);
  },
);

it("deletes one or all records through the canonical endpoint with browser credentials", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => json({ success: true, result: { deleted: true } }));
  await deleteHistoryItem(7);
  await deleteAllHistory();
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    "/api/history/7",
    expect.objectContaining({ method: "DELETE", credentials: "same-origin", cache: "no-store" }),
  );
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    "/api/history",
    expect.objectContaining({ method: "DELETE", credentials: "same-origin", cache: "no-store" }),
  );
});

it("downloads the original content bytes from the canonical endpoint", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("hello\r\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="rsa-history-7.txt"',
      },
    }),
  );
  const controller = new AbortController();
  const file = await getHistoryContent(7, controller.signal);
  expect(await file.blob.text()).toBe("hello\r\n");
  expect(file.filename).toBe("rsa-history-7.txt");
  expect(fetch).toHaveBeenCalledWith(
    "/api/history/7/content",
    expect.objectContaining({
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    }),
  );
});

it.each([getHistoryDetail, getHistoryContent, deleteHistoryItem])(
  "keeps missing/expired record errors for %s",
  async (request) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ success: false, message: "Không tìm thấy bản ghi lịch sử." }, 404),
    );
    await expect(request(7)).rejects.toEqual(
      new HistoryApiError("Không tìm thấy bản ghi lịch sử.", 404),
    );
  },
);

it("rejects a JSON response instead of saving it as content", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    json({ success: false, message: "Nội dung không khả dụng." }),
  );
  await expect(getHistoryContent(7)).rejects.toThrow("Nội dung không khả dụng.");
});
