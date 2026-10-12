import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { getSignatureDetail, type SignatureHistoryDetail } from "../services/signatureHistoryApi";
import { SignatureHistoryDialog } from "./SignatureHistoryDialog";

vi.mock("../services/signatureHistoryApi", async (original) => ({
  ...(await original<typeof import("../services/signatureHistoryApi")>()),
  getSignatureDetail: vi.fn(),
}));

const detail: SignatureHistoryDetail = {
  id: 1,
  createdAt: "2026-10-12T00:00:00Z",
  cipher: "rsa",
  operation: "verify",
  source: "text",
  responseMode: "content",
  inputLength: 2,
  outputLength: 4,
  httpStatus: 200,
  succeeded: true,
  durationMs: 12,
  valid: true,
  processingState: "completed",
  payload: {
    numeric_input: { m: "88" },
    signature: "1024",
    public_key: { e: "17", n: "3233", d: "secret" },
    result: { mode: "raw-integer", recoveredMessage: "88", trace: "internal" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
});

it.each([
  { valid: true, outcome: "Chữ ký hợp lệ", comparison: "m′ = m" },
  { valid: false, outcome: "Chữ ký không hợp lệ", comparison: "m′ ≠ m" },
])(
  "explains $outcome while keeping processing success separate",
  async ({ valid, outcome, comparison }) => {
    vi.mocked(getSignatureDetail).mockResolvedValue({ ...detail, valid });
    render(<SignatureHistoryDialog id={1} onClose={vi.fn()} onDeleted={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: outcome })).toBeVisible();
    expect(screen.getByText(new RegExp(comparison))).toBeVisible();
    const data = screen.getByLabelText("Dữ liệu chữ ký");
    expect(data).toHaveTextContent("Thành công");
    expect(data).toHaveTextContent("Thông điệp khôi phục m′");
    expect(data).not.toHaveTextContent("secret");
    expect(data).not.toHaveTextContent("internal");
    expect(data.querySelector("pre")).toBeNull();
  },
);

it("shows signed values and reuses the original draft without checking automatically", async () => {
  vi.mocked(getSignatureDetail).mockResolvedValue({ ...detail, operation: "sign", valid: null });
  const onReuse = vi.fn();
  const user = userEvent.setup();
  render(<SignatureHistoryDialog id={1} onClose={vi.fn()} onDeleted={vi.fn()} onReuse={onReuse} />);
  expect(await screen.findByRole("heading", { name: "Đã ký" })).toBeVisible();
  expect(screen.queryByText("Thông điệp khôi phục m′")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Dùng lại để kiểm tra chữ ký" }));
  expect(onReuse).toHaveBeenCalledWith({ m: "88", signature: "1024", e: "17", n: "3233" });
});

it("does not infer validity from missing payload or a failed operation", async () => {
  vi.mocked(getSignatureDetail).mockResolvedValue({ ...detail, succeeded: false, payload: {} });
  render(<SignatureHistoryDialog id={1} onClose={vi.fn()} onDeleted={vi.fn()} />);
  expect(await screen.findByRole("heading", { name: "Xử lý thất bại" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Chữ ký hợp lệ" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Không có dữ liệu").length).toBeGreaterThan(0);
  expect(
    screen.queryByRole("button", { name: "Dùng lại để kiểm tra chữ ký" }),
  ).not.toBeInTheDocument();
});

it("presents standard file signatures with hash and PEM labels", async () => {
  vi.mocked(getSignatureDetail).mockResolvedValue({
    ...detail,
    source: "file",
    inputLength: 4096,
    payload: {
      signature: "base64-signature",
      public_key: "-----BEGIN PUBLIC KEY-----\npublic-key\n-----END PUBLIC KEY-----",
      result: { mode: "standard", sha256: "digest" },
    },
  });
  render(<SignatureHistoryDialog id={1} onClose={vi.fn()} onDeleted={vi.fn()} />);
  await screen.findByRole("heading", { name: "Chữ ký hợp lệ" });
  const data = screen.getByLabelText("Dữ liệu chữ ký");
  expect(data).toHaveTextContent("Mã băm SHA-256");
  expect(data).toHaveTextContent("digest");
  expect(data).toHaveTextContent("4.096 byte");
  expect(data).toHaveTextContent("Khóa công khai PEM");
  expect(within(data).queryByText("Thông điệp gốc m")).not.toBeInTheDocument();
});

it("keeps a completed verification without a verdict neutral", async () => {
  vi.mocked(getSignatureDetail).mockResolvedValue({ ...detail, valid: null });
  render(<SignatureHistoryDialog id={1} onClose={vi.fn()} onDeleted={vi.fn()} />);
  expect(await screen.findByRole("heading", { name: "Chưa có kết quả kiểm tra" })).toBeVisible();
  expect(screen.getByLabelText("Kết quả")).toHaveClass("history__outcome--neutral");
  expect(screen.queryByRole("heading", { name: "Chữ ký hợp lệ" })).not.toBeInTheDocument();
});
