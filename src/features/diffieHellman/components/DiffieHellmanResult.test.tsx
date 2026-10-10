import { StrictMode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiffieHellman } from "../hooks/useDiffieHellman";
import { createDeferred, createDiffieHellmanGateway } from "../test/createDiffieHellmanGateway";
import {
  createDhPresetRequest,
  createDhPresetResult,
  createDhRandomValues,
  createDhSwappedResult,
} from "../test/fixtures";
import { DiffieHellmanResult } from "./DiffieHellmanResult";
import { DiffieHellmanWorkspace } from "./DiffieHellmanWorkspace";

beforeEach(() => {
  vi.mocked(navigator.clipboard.writeText).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.mocked(navigator.clipboard.writeText).mockReset().mockResolvedValue(undefined);
});

function setupResult() {
  return render(
    <StrictMode>
      <DiffieHellmanResult snapshot={createDhPresetRequest()} result={createDhPresetResult()} />
    </StrictMode>,
  );
}

function setupWorkspace() {
  const gateway = createDiffieHellmanGateway();
  function Fixture() {
    return <DiffieHellmanWorkspace cipher={useDiffieHellman(gateway, true)} />;
  }
  render(
    <StrictMode>
      <Fixture />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
  return gateway;
}

describe("Diffie–Hellman result", () => {
  it("shows A/B values, substituted formulas and both public exchange directions", () => {
    setupResult();
    expect(screen.getByText(createDhPresetResult().warning.message)).toBeVisible();
    const a = within(screen.getByRole("region", { name: "Kết quả bên A" }));
    const b = within(screen.getByRole("region", { name: "Kết quả bên B" }));
    expect(a.getByText("8", { exact: true })).toBeVisible();
    expect(a.getByText("2", { exact: true })).toBeVisible();
    expect(a.getByText("Y_A = 5^6 mod 23 = 8")).toBeVisible();
    expect(a.getByText("K_A = 19^6 mod 23 = 2")).toBeVisible();
    expect(b.getByText("19", { exact: true })).toBeVisible();
    expect(b.getByText("2", { exact: true })).toBeVisible();
    expect(b.getByText("Y_B = 5^15 mod 23 = 19")).toBeVisible();
    expect(b.getByText("K_B = 8^15 mod 23 = 2")).toBeVisible();
    const exchange = within(screen.getByRole("region", { name: "Trao đổi khóa công khai" }));
    const steps = exchange.getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("A → BY_A = 8");
    expect(steps[1]).toHaveTextContent("B → AY_B = 19");
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it.each([
    ["Y_A", "8"],
    ["Y_B", "19"],
    ["K_A", "2"],
    ["K_B", "2"],
  ])("copies only the decimal value of %s on explicit click", async (symbol, value) => {
    setupResult();
    fireEvent.click(screen.getByRole("button", { name: `Sao chép ${symbol}` }));
    const notification = await screen.findByRole("status");
    expect(notification).toHaveTextContent(`Đã sao chép ${symbol}.`);
    expect(notification).toHaveClass("notice", "notice--success");
    fireEvent.click(within(notification).getByRole("button", { name: "Đóng thông báo" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith(value);
  });

  it("keeps values selectable and explains manual copy after clipboard failure, then retries", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error("Not allowed"));
    setupResult();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép Y_A" }));
    const notification = await screen.findByRole("status");
    expect(notification).toHaveTextContent(
      "Không thể sao chép Y_A. Hãy chọn giá trị và sao chép thủ công.",
    );
    expect(notification).toHaveClass("notice", "notice--error");
    expect(
      within(screen.getByRole("region", { name: "Kết quả bên A" })).getByText("8", { exact: true }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép Y_A" }));
    expect(await screen.findByText("Đã sao chép Y_A.")).toBeVisible();
  });

  it("serializes pending copy actions without additional clipboard writes", async () => {
    const deferred = createDeferred<void>();
    vi.mocked(navigator.clipboard.writeText).mockReturnValueOnce(deferred.promise);
    setupResult();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép K_A" }));
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép Y_B" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith("2");
    await act(async () => {
      deferred.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép K_A.");
    expect(screen.getByRole("button", { name: "Sao chép Y_B" })).toBeEnabled();
  });

  it("ignores a pending copy completion after a replacement snapshot", async () => {
    const deferred = createDeferred<void>();
    vi.mocked(navigator.clipboard.writeText).mockReturnValueOnce(deferred.promise);
    const { rerender } = setupResult();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép Y_A" }));
    rerender(
      <StrictMode>
        <DiffieHellmanResult snapshot={createDhRandomValues()} result={createDhSwappedResult()} />
      </StrictMode>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sao chép Y_A" })).toBeEnabled();
    await act(async () => {
      deferred.resolve();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép Y_A" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã sao chép Y_A.");
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("19");
  });

  it("only mounts after exchange success and hides results on edit, random and reset", async () => {
    const gateway = setupWorkspace();
    const results = () => screen.queryByRole("region", { name: "Kết quả thiết lập bí mật chung" });
    expect(results()).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Số nguyên tố q" }), {
      target: { value: " 00023 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập bí mật chung" }));
    expect(
      await screen.findByRole("region", { name: "Kết quả thiết lập bí mật chung" }),
    ).toHaveTextContent("q=23, α=5");
    fireEvent.change(screen.getByRole("textbox", { name: "Số mũ riêng X_A" }), {
      target: { value: "7" },
    });
    expect(results()).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Số mũ riêng X_A" }), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập bí mật chung" }));
    await screen.findByRole("region", { name: "Kết quả thiết lập bí mật chung" });
    fireEvent.click(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" }));
    await screen.findByText(/Đã điền hai số mũ riêng/);
    expect(results()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập bí mật chung" }));
    await screen.findByRole("region", { name: "Kết quả thiết lập bí mật chung" });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(results()).not.toBeInTheDocument();
    expect(gateway.exchange).toHaveBeenCalledTimes(3);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("does not leak a delayed clipboard message into the next exchange result", async () => {
    const deferred = createDeferred<void>();
    vi.mocked(navigator.clipboard.writeText).mockReturnValueOnce(deferred.promise);
    setupWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập bí mật chung" }));
    await screen.findByRole("region", { name: "Kết quả thiết lập bí mật chung" });
    fireEvent.click(screen.getByRole("button", { name: "Sao chép K_B" }));
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập bí mật chung" }));
    await screen.findByRole("region", { name: "Kết quả thiết lập bí mật chung" });
    await act(async () => {
      deferred.reject(new Error("Old copy failed"));
    });
    expect(screen.queryByText(/Không thể sao chép/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đã sao chép/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sao chép K_B" })).toBeEnabled();
  });
});
