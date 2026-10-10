import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useDiffieHellman } from "../hooks/useDiffieHellman";
import type { DiffieHellmanGateway } from "../services/diffieHellmanGateway";
import {
  createDeferred,
  createDiffieHellmanGateway,
  type DhFakeOptions,
} from "../test/createDiffieHellmanGateway";
import { createDhPresetResult } from "../test/fixtures";
import { DiffieHellmanWorkspace } from "./DiffieHellmanWorkspace";

function setup(options: DhFakeOptions = {}, connected = true, withExample = true) {
  const gateway = createDiffieHellmanGateway(options);
  const selected: DiffieHellmanGateway | null = connected ? gateway : null;
  function Fixture() {
    return <DiffieHellmanWorkspace cipher={useDiffieHellman(selected, true)} />;
  }
  render(
    <StrictMode>
      <Fixture />
    </StrictMode>,
  );
  if (withExample) fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
  return gateway;
}

describe("Diffie–Hellman form", () => {
  it("starts with four empty labeled fields and loads examples only on click", () => {
    const gateway = setup({}, true, false);
    for (const input of within(screen.getByRole("form")).getAllByRole("textbox"))
      expect(input).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(within(screen.getByRole("form")).getAllByRole("textbox")).toHaveLength(4);
    for (const [label, value] of [
      ["Số nguyên tố q", "23"],
      ["Căn nguyên thủy α", "5"],
      ["Số mũ riêng X_A", "6"],
      ["Số mũ riêng X_B", "15"],
    ]) {
      const input = screen.getByRole("textbox", { name: label });
      expect(input).toHaveValue(value);
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("inputmode", "numeric");
      expect(input).toHaveAccessibleDescription(/tối đa 39 chữ số/);
    }
    expect(screen.getByRole("group", { name: "Bên A" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Bên B" })).toBeVisible();
    expect(gateway.exchange).not.toHaveBeenCalled();
    expect(gateway.generatePrivateValues).not.toHaveBeenCalled();
  });

  it("applies the preset and resets without requests", () => {
    const gateway = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Số nguyên tố q" }), {
      target: { value: "47" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(screen.getByRole("textbox", { name: "Số nguyên tố q" })).toHaveValue("23");
    fireEvent.change(screen.getByRole("textbox", { name: "Số mũ riêng X_A" }), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(screen.getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("");
    expect(gateway.exchange).not.toHaveBeenCalled();
    expect(gateway.generatePrivateValues).not.toHaveBeenCalled();
  });

  it.each(["", "2.5", "1e3", "-6", "1".repeat(40)])(
    "reports bad q %j, describes it and focuses the field",
    (value) => {
      const gateway = setup();
      const input = screen.getByRole("textbox", { name: "Số nguyên tố q" });
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue(value); // No silent truncation or numeric coercion.
      fireEvent.click(screen.getByRole("button", { name: "Thiết lập bí mật chung" }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        value.length > 39 ? /39 chữ số/ : /số nguyên không âm/,
      );
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription(
        value.length > 39 ? /không được vượt quá 39/ : /chuỗi số nguyên không âm/,
      );
      expect(input).toHaveFocus();
      expect(gateway.exchange).not.toHaveBeenCalled();
      fireEvent.change(input, { target: { value: "23" } });
      expect(input).toHaveAttribute("aria-invalid", "false");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("submits by keyboard and sends normalized decimal strings without legacy trace flag", async () => {
    const user = userEvent.setup();
    const gateway = setup();
    const input = screen.getByRole("textbox", { name: "Số nguyên tố q" });
    fireEvent.change(input, { target: { value: " 00023 " } });
    await user.click(input);
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("status", { name: "Trạng thái trao đổi DH" })).toHaveTextContent(
      "Hai bên đã thiết lập cùng bí mật chung.",
    );
    expect(gateway.exchange).toHaveBeenCalledExactlyOnceWith(
      { q: "23", alpha: "5", privateA: "6", privateB: "15" },
      expect.any(AbortSignal),
    );
    expect(input).toHaveValue(" 00023 ");
  });

  it("generates both private values even if the current private inputs are invalid", async () => {
    const gateway = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Số mũ riêng X_A" }), {
      target: { value: "x" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Số mũ riêng X_B" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" }));
    expect(await screen.findByText(/Đã điền hai số mũ riêng/)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("15");
    expect(screen.getByRole("textbox", { name: "Số mũ riêng X_B" })).toHaveValue("6");
    expect(gateway.exchange).not.toHaveBeenCalled();
    expect(gateway.generatePrivateValues).toHaveBeenCalledExactlyOnceWith(
      { q: "23", alpha: "5" },
      expect.any(AbortSignal),
    );
  });

  it("validates public fields for random generation", () => {
    const gateway = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Căn nguyên thủy α" }), {
      target: { value: "1e3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" }));
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Căn nguyên thủy α" })).toHaveFocus();
    expect(gateway.generatePrivateValues).not.toHaveBeenCalled();
  });

  it("locks both API buttons while loading but allows editing and preset cancellation", async () => {
    const deferred = createDeferred<unknown>();
    const gateway = setup({ exchange: [{ kind: "late", response: deferred.promise }] });
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập bí mật chung" }));
    expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status", { name: "Trạng thái trao đổi DH" })).toHaveTextContent(
      "Đang thiết lập bí mật chung…",
    );
    expect(screen.getByRole("button", { name: "Đang thiết lập…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Số nguyên tố q" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tạo ví dụ" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(gateway.exchange.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      deferred.resolve(createDhPresetResult());
    });
    expect(
      screen.queryByRole("status", { name: "Trạng thái trao đổi DH" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thiết lập bí mật chung" })).toBeEnabled();
  });

  it("shows a business error as text and supports retry", async () => {
    const gateway = setup({ random: [{ kind: "error" }] });
    fireEvent.click(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lỗi thử nghiệm <Backend> & yêu cầu thử lại.",
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Căn nguyên thủy α" })).toHaveFocus(),
    );
    expect(document.querySelector("backend")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText(/Đã điền hai số mũ riêng/)).toBeVisible();
    expect(gateway.generatePrivateValues).toHaveBeenCalledTimes(2);
  });

  it("opens traces without requests and discards analysis on edit or a new task", async () => {
    const gateway = setup();
    const user = userEvent.setup();
    const submit = screen.getByRole("button", { name: "Thiết lập bí mật chung" });
    await user.click(submit);
    expect(await screen.findByRole("region", { name: "Phân tích Diffie–Hellman" })).toBeVisible();
    await user.click(screen.getByText("Trace Y_A · 3 bước"));
    expect(gateway.exchange).toHaveBeenCalledTimes(1);
    expect(gateway.generatePrivateValues).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Số mũ riêng X_A" }), {
      target: { value: "15" },
    });
    expect(
      screen.queryByRole("region", { name: "Phân tích Diffie–Hellman" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đặt lại" }));
    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    await user.click(submit);
    expect(await screen.findByText("Trace Y_A · 3 bước")).toBeVisible();
    expect(screen.getByText("Trace Y_A · 3 bước").closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" }));
    expect(
      screen.queryByRole("region", { name: "Phân tích Diffie–Hellman" }),
    ).not.toBeInTheDocument();
  });

  it("explains missing service and disables only API actions", () => {
    const gateway = setup({}, false);
    expect(screen.getByText(/Chưa kết nối dịch vụ xử lý/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Thiết lập bí mật chung" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Số nguyên tố q" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tạo ví dụ" })).toBeEnabled();
    fireEvent.submit(screen.getByRole("form"));
    expect(gateway.exchange).not.toHaveBeenCalled();
  });
});
