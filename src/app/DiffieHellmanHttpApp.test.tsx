import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diffieHellmanApi } from "../features/diffieHellman/services/diffieHellmanApi";
import { createDhPresetWireResult } from "../features/diffieHellman/test/fixtures";
import { getHealthStatus } from "../features/history/services/historyApi";
import { App } from "./App";

// Only optional health is isolated; App, hook, HTTP adapter and response validators are real.
vi.mock("../features/history/services/historyApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/history/services/historyApi")>()),
  getHealthStatus: vi.fn(),
}));

const exchangeBody = () => createDhPresetWireResult();
const randomBody = () => createDhPresetWireResult();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const result = () => screen.queryByRole("region", { name: "Kết quả thiết lập bí mật chung" });
const input = (name: string) => screen.getByRole("textbox", { name });
const example = () => fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
const openDh = () => fireEvent.click(screen.getByRole("tab", { name: /Diffie–Hellman/ }));
const start = (task: "exchange" | "random") =>
  fireEvent.click(
    screen.getByRole("button", {
      name: task === "exchange" ? "Thiết lập bí mật chung" : "Sinh số mũ ngẫu nhiên",
    }),
  );

// Deliberately ignores abort: the application must also handle late transport completions.
function pendingHttp() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup() {
  const fetch = vi.spyOn(globalThis, "fetch").mockReset();
  render(<App diffieHellmanGateway={diffieHellmanApi} />);
  openDh();
  return fetch;
}
function expectIdle() {
  expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "false");
  expect(screen.getByRole("button", { name: "Thiết lập bí mật chung" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" })).toBeEnabled();
}

beforeEach(() => {
  vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
  vi.mocked(getHealthStatus).mockResolvedValue({ database: "ok", history: "disabled" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("App → Diffie–Hellman HTTP adapter", () => {
  it("does not auto-fetch; submits canonical DTO and renders Backend results and four traces", async () => {
    const fetch = setup();
    expect(fetch).not.toHaveBeenCalled();
    example();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(input("Số nguyên tố q"), { target: { value: " \t00023 " } });
    fetch.mockResolvedValueOnce(json(exchangeBody()));
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.submit(screen.getByRole("form")); // Repeated submit must share the same pending lock.
    expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" })).toBeDisabled();
    const region = await screen.findByRole("region", { name: "Kết quả thiết lập bí mật chung" });
    expect(
      within(region)
        .getByRole("button", { name: "Sao chép Y_A" })
        .parentElement?.querySelector(".dh__value"),
    ).toHaveTextContent("8");
    expect(
      within(region)
        .getByRole("button", { name: "Sao chép Y_B" })
        .parentElement?.querySelector(".dh__value"),
    ).toHaveTextContent("19");
    expect(screen.getByRole("status", { name: "Trạng thái trao đổi DH" })).toHaveTextContent(
      "Hai bên đã thiết lập cùng bí mật chung.",
    );
    for (const name of [
      "Trace Y_A · 3 bước",
      "Trace Y_B · 4 bước",
      "Trace K_A · 3 bước",
      "Trace K_B · 4 bước",
    ])
      expect(screen.getByText(name).closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Trace Y_A · 3 bước"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/dh/exchange");
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
      q: "23",
      alpha: "5",
      privateKeyA: "6",
      privateKeyB: "15",
    });
    expectIdle();
  });

  it("blocks malformed input before HTTP and random sends only public parameters", async () => {
    const fetch = setup();
    example();
    fireEvent.change(input("Số mũ riêng X_A"), { target: { value: "x" } });
    start("exchange");
    expect(fetch).not.toHaveBeenCalled();
    expect(input("Số mũ riêng X_A")).toHaveAttribute("aria-invalid", "true");
    fetch.mockResolvedValueOnce(json(randomBody()));
    start("random");
    await screen.findByText("Đã điền hai số mũ riêng. Bấm Thiết lập bí mật chung để tiếp tục.");
    expect(input("Số mũ riêng X_A")).toHaveValue("6");
    expect(input("Số mũ riêng X_B")).toHaveValue("15");
    expect(input("Số mũ riêng X_A")).toHaveAttribute("aria-invalid", "false");
    expect(result()).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/dh/exchange");
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ q: "23", alpha: "5" });
    expectIdle();
  });

  it("random clears an earlier exchange immediately and replaces both private values only after HTTP success", async () => {
    const fetch = setup();
    example();
    fetch.mockResolvedValueOnce(json(exchangeBody()));
    start("exchange");
    await screen.findByRole("region", { name: "Kết quả thiết lập bí mật chung" });
    const pending = pendingHttp();
    fetch.mockReturnValueOnce(pending.promise);
    start("random");
    expect(result()).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Phân tích Diffie–Hellman" }),
    ).not.toBeInTheDocument();
    expect(input("Số mũ riêng X_A")).toHaveValue("6");
    expect(input("Số mũ riêng X_B")).toHaveValue("15");
    await act(async () => {
      pending.resolve(json(randomBody()));
    });
    expect(input("Số mũ riêng X_A")).toHaveValue("6");
    expect(input("Số mũ riêng X_B")).toHaveValue("15");
    expect(result()).not.toBeInTheDocument();
    expectIdle();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["exchange", "PRIVATE_KEY_OUT_OF_RANGE", "privateKeyA", "Số mũ riêng X_A"],
    ["exchange", "PRIVATE_KEY_OUT_OF_RANGE", "privateKeyB", "Số mũ riêng X_B"],
    ["random", "NOT_PRIME", "q", "Số nguyên tố q"],
    ["random", "NOT_PRIMITIVE_ROOT", "alpha", "Căn nguyên thủy α"],
  ] as const)(
    "maps %s HTTP error %s/%s to the accessible field and supports retry",
    async (task, code, field, label) => {
      const fetch = setup();
      example();
      const message = "Lỗi Backend <b>giữ nguyên dạng text</b>";
      fetch.mockResolvedValueOnce(json({ success: false, code, message, field }, 422));
      start(task);
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.getByRole("alert").querySelector("b")).toBeNull();
      expect(input(label)).toHaveAttribute("aria-invalid", "true");
      expect(input(label)).toHaveAccessibleDescription(expect.stringContaining(message));
      await waitFor(() => expect(input(label)).toHaveFocus());
      expect(input("Số mũ riêng X_A")).toHaveValue("6");
      expect(result()).not.toBeInTheDocument();
      expectIdle();
      fetch.mockResolvedValueOnce(json(task === "exchange" ? exchangeBody() : randomBody()));
      start(task);
      await screen.findByRole("status", { name: "Trạng thái trao đổi DH" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(input(label)).toHaveAttribute("aria-invalid", "false");
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["schema", "network", "unknown-field"])(
    "shows %s errors without partial results or false field errors",
    async (kind) => {
      const fetch = setup();
      example();
      if (kind === "network") fetch.mockRejectedValueOnce(new TypeError("private network detail"));
      else
        fetch.mockResolvedValueOnce(
          json(
            kind === "schema"
              ? { ...exchangeBody(), sharedKeyB: "3" }
              : {
                  success: false,
                  code: "INVALID_REQUEST",
                  message: "Trường không hợp lệ.",
                  field: "future_field",
                },
            kind === "schema" ? 200 : 422,
          ),
        );
      start("exchange");
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        kind === "schema"
          ? "Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại."
          : kind === "network"
            ? "Không thể kết nối máy chủ. Vui lòng thử lại."
            : "Trường không hợp lệ.",
      );
      expect(result()).not.toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Phân tích Diffie–Hellman" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("form").querySelector('[aria-invalid="true"]')).toBeNull();
      expectIdle();
    },
  );

  for (const task of ["exchange", "random"] as const) {
    it(`${task} times out after 15 seconds, retries and ignores late HTTP success`, async () => {
      vi.useFakeTimers();
      const fetch = setup();
      example();
      const old = pendingHttp();
      const next = pendingHttp();
      fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
      start(task);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(14999);
      });
      expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Yêu cầu quá thời gian chờ. Vui lòng thử lại.",
      );
      expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
      expectIdle();
      expect(result()).not.toBeInTheDocument();
      start(task);
      await act(async () => {
        old.resolve(json(task === "exchange" ? exchangeBody() : randomBody()));
      });
      expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(result()).not.toBeInTheDocument();
      await act(async () => {
        next.resolve(json(task === "exchange" ? exchangeBody() : randomBody()));
      });
      expectIdle();
      expect(screen.getByRole("status", { name: "Trạng thái trao đổi DH" })).toHaveTextContent(
        task === "exchange" ? "Hai bên đã thiết lập" : "Đã điền hai số mũ riêng",
      );
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it.each(["edit", "reset", "cipher", "header", "example"])(
      `${task}: %s aborts HTTP, preserves the correct draft and cannot unlock a newer request`,
      async (action) => {
        const fetch = setup();
        example();
        const old = pendingHttp();
        const next = pendingHttp();
        fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
        start(task);
        expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
        if (action === "edit")
          fireEvent.change(input("Số mũ riêng X_A"), { target: { value: "9" } });
        if (action === "reset") fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
        if (action === "cipher") fireEvent.click(screen.getByRole("tab", { name: /Caesar/ }));
        if (action === "header") fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
        if (action === "example") example();
        expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
        if (action === "cipher" || action === "header") openDh();
        expectIdle();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(input("Số mũ riêng X_A")).toHaveValue(
          action === "edit" ? "9" : action === "reset" || action === "header" ? "" : "6",
        );
        expect(fetch).toHaveBeenCalledTimes(1);
        example();
        start(task);
        // A stale HTTP error must not overwrite loading state or display an alert.
        await act(async () => {
          old.resolve(
            json(
              { success: false, code: "NOT_PRIME", message: "STALE HTTP ERROR", field: "q" },
              422,
            ),
          );
        });
        expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
        expect(
          screen.getByRole("button", {
            name: task === "exchange" ? "Sinh số mũ ngẫu nhiên" : "Thiết lập bí mật chung",
          }),
        ).toBeDisabled();
        expect(result()).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(input("Số mũ riêng X_A")).toHaveValue("6");
        await act(async () => {
          next.resolve(json(task === "exchange" ? exchangeBody() : randomBody()));
        });
        expectIdle();
        expect(screen.getByRole("status", { name: "Trạng thái trao đổi DH" })).toHaveTextContent(
          task === "exchange" ? "Hai bên đã thiết lập" : "Đã điền hai số mũ riêng",
        );
        expect(fetch).toHaveBeenCalledTimes(2);
      },
    );
  }
});
