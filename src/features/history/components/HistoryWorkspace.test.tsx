import { getSignatureHistory } from "../services/signatureHistoryApi";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HistoryWorkspace } from "./HistoryWorkspace";
import {
  getHealthStatus,
  getHistory,
  getDhHistory,
  deleteHistoryItem,
  deleteAllHistory,
  HistoryApiError,
} from "../services/historyApi";

vi.mock("../services/historyApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/historyApi")>()),
  getHealthStatus: vi.fn(),
  getHistory: vi.fn(),
  getDhHistory: vi.fn(),
  deleteHistoryItem: vi.fn(),
  deleteAllHistory: vi.fn(),
}));

vi.mock("../services/signatureHistoryApi", async (original) => ({
  ...(await original<typeof import("../services/signatureHistoryApi")>()),
  getSignatureHistory: vi.fn(),
}));

const statusMock = vi.mocked(getHealthStatus);
const historyMock = vi.mocked(getHistory);
const dhHistoryMock = vi.mocked(getDhHistory);
const historyItem = {
  id: 1,
  createdAt: "2026-09-28T03:20:02Z",
  cipher: "caesar" as const,
  operation: "encrypt" as const,
  source: "text" as const,
  responseMode: null,
  inputLength: 5,
  outputLength: 5,
  httpStatus: 200,
  succeeded: true,
  durationMs: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  historyMock.mockReset();
  historyMock.mockResolvedValue({ items: [], nextCursor: null });
  dhHistoryMock.mockReset();
  dhHistoryMock.mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(getSignatureHistory).mockResolvedValue({ items: [], nextCursor: null });
  statusMock.mockResolvedValue({ database: "ok", history: "enabled" });
});

it("shows metadata and loads a second page using the opaque cursor", async () => {
  historyMock
    .mockResolvedValueOnce({
      items: [
        {
          id: 2,
          createdAt: "2026-09-28T03:20:02Z",
          cipher: "playfair",
          operation: "decrypt",
          source: "file",
          responseMode: "content",
          inputLength: 4,
          outputLength: 3,
          httpStatus: 200,
          succeeded: true,
          durationMs: 8,
        },
      ],
      nextCursor: "opaque+/=",
    })
    .mockResolvedValueOnce({
      items: [
        {
          id: 1,
          createdAt: "2026-09-28T03:19:02Z",
          cipher: "caesar",
          operation: null,
          source: "file",
          responseMode: null,
          inputLength: null,
          outputLength: null,
          httpStatus: 422,
          succeeded: false,
          durationMs: 2,
        },
      ],
      nextCursor: null,
    });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);

  const list = await screen.findByRole("list", { name: "Các thao tác gần đây" });
  expect(within(list).getByText("Xem trước file")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Tải thêm" }));
  expect(await within(list).findByText("Lỗi 422")).toBeInTheDocument();
  expect(within(list).getByText("Chưa xác định")).toBeInTheDocument();
  expect(historyMock).toHaveBeenLastCalledWith(
    { cipher: undefined, operation: undefined, cursor: "opaque+/=" },
    expect.any(AbortSignal),
  );
  expect(screen.queryByRole("button", { name: "Tải thêm" })).not.toBeInTheDocument();
});

it("does not read history when the server history gate is disabled", async () => {
  statusMock.mockResolvedValue({ database: "ok", history: "disabled" });
  render(<HistoryWorkspace />);
  expect(await screen.findByText(/Lịch sử chưa được bật trên máy chủ/)).toBeInTheDocument();
  expect(historyMock).not.toHaveBeenCalled();
});

it("does not read history when the database is unavailable", async () => {
  statusMock.mockResolvedValue({ database: "unavailable", history: "enabled" });
  render(<HistoryWorkspace />);
  expect(await screen.findByText(/Cơ sở dữ liệu tạm thời không khả dụng/)).toBeInTheDocument();
  expect(historyMock).not.toHaveBeenCalled();
});

it("does not read history when the database is disabled even if history is enabled", async () => {
  statusMock.mockResolvedValue({ database: "disabled", history: "enabled" });
  render(<HistoryWorkspace />);
  expect(await screen.findByText(/Lịch sử chưa được bật trên máy chủ/)).toBeInTheDocument();
  expect(historyMock).not.toHaveBeenCalled();
});

it("shows a history 503 as unavailable and retries through health", async () => {
  historyMock
    .mockRejectedValueOnce(new HistoryApiError("Lịch sử tạm thời không khả dụng.", 503))
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Lịch sử tạm thời không khả dụng.");
  expect(screen.queryByText("Chưa có thao tác nào khớp bộ lọc.")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Làm mới lịch sử" }));
  expect(await screen.findByText("Chưa có thao tác nào khớp bộ lọc.")).toBeInTheDocument();
  expect(statusMock).toHaveBeenCalledTimes(2);
});

it("keeps loaded rows and the cursor when pagination returns 503, allowing retry", async () => {
  historyMock
    .mockResolvedValueOnce({ items: [historyItem], nextCursor: "retry-cursor" })
    .mockRejectedValueOnce(new HistoryApiError("Lịch sử tạm thời không khả dụng.", 503))
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await user.click(await screen.findByRole("button", { name: "Tải thêm" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Lịch sử tạm thời không khả dụng.");
  expect(screen.getByRole("list", { name: "Các thao tác gần đây" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Tải thêm" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Tải thêm" })).not.toBeInTheDocument(),
  );
  expect(historyMock).toHaveBeenLastCalledWith(
    { cipher: undefined, operation: undefined, cursor: "retry-cursor" },
    expect.any(AbortSignal),
  );
});

it("shows the server message and clears history when the gate closes after health", async () => {
  historyMock.mockRejectedValue(
    new HistoryApiError("Lịch sử không được bật trên máy chủ này.", 404),
  );
  render(<HistoryWorkspace />);
  expect(await screen.findByText(/Lịch sử không được bật trên máy chủ này/)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Các thao tác gần đây" })).not.toBeInTheDocument();
});

it("clears loaded rows if the server disables history during pagination", async () => {
  historyMock
    .mockResolvedValueOnce({
      items: [
        {
          id: 1,
          createdAt: "2026-09-28T03:20:02Z",
          cipher: "caesar",
          operation: "encrypt",
          source: "text",
          responseMode: null,
          inputLength: 5,
          outputLength: 5,
          httpStatus: 200,
          succeeded: true,
          durationMs: 1,
        },
      ],
      nextCursor: "next",
    })
    .mockRejectedValueOnce(new HistoryApiError("Lịch sử không được bật trên máy chủ này.", 404));
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await user.click(await screen.findByRole("button", { name: "Tải thêm" }));
  expect(await screen.findByText(/Lịch sử không được bật trên máy chủ này/)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Các thao tác gần đây" })).not.toBeInTheDocument();
});

it("does not misclassify a missing health endpoint as a disabled history gate", async () => {
  statusMock.mockRejectedValue(new HistoryApiError("Không tìm thấy endpoint.", 404));
  render(<HistoryWorkspace />);
  expect(await screen.findByText(/Không tìm thấy endpoint/)).toHaveAttribute("role", "alert");
  expect(historyMock).not.toHaveBeenCalled();
});

it.each([
  ["Thuật toán", "affine", { cipher: "affine", operation: undefined }],
  ["Thao tác", "decrypt", { cipher: undefined, operation: "decrypt" }],
])("clears rows and the old cursor when %s changes", async (label, value, query) => {
  historyMock
    .mockResolvedValueOnce({ items: [historyItem], nextCursor: "old-cursor" })
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await screen.findByRole("button", { name: "Tải thêm" });
  await user.selectOptions(screen.getByLabelText(label), value);
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  expect(historyMock).toHaveBeenLastCalledWith(query, expect.any(AbortSignal));
  expect(screen.queryByRole("list", { name: "Các thao tác gần đây" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tải thêm" })).not.toBeInTheDocument();
});

it.each([
  ["caesar", ["", "encrypt", "decrypt"]],
  ["vigenere", ["", "encrypt", "decrypt"]],
  ["playfair", ["", "encrypt", "decrypt"]],
  ["affine", ["", "encrypt", "decrypt"]],
  ["columnar", ["", "encrypt", "decrypt"]],
  ["hill", ["", "encrypt", "decrypt"]],
  ["des", ["", "encrypt", "decrypt"]],
  ["rsa", ["", "encrypt", "decrypt", "sign", "verify"]],
  [
    "diffie-hellman",
    [
      "",
      "encrypt",
      "decrypt",
      "validate_params",
      "generate_params",
      "generate_keypair",
      "derive_shared_secret",
      "exchange",
    ],
  ],
] as const)("only offers operations supported by %s", async (cipher, expected) => {
  for (const flag of [
    "VITE_ENABLE_HILL",
    "VITE_ENABLE_DES",
    "VITE_ENABLE_RSA",
    "VITE_ENABLE_DIFFIE_HELLMAN",
  ])
    vi.stubEnv(flag, "true");
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  await user.selectOptions(screen.getByLabelText("Thuật toán"), cipher);
  const options = within(screen.getByLabelText("Thao tác")).getAllByRole("option");
  expect(options.map((option) => option.getAttribute("value"))).toEqual(expected);
});

it("resets incompatible operations on cipher changes and retains compatible ones", async () => {
  vi.stubEnv("VITE_ENABLE_RSA", "true");
  vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  const algorithm = screen.getByLabelText("Thuật toán");
  const operation = screen.getByLabelText("Thao tác");
  await user.selectOptions(operation, "exchange");
  await user.selectOptions(algorithm, "rsa");
  expect(operation).toHaveValue("");
  await waitFor(() =>
    expect(historyMock).toHaveBeenLastCalledWith(
      { cipher: "rsa", operation: undefined },
      expect.any(AbortSignal),
    ),
  );
  await user.selectOptions(operation, "sign");
  await user.selectOptions(algorithm, "diffie-hellman");
  expect(operation).toHaveValue("");
  await waitFor(() =>
    expect(historyMock).toHaveBeenLastCalledWith(
      { cipher: "diffie-hellman", operation: undefined },
      expect.any(AbortSignal),
    ),
  );
  await user.selectOptions(operation, "encrypt");
  await user.selectOptions(algorithm, "caesar");
  expect(operation).toHaveValue("encrypt");
  await user.selectOptions(algorithm, "");
  expect(within(operation).getByRole("option", { name: "Trao đổi khóa" })).toBeVisible();
  expect(within(operation).getByRole("option", { name: /^Ký$/ })).toBeVisible();
});

afterEach(() => vi.unstubAllEnvs());

it("reads signatures and DH once from the unified source without extra streams", async () => {
  historyMock.mockResolvedValue({
    items: [
      historyItem,
      { ...historyItem, id: 2, cipher: "rsa", operation: "sign", valid: null },
      { ...historyItem, id: 3, cipher: "diffie-hellman", operation: "exchange" },
    ],
    nextCursor: null,
  });
  render(<HistoryWorkspace />);
  const list = await screen.findByRole("list", { name: "Các thao tác gần đây" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(within(list).getAllByText("Chữ ký riêng")).toHaveLength(1);
  expect(historyMock).toHaveBeenCalledTimes(1);
  expect(dhHistoryMock).not.toHaveBeenCalled();
  expect(vi.mocked(getSignatureHistory)).not.toHaveBeenCalled();
});

it("filters signatures through the shared source", async () => {
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  await user.selectOptions(screen.getByLabelText("Thao tác"), "verify");
  await waitFor(() =>
    expect(historyMock).toHaveBeenLastCalledWith(
      { cipher: undefined, operation: "verify" },
      expect.any(AbortSignal),
    ),
  );
  expect(vi.mocked(getSignatureHistory)).not.toHaveBeenCalled();
});

it("deduplicates a repeated id while keeping server cursor order", async () => {
  historyMock
    .mockResolvedValueOnce({ items: [historyItem], nextCursor: "next" })
    .mockResolvedValueOnce({
      items: [historyItem, { ...historyItem, id: 2, cipher: "rsa", operation: "sign" }],
      nextCursor: null,
    });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await user.click(await screen.findByRole("button", { name: "Tải thêm" }));
  const rows = within(screen.getByRole("list")).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("Caesar");
  expect(rows[1]).toHaveTextContent("RSA");
});

it("confirms item deletion and refreshes history only after success", async () => {
  historyMock
    .mockResolvedValueOnce({ items: [historyItem], nextCursor: null })
    .mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(deleteHistoryItem).mockResolvedValue();
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await user.click(await screen.findByRole("button", { name: "Xóa bản ghi" }));
  expect(deleteHistoryItem).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  expect(deleteHistoryItem).toHaveBeenCalledWith(1);
});

it("explains bulk deletion covers records outside filters and preserves rows on failure", async () => {
  historyMock.mockResolvedValue({ items: [historyItem], nextCursor: null });
  vi.mocked(deleteAllHistory)
    .mockRejectedValueOnce(new HistoryApiError("Không thể xóa lúc này.", 503))
    .mockResolvedValue();
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await user.click(await screen.findByRole("button", { name: "Xóa toàn bộ lịch sử" }));
  expect(screen.getByText(/kể cả các bản ghi ngoài bộ lọc/)).toBeVisible();
  expect(deleteAllHistory).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không thể xóa lúc này.");
  expect(screen.getByRole("list")).toBeVisible();
  historyMock.mockResolvedValue({ items: [], nextCursor: null });
  await user.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  expect(deleteAllHistory).toHaveBeenCalledTimes(2);
});

it("cancels deletion without making a request", async () => {
  historyMock.mockResolvedValue({ items: [historyItem], nextCursor: null });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await user.click(await screen.findByRole("button", { name: "Xóa bản ghi" }));
  await user.click(screen.getByRole("button", { name: "Hủy" }));
  expect(screen.queryByRole("group", { name: "Xác nhận xóa" })).not.toBeInTheDocument();
  expect(deleteHistoryItem).not.toHaveBeenCalled();
});
