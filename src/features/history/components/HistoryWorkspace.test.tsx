import { getSignatureHistory } from "../services/signatureHistoryApi";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { HistoryWorkspace } from "./HistoryWorkspace";
import { getHealthStatus, getHistory, HistoryApiError } from "../services/historyApi";

vi.mock("../services/historyApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/historyApi")>()),
  getHealthStatus: vi.fn(),
  getHistory: vi.fn(),
}));

vi.mock("../services/signatureHistoryApi", async (original) => ({
  ...(await original<typeof import("../services/signatureHistoryApi")>()),
  getSignatureHistory: vi.fn(),
}));

const statusMock = vi.mocked(getHealthStatus);
const historyMock = vi.mocked(getHistory);
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

it("merges private signatures with common rows using separate identities and independent failures", async () => {
  historyMock.mockResolvedValue({ items: [historyItem], nextCursor: null });
  vi.mocked(getSignatureHistory).mockImplementation(async (operation) => {
    if (operation === "verify") throw new HistoryApiError("Nguồn kiểm tra tạm lỗi", 503);
    return {
      items: [
        {
          ...historyItem,
          cipher: "rsa",
          operation: "sign",
          createdAt: "2026-10-12T00:00:00Z",
          valid: null,
          processingState: "completed",
        },
      ],
      nextCursor: null,
    };
  });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  const list = await screen.findByRole("list", { name: "Các thao tác gần đây" });
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
  expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Chữ ký riêng");
  expect(await screen.findByRole("alert")).toHaveTextContent("Nguồn kiểm tra tạm lỗi");
  await user.selectOptions(screen.getByLabelText("Thao tác"), "encrypt");
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(1));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("holds older rows until every unfinished source crosses their timestamp", async () => {
  historyMock.mockResolvedValueOnce({
    items: [{ ...historyItem, createdAt: "2026-10-10T00:00:00Z" }],
    nextCursor: null,
  });
  vi.mocked(getSignatureHistory).mockImplementation(async (_operation, cursor) => ({
    items: [
      {
        ...historyItem,
        cipher: "rsa",
        operation: _operation,
        id: (cursor ? 3 : 2) + (_operation === "verify" ? 10 : 0),
        createdAt: cursor ? "2026-10-09T00:00:00Z" : "2026-10-12T00:00:00Z",
        valid: null,
        processingState: "completed",
      },
    ],
    nextCursor: cursor ? null : "next",
  }));
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  const list = await screen.findByRole("list", { name: "Các thao tác gần đây" });
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
  expect(within(list).queryByText("Caesar")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Tải thêm" }));
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(5));
  expect(within(list).getAllByRole("listitem")[2]).toHaveTextContent("Lịch sử chung");
});
