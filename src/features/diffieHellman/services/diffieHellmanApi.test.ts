import { afterEach, describe, expect, it, vi } from "vitest";
import { diffieHellmanApi } from "./diffieHellmanApi";
import {
  createDhPresetRequest,
  createDhPresetResult,
  createDhPresetWireResult,
} from "../test/fixtures";

const signal = () => new AbortController().signal;
const invalid = {
  code: "INVALID_RESPONSE",
  message: "Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.",
};
const exchange = createDhPresetWireResult;
const random = createDhPresetWireResult;
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
  });
}
function mock(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const run = () => diffieHellmanApi.exchange(createDhPresetRequest(), signal());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Diffie–Hellman target HTTP adapter", () => {
  it("posts canonical strings, maps all four traces, and disables caching", async () => {
    const fetch = mock(json(exchange()));
    expect(
      await diffieHellmanApi.exchange(
        { ...createDhPresetRequest(), q: " \t00023\n", privateA: "0006" },
        signal(),
      ),
    ).toEqual(createDhPresetResult());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/dh/exchange");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });
    expect(JSON.parse(init.body)).toEqual({
      q: "23",
      alpha: "5",
      privateKeyA: "6",
      privateKeyB: "15",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it("accepts 128-bit decimal values and complete 128-row traces without Number conversion", async () => {
    const q = (2n ** 128n - 1n).toString();
    const key = (2n ** 127n).toString();
    const rows = Array.from({ length: 128 }, (_, index) => ({
      index,
      bit: index === 0 ? 1 : 0,
      exponentPrefix: (2n ** BigInt(index)).toString(),
      squared: "2",
      multiplied: index === 0 ? "2" : null,
      result: "2",
    }));
    mock(
      json({
        ...exchange(),
        privateKeyA: key,
        privateKeyB: key,
        publicKeyA: "2",
        publicKeyB: "2",
        sharedKeyA: "2",
        sharedKeyB: "2",
        steps: { publicKeyA: rows, publicKeyB: rows, sharedKeyA: rows, sharedKeyB: rows },
      }),
    );
    const result = await diffieHellmanApi.exchange(
      { q, alpha: "5", privateA: key, privateB: key },
      signal(),
    );
    expect(result.q).toBe(q);
    expect(result.privateA).toBe(key);
    expect(result.traces!.publicA.steps).toHaveLength(128);
  });
  it.each([false, undefined])(
    "always returns full traces regardless of legacy flag %s",
    async (includeTrace) => {
      const fetch = mock(json(exchange()));
      expect(
        await diffieHellmanApi.exchange({ ...createDhPresetRequest(), includeTrace }, signal()),
      ).toEqual(createDhPresetResult());
      expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty("include_trace");
    },
  );
  it("uses exchange with omitted keys for random generation", async () => {
    const fetch = mock(json(random()));
    expect(
      await diffieHellmanApi.generatePrivateValues({ q: "00023", alpha: "5" }, signal()),
    ).toEqual({ q: "23", alpha: "5", privateA: "6", privateB: "15" });
    expect(fetch.mock.calls[0][0]).toBe("/api/dh/exchange");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ q: "23", alpha: "5" });
  });
  it("omits blank or absent exchange keys so BE generates them", async () => {
    const fetch = mock(json(exchange()));
    await diffieHellmanApi.exchange({ q: "23", alpha: "5" }, signal());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ q: "23", alpha: "5" });
  });
  it.each([
    [413, "REQUEST_TOO_LARGE", null, null],
    [415, "UNSUPPORTED_MEDIA_TYPE", null, null],
    [422, "INVALID_REQUEST", "include_trace", null],
    [422, "INVALID_REQUEST", "unknown", null],
    [422, "INVALID_REQUEST", "constructor", null],
    [422, "NOT_INTEGER", "privateKeyA", "privateA"],
    [422, "PRIVATE_KEY_WEAK", "privateKeyB", "privateB"],
    [422, "Q_OUT_OF_RANGE", "q", "q"],
    [422, "NOT_PRIME", "q", "q"],
    [422, "ALPHA_OUT_OF_RANGE", "alpha", "alpha"],
    [422, "NOT_PRIMITIVE_ROOT", "alpha", "alpha"],
    [422, "PRIVATE_KEY_OUT_OF_RANGE", "privateKeyB", "privateB"],
    [500, "INTERNAL_ERROR", null, null],
  ])("maps HTTP %s %s field %s", async (status, code, field, mapped) => {
    mock(
      json(
        { success: false, code, message: "Thông báo từ Backend <b>text</b>", field },
        status as number,
      ),
    );
    await expect(run()).rejects.toMatchObject({
      code,
      field: mapped,
      message: "Thông báo từ Backend <b>text</b>",
    });
  });
  it.each([
    { success: false, code: "NOT_PRIME", message: "error", field: "alpha" },
    { success: false, code: "constructor", message: "error", field: null },
    { success: false, code: "UNKNOWN", message: "error", field: null },
    { success: false, code: "NOT_PRIME", message: "", field: "q" },
    { success: false, code: "NOT_PRIME", message: "error", field: 23 },
    { success: false, code: "NOT_PRIME", message: "error" },
    { success: false, code: "NOT_PRIME", message: "error", field: "q", stack: "secret" },
  ])("rejects untrusted error envelopes %#", async (body) => {
    mock(json(body, 422));
    await expect(run()).rejects.toMatchObject(invalid);
  });
  it("rejects HTTP/code mismatch and success payload on failed HTTP status", async () => {
    mock(json({ success: false, code: "NOT_PRIME", message: "error", field: "q" }, 500));
    await expect(run()).rejects.toMatchObject(invalid);
    mock(json(exchange(), 422));
    await expect(run()).rejects.toMatchObject(invalid);
  });
  it.each([
    null,
    [],
    { result: exchange() },
    { ...exchange(), success: "true" },
    { ...exchange(), q: "023" },
    { ...exchange(), q: "29" },
    { ...exchange(), alpha: "4" },
    { ...exchange(), publicKeyA: 8 },
    { ...exchange(), publicKeyB: "0" },
    { ...exchange(), publicKeyA: "23" },
    { ...exchange(), sharedKeyA: "3" },
    { ...exchange(), match: false },
    { ...exchange(), steps: null },
    { ...exchange(), privateKeyA: "7" },
    { ...exchange(), sharedKeyB: "２" },
  ])("rejects invalid exchange schema/invariant %#", async (body) => {
    mock(json(body));
    await expect(run()).rejects.toMatchObject(invalid);
  });
  it.each([
    "missing",
    "extra",
    "empty",
    "long",
    "index",
    "bit",
    "prefix",
    "terminal",
    "extra-row",
    "multiplied",
  ])("rejects malformed trace %s", async (kind) => {
    const body = exchange() as unknown as Record<string, unknown>;
    const steps = body.steps as Record<string, Record<string, unknown>[]>;
    const rows = steps.publicKeyA;
    if (kind === "missing") delete steps.sharedKeyB;
    if (kind === "extra") steps.extra = rows;
    if (kind === "empty") steps.publicKeyA = [];
    if (kind === "long") steps.publicKeyA = Array(129).fill(rows[0]);
    if (kind === "index") rows[0].index = 0.5;
    if (kind === "bit") rows[0].bit = "1";
    if (kind === "prefix") rows[1].exponentPrefix = "4";
    if (kind === "terminal") rows.at(-1)!.result = "9";
    if (kind === "extra-row") rows[0].secret = "6";
    if (kind === "multiplied") rows.at(-1)!.multiplied = "8";
    mock(json(body));
    await expect(run()).rejects.toMatchObject(invalid);
  });
  it.each([
    { ...random(), q: "29" },
    { ...random(), alpha: "4" },
    { ...random(), privateKeyA: "1" },
    { ...random(), privateKeyB: "22" },
    { ...random(), privateKeyA: 6 },
    { ...random(), privateKeyA: "06" },
    { ...random(), traces: null },
  ])("rejects invalid random response %#", async (body) => {
    mock(json(body));
    await expect(
      diffieHellmanApi.generatePrivateValues({ q: "23", alpha: "5" }, signal()),
    ).rejects.toMatchObject(invalid);
  });
  it.each([
    new Response("<html>bad gateway</html>", { status: 502 }),
    new Response("{", { headers: { "Content-Type": "application/json" } }),
    new Response(" ".repeat(262145) + JSON.stringify(exchange()), {
      headers: { "Content-Type": "application/json" },
    }),
  ])("rejects HTML, malformed JSON and oversized bodies %#", async (response) => {
    mock(response);
    await expect(run()).rejects.toMatchObject(invalid);
  });
  it("maps transport failure without exposing its message or retrying", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("secret transport detail"));
    vi.stubGlobal("fetch", fetch);
    await expect(run()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Không thể kết nối máy chủ. Vui lòng thử lại.",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["exchange", "random"])(
    "aborts %s at exactly 15 seconds even if HTTP mock ignores abort",
    async (task) => {
      vi.useFakeTimers();
      let resolve!: (value: Response) => void;
      const fetch = vi.fn().mockImplementation(
        () =>
          new Promise<Response>((r) => {
            resolve = r;
          }),
      );
      vi.stubGlobal("fetch", fetch);
      const result =
        task === "exchange"
          ? run()
          : diffieHellmanApi.generatePrivateValues({ q: "23", alpha: "5" }, signal());
      const assertion = expect(result).rejects.toMatchObject({
        code: "TIMEOUT",
        message: "Yêu cầu quá thời gian chờ. Vui lòng thử lại.",
      });
      await vi.advanceTimersByTimeAsync(14999);
      expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
      expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
      resolve(json(task === "exchange" ? exchange() : random()));
      await Promise.resolve();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("keeps the deadline active while reading the response body", async () => {
    vi.useFakeTimers();
    const response = json(exchange());
    vi.spyOn(response, "text").mockReturnValue(new Promise(() => {}));
    mock(response);
    const assertion = expect(run()).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });
  it("preserves caller cancellation before fetch and during a pending request", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(
      diffieHellmanApi.exchange(createDhPresetRequest(), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
    const next = new AbortController();
    const result = diffieHellmanApi.exchange(createDhPresetRequest(), next.signal);
    const assertion = expect(result).rejects.toMatchObject({ name: "AbortError" });
    next.abort();
    await assertion;
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("clears deadline and removes caller listener after success", async () => {
    vi.useFakeTimers();
    mock(json(exchange()));
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await diffieHellmanApi.exchange(createDhPresetRequest(), controller.signal);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
});
