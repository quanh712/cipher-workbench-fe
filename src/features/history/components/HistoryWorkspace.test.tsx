import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { HistoryWorkspace } from "./HistoryWorkspace";
import { getHealthStatus, getHistory, HistoryApiError } from "../services/historyApi";

vi.mock("../services/historyApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/historyApi")>()),
  getHealthStatus: vi.fn(),
  getHistory: vi.fn(),
}));

const statusMock = vi.mocked(getHealthStatus);
const historyMock = vi.mocked(getHistory);

beforeEach(() => {
  vi.clearAllMocks();
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
  expect(await screen.findByText("Lịch sử chưa được bật trên máy chủ.")).toBeInTheDocument();
  expect(historyMock).not.toHaveBeenCalled();
});

it("does not read history when the database is unavailable", async () => {
  statusMock.mockResolvedValue({ database: "unavailable", history: "enabled" });
  render(<HistoryWorkspace />);
  expect(
    await screen.findByText("Cơ sở dữ liệu tạm thời không khả dụng. Hãy thử lại sau."),
  ).toBeInTheDocument();
  expect(historyMock).not.toHaveBeenCalled();
});

it("shows the server message and clears history when the gate closes after health", async () => {
  historyMock.mockRejectedValue(
    new HistoryApiError("Lịch sử không được bật trên máy chủ này.", 404),
  );
  render(<HistoryWorkspace />);
  expect(await screen.findByText("Lịch sử không được bật trên máy chủ này.")).toBeInTheDocument();
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
  expect(await screen.findByText("Lịch sử không được bật trên máy chủ này.")).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Các thao tác gần đây" })).not.toBeInTheDocument();
});

it("does not misclassify a missing health endpoint as a disabled history gate", async () => {
  statusMock.mockRejectedValue(new HistoryApiError("Không tìm thấy endpoint.", 404));
  render(<HistoryWorkspace />);
  expect(await screen.findByText("Không tìm thấy endpoint.")).toHaveAttribute("role", "alert");
  expect(historyMock).not.toHaveBeenCalled();
});

it("starts at the first page when a filter changes", async () => {
  historyMock.mockResolvedValue({ items: [], nextCursor: null });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  await user.selectOptions(screen.getByLabelText("Thuật toán"), "affine");
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  expect(historyMock).toHaveBeenLastCalledWith(
    { cipher: "affine", operation: undefined },
    expect.any(AbortSignal),
  );
});
