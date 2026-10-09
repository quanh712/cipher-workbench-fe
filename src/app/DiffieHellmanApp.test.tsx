import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHealthStatus } from "../features/history/services/historyApi";
import {
  createDeferred,
  createDiffieHellmanGateway,
} from "../features/diffieHellman/test/createDiffieHellmanGateway";
import { createDhPresetResult } from "../features/diffieHellman/test/fixtures";
import { App } from "./App";

vi.mock("../features/history/services/historyApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/history/services/historyApi")>()),
  getHealthStatus: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getHealthStatus).mockResolvedValue({ database: "ok", history: "disabled" });
});
afterEach(() => vi.unstubAllEnvs());

function openDh() {
  fireEvent.click(screen.getByRole("tab", { name: /Diffie–Hellman minh họa/ }));
}
function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
  fireEvent.click(screen.getByRole("button", { name: "Thiết lập bí mật chung" }));
}

describe("Diffie–Hellman app registration", () => {
  it.each([undefined, "false", "TRUE", "1"])(
    "hides DH unless the flag is exactly true (%s)",
    (flag) => {
      vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", flag);
      const gateway = createDiffieHellmanGateway();
      render(<App diffieHellmanGateway={gateway} />);
      expect(screen.queryByRole("tab", { name: /Diffie–Hellman/ })).not.toBeInTheDocument();
      expect(gateway.exchange).not.toHaveBeenCalled();
      expect(gateway.generatePrivateValues).not.toHaveBeenCalled();
    },
  );

  it("registers an accessible tab and explains the missing Backend connection", async () => {
    vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
    render(<App />);
    const user = userEvent.setup();
    const tab = screen.getByRole("tab", { name: /Diffie–Hellman/ });
    screen.getByRole("tab", { name: /Caesar/ }).focus();
    await user.keyboard("{End}");
    expect(tab).toHaveFocus();
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: /Diffie–Hellman/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Thiết lập bí mật chung" })).toBeDisabled();
    expect(screen.getByText(/Chưa kết nối dịch vụ xử lý/)).toBeVisible();
  });

  it("keeps independent drafts across cipher changes and resets all DH fields from the header", async () => {
    vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
    const gateway = createDiffieHellmanGateway();
    render(<App diffieHellmanGateway={gateway} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), {
      target: { value: "Bản nháp Caesar" },
    });
    openDh();
    for (const [label, value] of [
      ["Số nguyên tố q", "47"],
      ["Căn nguyên thủy α", "10"],
      ["Số mũ riêng X_A", "7"],
      ["Số mũ riêng X_B", "12"],
    ]) {
      fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
    }
    fireEvent.click(screen.getByRole("tab", { name: /Caesar/ }));
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue(
      "Bản nháp Caesar",
    );
    openDh();
    for (const [label, value] of [
      ["Số nguyên tố q", "47"],
      ["Căn nguyên thủy α", "10"],
      ["Số mũ riêng X_A", "7"],
      ["Số mũ riêng X_B", "12"],
    ]) {
      expect(screen.getByRole("textbox", { name: label })).toHaveValue(value);
    }
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(screen.getByRole("tab", { name: /Caesar/ })).toHaveAttribute("aria-selected", "true");
    openDh();
    for (const [label, value] of [
      ["Số nguyên tố q", ""],
      ["Căn nguyên thủy α", ""],
      ["Số mũ riêng X_A", ""],
      ["Số mũ riêng X_B", ""],
    ]) {
      expect(screen.getByRole("textbox", { name: label })).toHaveValue(value);
    }
    expect(gateway.exchange).not.toHaveBeenCalled();
    expect(gateway.generatePrivateValues).not.toHaveBeenCalled();
  });

  it("clears successful results and open traces when changing cipher", async () => {
    vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
    const gateway = createDiffieHellmanGateway();
    render(<App diffieHellmanGateway={gateway} />);
    openDh();
    submit();
    await screen.findByRole("region", { name: "Phân tích Diffie–Hellman" });
    await userEvent.click(screen.getByText("Trace Y_A · 3 bước"));
    fireEvent.click(screen.getByRole("tab", { name: /Caesar/ }));
    openDh();
    expect(
      screen.queryByRole("region", { name: "Phân tích Diffie–Hellman" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Trạng thái trao đổi DH" }),
    ).not.toBeInTheDocument();
    submit();
    expect(await screen.findByText("Trace Y_A · 3 bước")).toBeVisible();
    expect(screen.getByText("Trace Y_A · 3 bước").closest("details")).not.toHaveAttribute("open");
    expect(gateway.exchange).toHaveBeenCalledTimes(2);
  });

  it.each(["cipher", "header"])(
    "allows %s navigation during DH loading and ignores late responses",
    async (action) => {
      vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
      const deferred = createDeferred<unknown>();
      const gateway = createDiffieHellmanGateway({
        exchange: [{ kind: "late", response: deferred.promise }],
      });
      render(<App diffieHellmanGateway={gateway} />);
      openDh();
      submit();
      expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
      const target =
        action === "cipher"
          ? screen.getByRole("tab", { name: /Caesar/ })
          : screen.getByRole("button", { name: "Làm mới" });
      expect(target).toBeEnabled();
      fireEvent.click(target);
      expect(gateway.exchange.mock.calls[0][1].aborted).toBe(true);
      await act(async () => deferred.resolve(createDhPresetResult()));
      openDh();
      expect(
        screen.queryByRole("region", { name: "Kết quả thiết lập bí mật chung" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Thiết lập bí mật chung" })).toBeEnabled();
    },
  );

  it("retains the draft when visiting history and keeps DH out of history filters", async () => {
    vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
    vi.mocked(getHealthStatus).mockResolvedValue({ database: "ok", history: "enabled" });
    const gateway = createDiffieHellmanGateway();
    render(<App diffieHellmanGateway={gateway} />);
    await screen.findByRole("button", { name: "Lịch sử thao tác" });
    openDh();
    fireEvent.change(screen.getByRole("textbox", { name: "Số mũ riêng X_A" }), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử thao tác" }));
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Số mũ riêng X_A" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("option", { name: /Diffie–Hellman/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Công cụ" }));
    expect(screen.getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("7");
    expect(gateway.exchange).not.toHaveBeenCalled();
  });
});
