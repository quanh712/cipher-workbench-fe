import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("runs a labeled fixed demo without calling the cipher backend and preserves keys across tabs", () => {
    const { generateKey, transform } = setup();
    expect(screen.getByText("Dữ liệu minh họa", { exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ký minh họa" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Ký minh họa" }));
    expect(screen.getByText("Đã ký minh họa", { exact: true })).toBeVisible();
    const n = screen.getByRole("textbox", { name: "n · modulo" });
    const value = (n as HTMLInputElement).value;
    fireEvent.click(screen.getByRole("tab", { name: "Mã hóa" }));
    expect(screen.getByRole("textbox", { name: "n · modulo" })).toHaveValue(value);
    fireEvent.click(screen.getByRole("tab", { name: "Chữ ký số" }));
    expect(screen.getByText("Đã ký minh họa", { exact: true })).toBeVisible();
    expect(generateKey).not.toHaveBeenCalled();
    expect(transform).not.toHaveBeenCalled();
  });

  it("removes results after editing input or a key and clears signature drafts on reset", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Ký minh họa" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Thông điệp gốc m (số)" }), {
      target: { value: "42" },
    });
    expect(screen.queryByText("Đã ký minh họa", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ký minh họa" })).toBeDisabled();
    expect(screen.getByText("Chờ backend.", { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Ký minh họa" }));
    fireEvent.change(screen.getByRole("textbox", { name: "d · khóa riêng" }), {
      target: { value: "9" },
    });
    expect(screen.queryByText("Đã ký minh họa", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ký minh họa" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    fireEvent.click(screen.getByRole("tab", { name: "Chữ ký số" }));
    expect(screen.getByRole("textbox", { name: "Thông điệp gốc m (số)" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Ký minh họa" })).toBeDisabled();
  });
});
