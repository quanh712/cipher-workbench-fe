import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StandardRsaSignaturePanel } from "./StandardRsaSignaturePanel";

function respond(operation: "sign" | "verify", source = "text", valid = true) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        success: true,
        result: {
          mode: "standard",
          source,
          ...(operation === "sign" ? { signature: "c2ln", publicKeyPem: "PUBLIC PEM" } : { valid }),
          contentBytes: 3,
          sha256: "a".repeat(64),
          algorithm: {
            scheme: "RSASSA-PSS",
            hash: "SHA-256",
            mgf: "MGF1-SHA-256",
            saltLength: 32,
            signatureEncoding: "base64",
          },
        },
        history: { saved: false, id: null, reason: "disabled" },
      }),
    ),
  );
}

describe("standard RSA signature form", () => {
  it.each(["source", "clear", "inactive"] as const)(
    "removes stale native file selection after %s reset",
    (reset) => {
      const view = render(<StandardRsaSignaturePanel active />);
      fireEvent.change(screen.getByLabelText("Nguồn nội dung chữ ký"), {
        target: { value: "file" },
      });
      const originalPicker = screen.getByLabelText("Tệp nội dung .txt") as HTMLInputElement;
      fireEvent.change(originalPicker, { target: { files: [new File(["abc"], "original.txt")] } });
      fireEvent.change(screen.getByLabelText("Private key PEM"), {
        target: { value: "PRIVATE PEM" },
      });
      expect(screen.getByText("Tệp đã chọn: original.txt")).toBeVisible();
      expect(screen.getByRole("button", { name: "Ký nội dung" })).toBeEnabled();
      if (reset === "source")
        fireEvent.change(screen.getByLabelText("Nguồn nội dung chữ ký"), {
          target: { value: "text" },
        });
      else if (reset === "clear")
        fireEvent.click(screen.getByRole("button", { name: "Xóa nội dung và khóa" }));
      else {
        view.rerender(<StandardRsaSignaturePanel active={false} />);
        view.rerender(<StandardRsaSignaturePanel active />);
      }
      fireEvent.change(screen.getByLabelText("Nguồn nội dung chữ ký"), {
        target: { value: "file" },
      });
      const picker = screen.getByLabelText("Tệp nội dung .txt") as HTMLInputElement;
      expect(picker).not.toBe(originalPicker);
      expect(picker.files).toHaveLength(0);
      expect(screen.queryByText("Tệp đã chọn: original.txt")).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Private key PEM"), {
        target: { value: "PRIVATE PEM" },
      });
      expect(screen.getByRole("button", { name: "Ký nội dung" })).toBeDisabled();
    },
  );
  it("signs text with PEM, clears secrets and verifies the returned public signature", async () => {
    render(<StandardRsaSignaturePanel active />);
    expect(screen.getByRole("button", { name: "Ký nội dung" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nội dung ký / kiểm tra"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("Private key PEM"), {
      target: { value: "PRIVATE PEM" },
    });
    fireEvent.change(screen.getByLabelText("Passphrase (nếu khóa được mã hóa)"), {
      target: { value: "secret" },
    });
    respond("sign");
    fireEvent.click(screen.getByRole("button", { name: "Ký nội dung" }));
    expect(await screen.findByText("Đã ký nội dung.")).toBeVisible();
    expect(screen.getByLabelText("Private key PEM")).toHaveValue("");
    expect(screen.getByLabelText("Passphrase (nếu khóa được mã hóa)")).toHaveValue("");
    expect(screen.getByText("Kết quả đã xử lý; lưu lịch sử đang tắt.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Dùng kết quả để kiểm tra" }));
    expect(screen.getByLabelText("Public key PEM")).toHaveValue("PUBLIC PEM");
    expect(screen.getByLabelText("Chữ ký base64")).toHaveValue("c2ln");
    respond("verify", "text", false);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra nội dung" }));
    expect(
      await screen.findByText(
        "Chữ ký nội dung không hợp lệ: nội dung hoặc khóa công khai không khớp.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/Không thể xử lý chữ ký/)).not.toBeInTheDocument();
  });
  it("supports file verify and clears drafts when leaving the signature workspace", async () => {
    const view = render(<StandardRsaSignaturePanel active />);
    fireEvent.change(screen.getByLabelText("Thao tác chữ ký văn bản"), {
      target: { value: "verify" },
    });
    fireEvent.change(screen.getByLabelText("Nguồn nội dung chữ ký"), { target: { value: "file" } });
    fireEvent.change(screen.getByLabelText("Tệp nội dung .txt"), {
      target: { files: [new File(["abc"], "example.txt")] },
    });
    fireEvent.change(screen.getByLabelText("Public key PEM"), { target: { value: "PUBLIC PEM" } });
    fireEvent.change(screen.getByLabelText("Chữ ký base64"), { target: { value: "c2ln" } });
    respond("verify", "file");
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra nội dung" }));
    expect(await screen.findByText("Chữ ký nội dung hợp lệ.")).toBeVisible();
    view.rerender(<StandardRsaSignaturePanel active={false} />);
    expect(screen.queryByText("Chữ ký nội dung hợp lệ.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Private key PEM")).toHaveValue("");
  });
  it("shows safe backend errors and resets fields explicitly", async () => {
    render(<StandardRsaSignaturePanel active />);
    fireEvent.change(screen.getByLabelText("Nội dung ký / kiểm tra"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("Private key PEM"), { target: { value: "BAD PEM" } });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          code: "INVALID_PRIVATE_KEY",
          field: "privateKeyPem",
          message: "Private key RSA hoặc passphrase không hợp lệ.",
        }),
        { status: 422 },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ký nội dung" }));
    expect(await screen.findByText(/\(INVALID_PRIVATE_KEY\)/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Xóa nội dung và khóa" }));
    expect(screen.getByLabelText("Nội dung ký / kiểm tra")).toHaveValue("");
    expect(screen.getByLabelText("Private key PEM")).toHaveValue("");
    expect(screen.queryByText(/\(INVALID_PRIVATE_KEY\)/)).not.toBeInTheDocument();
  });
});
