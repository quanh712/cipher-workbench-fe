import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDesCipher } from "../hooks/useDesCipher";
import type { DesGateway } from "../services/desGateway";
import { createDesGateway } from "../test/createDesGateway";
import { DesWorkspace } from "./DesWorkspace";

function Harness({ gateway }: { gateway: DesGateway }) {
  return <DesWorkspace cipher={useDesCipher(gateway)} />;
}

describe("DES workspace", () => {
  it("shows algorithm analysis instead of the ECB/CBC comparison", async () => {
    const process = vi
      .fn<DesGateway["process"]>()
      .mockResolvedValue({ text: "85E813540F0AB405", attachment: null });
    render(<Harness gateway={{ kind: "api", process }} />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Mã hóa" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Nội dung kết quả DES")).toHaveTextContent("85E813540F0AB405"),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Phân tích" }));
    expect(screen.getByText("DES · Mạng Feistel 16 vòng")).toBeVisible();
    expect(screen.queryByText("Phân biệt ECB và CBC")).not.toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: "Phân tích" });
    fireEvent.keyDown(tab, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Văn bản" })).toHaveFocus();
  });
  it("loads a valid example from file/decrypt mode and submits it to the backend", async () => {
    const process = vi.fn<DesGateway["process"]>().mockResolvedValue({
      text: "85E813540F0AB405",
      attachment: null,
    });
    render(<Harness gateway={{ kind: "api", process }} />);
    fireEvent.click(screen.getByRole("radio", { name: /Giải mã/ }));
    fireEvent.click(screen.getByRole("button", { name: "File .txt" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(screen.getByLabelText("Nội dung đầu vào DES")).toHaveValue("0123456789ABCDEF");
    expect(screen.getByLabelText("Khóa DES")).toHaveValue("133457799BBCDFF1");
    expect(screen.getByLabelText("Định dạng DES")).toHaveValue("hex");
    expect(screen.getByLabelText("Chế độ mã khối DES")).toHaveValue("ECB");
    fireEvent.click(screen.getByRole("button", { name: "Mã hóa" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Nội dung kết quả DES")).toHaveTextContent("85E813540F0AB405"),
    );
    expect(process).toHaveBeenCalledWith(
      {
        operation: "encrypt",
        inputMode: "text",
        text: "0123456789ABCDEF",
        key: "133457799BBCDFF1",
        format: "hex",
        cipherMode: "ECB",
      },
      expect.any(AbortSignal),
    );
  });

  it("shows demo labels and focuses missing input before key", async () => {
    const gateway = createDesGateway();
    render(<Harness gateway={gateway} />);
    expect(screen.getByRole("note")).toHaveTextContent("không được tính từ nội dung");
    fireEvent.click(screen.getByRole("button", { name: "Mã hóa" }));
    await waitFor(() => expect(screen.getByLabelText("Nội dung đầu vào DES")).toHaveFocus());
    fireEvent.change(screen.getByLabelText("Nội dung đầu vào DES"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Mã hóa" }));
    await waitFor(() => expect(screen.getByLabelText("Khóa DES")).toHaveFocus());
    expect(gateway.process).not.toHaveBeenCalled();
  });

  it("uses unrestricted file metadata without text preview", async () => {
    render(<Harness gateway={createDesGateway()} />);
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    const input = screen.getByLabelText("Chọn file DES");
    expect(input).not.toHaveAttribute("accept");
    fireEvent.change(input, { target: { files: [new File([], "empty.des")] } });
    expect(screen.getByText("empty.des")).toBeInTheDocument();
    expect(screen.queryByLabelText("Xem trước nội dung file")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gỡ file" }));
    expect(screen.queryByText("empty.des")).not.toBeInTheDocument();
  });

  it.each([
    { text: "", attachment: null, copy: false, download: false },
    { text: "preview", attachment: null, copy: true, download: false },
    {
      text: null,
      attachment: { blob: new Blob(["fixture"]), filename: "demo.bin" },
      copy: false,
      download: true,
    },
    {
      text: "preview",
      attachment: { blob: new Blob(["fixture"]), filename: "demo.bin" },
      copy: true,
      download: true,
    },
  ])(
    "renders independent text/attachment utilities: $copy/$download",
    async ({ text, attachment, copy, download }) => {
      render(
        <Harness
          gateway={createDesGateway({ process: vi.fn().mockResolvedValue({ text, attachment }) })}
        />,
      );
      fireEvent.change(screen.getByLabelText("Nội dung đầu vào DES"), { target: { value: "x" } });
      fireEvent.change(screen.getByLabelText("Khóa DES"), { target: { value: "not hex" } });
      fireEvent.click(screen.getByRole("button", { name: "Mã hóa" }));
      await screen.findByText("Đã nhận kết quả mô phỏng.");
      const output = within(screen.getByRole("region", { name: "Kết quả DES" }));
      expect(output.getByRole("button", { name: "Sao chép" }).matches(":disabled")).toBe(!copy);
      expect(output.getByRole("button", { name: "Tải kết quả" }).matches(":disabled")).toBe(
        !download,
      );
    },
  );
});
