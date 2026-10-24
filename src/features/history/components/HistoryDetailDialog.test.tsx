import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getHistoryContent,
  getHistoryDetail,
  HistoryApiError,
  type HistoryDetail,
} from "../services/historyApi";
import { saveBlob } from "../../../shared/utils/download";
import { HistoryDetailDialog } from "./HistoryDetailDialog";

vi.mock("../services/historyApi", async (original) => ({
  ...(await original<typeof import("../services/historyApi")>()),
  getHistoryDetail: vi.fn(),
  getHistoryContent: vi.fn(),
}));
vi.mock("../../../shared/utils/download", () => ({ saveBlob: vi.fn() }));
const detail: HistoryDetail = {
  id: 4,
  createdAt: "2026-10-24T00:00:00Z",
  cipher: "caesar",
  operation: "encrypt",
  source: "text",
  responseMode: null,
  inputLength: 5,
  outputLength: 5,
  httpStatus: 200,
  succeeded: true,
  durationMs: 2,
  contentAvailable: false,
  payload: { key: "secret", trace: "internal" },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getHistoryDetail).mockResolvedValue(detail);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => vi.restoreAllMocks());
it("shows general metadata without exposing payload or offering absent content", async () => {
  render(<HistoryDetailDialog id={4} onClose={vi.fn()} />);
  expect(await screen.findByText("Thành công")).toBeVisible();
  expect(screen.getByRole("dialog")).not.toHaveTextContent("secret");
  expect(screen.getByRole("dialog")).not.toHaveTextContent("internal");
  expect(screen.queryByRole("button", { name: "Tải nội dung" })).not.toBeInTheDocument();
  expect(getHistoryDetail).toHaveBeenCalledWith(4, expect.any(AbortSignal));
});
it("downloads available content through a separate request and preserves metadata on failure", async () => {
  vi.mocked(getHistoryDetail).mockResolvedValue({ ...detail, contentAvailable: true });
  const blob = new Blob(["hello"]);
  vi.mocked(getHistoryContent)
    .mockRejectedValueOnce(new HistoryApiError("Nội dung đã hết hạn.", 404))
    .mockResolvedValue({ blob, filename: "history-4.txt" });
  const user = userEvent.setup();
  render(<HistoryDetailDialog id={4} onClose={vi.fn()} />);
  expect(getHistoryContent).not.toHaveBeenCalled();
  await user.click(await screen.findByRole("button", { name: "Tải nội dung" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Nội dung đã hết hạn.");
  expect(screen.getByText("Thành công")).toBeVisible();
  expect(saveBlob).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Tải nội dung" }));
  await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(blob, "history-4.txt"));
  expect(getHistoryContent).toHaveBeenLastCalledWith(4, expect.any(AbortSignal));
});
it("retries unavailable detail and closes with the original trigger focused", async () => {
  vi.mocked(getHistoryDetail)
    .mockRejectedValueOnce(new HistoryApiError("Tạm thời không khả dụng.", 503))
    .mockResolvedValue(detail);
  const user = userEvent.setup();
  const onClose = vi.fn();
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const view = render(<HistoryDetailDialog id={4} onClose={onClose} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Tạm thời không khả dụng.");
  await user.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Thành công")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Đóng" }));
  expect(onClose).toHaveBeenCalled();
  view.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
it("aborts detail reads when the dialog closes", async () => {
  vi.mocked(getHistoryDetail).mockReturnValue(new Promise(() => {}));
  const view = render(<HistoryDetailDialog id={4} onClose={vi.fn()} />);
  const signal = vi.mocked(getHistoryDetail).mock.calls[0][1]!;
  view.unmount();
  expect(signal.aborted).toBe(true);
});
