import { afterEach, expect, it, vi } from "vitest";
import { deleteSignature, getSignatureDetail, getSignatureHistory } from "./signatureHistoryApi";

const item = {
  id: 8,
  createdAt: "2026-10-24T00:00:00Z",
  cipher: "rsa",
  operation: "sign",
  source: "text",
  succeeded: true,
  httpStatus: 200,
  durationMs: 1,
  valid: null,
  processingState: "completed",
};
afterEach(() => vi.restoreAllMocks());
function json(result: unknown) {
  return new Response(JSON.stringify({ success: true, result }));
}
it("uses canonical RSA filters and keeps an opaque cursor", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(json({ items: [item], nextCursor: null }));
  await expect(getSignatureHistory("sign", "a+/=")).resolves.toEqual({
    items: [item],
    nextCursor: null,
  });
  const url = new URL(String(fetch.mock.calls[0][0]), "http://localhost");
  expect(url.pathname).toBe("/api/history");
  expect(url.searchParams.get("cipher")).toBe("rsa");
  expect(url.searchParams.get("operation")).toBe("sign");
  expect(url.searchParams.get("cursor")).toBe("a+/=");
});
it("retains signature detail payload and deletes through canonical routes", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(json({ ...item, payload: {} }))
    .mockResolvedValueOnce(json({ deleted: true }));
  await expect(getSignatureDetail(8)).resolves.toEqual({ ...item, payload: {} });
  await deleteSignature(8);
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    "/api/history/8",
    expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }),
  );
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    "/api/history/8",
    expect.objectContaining({ method: "DELETE", credentials: "same-origin", cache: "no-store" }),
  );
});
