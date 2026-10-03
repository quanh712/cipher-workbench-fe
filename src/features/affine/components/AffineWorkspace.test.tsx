import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useAffineCipher } from "../hooks/useAffineCipher";
import type { AffineGateway } from "../services/affineGateway";
import { createAffineGateway } from "../test/createAffineGateway";
import { AffineWorkspace } from "./AffineWorkspace";

function Harness({ gateway }: { gateway: AffineGateway }) {
  const cipher = useAffineCipher(gateway);
  return <AffineWorkspace cipher={cipher} />;
}

describe("AffineWorkspace", () => {
  it("wires the official example through the real hook and fake gateway", async () => {
    const user = userEvent.setup();
    const gateway = createAffineGateway();
    render(<Harness gateway={gateway} />);

    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));

    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue("HELLO");
    expect(screen.getByRole("textbox", { name: "Khóa nhân a" })).toHaveValue("5");
    expect(screen.getByRole("textbox", { name: "Khóa dịch b" })).toHaveValue("8");
    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeEnabled();
    expect(
      screen.getByRole("heading", { name: "E(x) = (5 × x + 8) mod 26 · A → I" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    expect(gateway.processText).toHaveBeenCalledWith("encrypt", {
      text: "HELLO",
      aToken: "5",
      bToken: "8",
    });
    expect(await screen.findByText("Mã hóa thành công.")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Văn bản" })).toHaveTextContent("RCLLA");
  });

  it("places the key and primary action below input, before the full-width map", () => {
    render(<Harness gateway={createAffineGateway()} />);

    const keySection = screen.getByRole("region", { name: "Khóa Affine" });
    const mapLabel = screen.getByText("Bảng ánh xạ Affine");
    const action = screen.getByRole("button", { name: "Mã hóa" });

    const input = screen.getByRole("textbox", { name: "Nội dung đầu vào" });
    expect(
      input.compareDocumentPosition(keySection) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      keySection.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      action.compareDocumentPosition(mapLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("pastes and copies input with clear notices", async () => {
    const user = userEvent.setup();
    const readText = vi.spyOn(navigator.clipboard, "readText").mockResolvedValue("Pasted text");
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Harness gateway={createAffineGateway()} />);

    const input = screen.getByRole("textbox", { name: "Nội dung đầu vào" });
    const inputSection = input.closest("section")!;
    await user.click(within(inputSection).getByRole("button", { name: "Dán" }));
    expect(input).toHaveValue("Pasted text");
    expect(await screen.findByText("Đã dán nội dung từ clipboard.")).toBeInTheDocument();

    await user.click(within(inputSection).getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenCalledWith("Pasted text");
    expect(await screen.findByText("Đã sao chép đầu vào.")).toBeInTheDocument();
    expect(readText).toHaveBeenCalledOnce();
  });

  it("shows file-reading state and keeps processing disabled until reading finishes", async () => {
    const user = userEvent.setup();
    let resolveRead!: (value: string) => void;
    const file = new File(["placeholder"], "message.txt", { type: "text/plain" });
    Object.defineProperty(file, "text", {
      value: () =>
        new Promise<string>((resolve) => {
          resolveRead = resolve;
        }),
    });
    render(<Harness gateway={createAffineGateway()} />);

    await user.click(screen.getByRole("button", { name: "File .txt" }));
    await user.type(screen.getByRole("textbox", { name: "Khóa nhân a" }), "5");
    await user.type(screen.getByRole("textbox", { name: "Khóa dịch b" }), "8");
    await user.upload(screen.getByLabelText("Chọn file văn bản"), file);

    expect(screen.getByText("Đang đọc nội dung file…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang đọc file…" })).toBeDisabled();

    resolveRead("HELLO");
    expect(await screen.findByText("✓ Đầu vào hợp lệ ở mức sơ bộ.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeEnabled();
  });

  it("ignores a pending paste that resolves after processing starts", async () => {
    const user = userEvent.setup();
    let resolveClipboard!: (value: string) => void;
    let resolveRequest!: (value: { success: true; result: string }) => void;
    const clipboardPromise = new Promise<string>((resolve) => {
      resolveClipboard = resolve;
    });
    const requestPromise = new Promise<{ success: true; result: string }>((resolve) => {
      resolveRequest = resolve;
    });
    vi.spyOn(navigator.clipboard, "readText").mockReturnValue(clipboardPromise);
    const gateway = createAffineGateway({
      processText: vi.fn().mockReturnValue(requestPromise),
    });
    render(<Harness gateway={gateway} />);

    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    const input = screen.getByRole("textbox", { name: "Nội dung đầu vào" });
    const inputSection = input.closest("section")!;
    await user.click(within(inputSection).getByRole("button", { name: "Dán" }));
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));

    await act(async () => {
      resolveClipboard("STALE PASTE");
      await clipboardPromise;
    });
    expect(input).toHaveValue("HELLO");
    expect(screen.queryByText("Đã dán nội dung từ clipboard.")).not.toBeInTheDocument();

    await act(async () => {
      resolveRequest({ success: true, result: "RCLLA" });
      await requestPromise;
    });
    expect(screen.getByRole("tabpanel", { name: "Văn bản" })).toHaveTextContent("RCLLA");
    expect(input).toHaveValue("HELLO");
  });
});
