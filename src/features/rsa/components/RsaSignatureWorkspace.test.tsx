import { StrictMode } from "react";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRsaCipher } from "../hooks/useRsaCipher";
import { createRsaGateway } from "../test/createRsaGateway";
import { RsaWorkspace } from "./RsaWorkspace";

function setup() {
  const gateway = createRsaGateway();
  const generateKey = vi.spyOn(gateway, "generateKey");
  const transform = vi.spyOn(gateway, "transform");
  function Fixture() {
    return <RsaWorkspace cipher={useRsaCipher(gateway, true)} />;
  }
  render(
    <StrictMode>
      <Fixture />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Chữ ký số" }));
  return { generateKey, transform };
}

describe("RSA signature workspace", () => {
  it("signs through the gateway and preserves keys across tabs", async () => {
    const { generateKey, transform } = setup();
    expect(screen.getByText("RSA học thuật", { exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ký" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Ký" }));
    await screen.findByText("Đã ký", { exact: true });
    expect(screen.getByText("Đã ký", { exact: true })).toBeVisible();
    expect(screen.getByText("Ký thành công.")).toBeVisible();
    const n = screen.getByRole("textbox", { name: "n · modulo" });
    const value = (n as HTMLInputElement).value;
    fireEvent.click(screen.getByRole("tab", { name: "Mã hóa" }));
    expect(screen.getByRole("textbox", { name: "n · modulo" })).toHaveValue(value);
    fireEvent.click(screen.getByRole("tab", { name: "Chữ ký số" }));
    expect(screen.getByText("Đã ký", { exact: true })).toBeVisible();
    expect(generateKey).not.toHaveBeenCalled();
    expect(transform).not.toHaveBeenCalled();
  });

  it("loads the normal example for the selected mode and always shows the invalid signature example", async () => {
    setup();
    expect(screen.getByRole("button", { name: "Chữ ký không hợp lệ" })).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: /Kiểm tra/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(screen.getByRole("radio", { name: /Kiểm tra/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: "Chữ ký s (số)" })).toHaveValue("11");
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra" }));
    await waitFor(() => expect(screen.getByText("Chữ ký hợp lệ", { exact: true })).toBeVisible());
    expect(screen.getByText("Chữ ký hợp lệ", { exact: true })).toHaveClass("status--success");
    expect(screen.getAllByRole("button", { name: "Dán" })).toHaveLength(2);
  });

  it("copies and clears results, pastes either field and reports clipboard failures", async () => {
    setup();
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    vi.mocked(navigator.clipboard.readText).mockResolvedValue("42");
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Ký" }));
    await screen.findByText("Đã ký", { exact: true });
    const output = within(screen.getByRole("group", { name: "Thao tác kết quả chữ ký" }));
    fireEvent.click(output.getByRole("button", { name: "Sao chép" }));
    expect(await screen.findByText("Đã sao chép.")).toBeVisible();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("11");
    fireEvent.click(output.getByRole("button", { name: "Xóa" }));
    expect(screen.queryByText("Đã ký", { exact: true })).not.toBeInTheDocument();
    const message = within(screen.getByRole("group", { name: "Thao tác thông điệp" }));
    fireEvent.click(message.getByRole("button", { name: "Dán" }));
    expect(await screen.findByText("Đã dán nội dung từ clipboard.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Thông điệp gốc m (số)" })).toHaveValue("42");
    expect(screen.getByRole("button", { name: "Ký" })).toBeEnabled();
    fireEvent.click(message.getByRole("button", { name: "Xóa" }));
    expect(screen.getByRole("textbox", { name: "Thông điệp gốc m (số)" })).toHaveValue("");
    fireEvent.click(screen.getByRole("radio", { name: /Kiểm tra/ }));
    const signature = within(screen.getByRole("group", { name: "Thao tác chữ ký" }));
    fireEvent.click(signature.getByRole("button", { name: "Dán" }));
    expect(await screen.findByText("Đã dán nội dung từ clipboard.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Chữ ký s (số)" })).toHaveValue("42");
    vi.mocked(navigator.clipboard.readText).mockRejectedValueOnce(new Error("Denied"));
    fireEvent.click(signature.getByRole("button", { name: "Dán" }));
    expect(await screen.findByText("Không thể đọc nội dung clipboard.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Chữ ký s (số)" })).toHaveValue("42");
  });

  it("removes results after editing input or a key and clears signature drafts on reset", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Ký" }));
    await screen.findByText("Đã ký", { exact: true });
    fireEvent.change(screen.getByRole("textbox", { name: "Thông điệp gốc m (số)" }), {
      target: { value: "42" },
    });
    expect(screen.queryByText("Đã ký", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ký" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Ký" }));
    await screen.findByText("Đã ký", { exact: true });
    fireEvent.change(screen.getByRole("textbox", { name: "d · khóa riêng" }), {
      target: { value: "9" },
    });
    expect(screen.queryByText("Đã ký", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ký" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    fireEvent.click(screen.getByRole("tab", { name: "Chữ ký số" }));
    expect(screen.getByRole("textbox", { name: "Thông điệp gốc m (số)" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Ký" })).toBeDisabled();
  });
});
