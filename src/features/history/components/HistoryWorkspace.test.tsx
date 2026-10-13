import { getSignatureHistory } from "../services/signatureHistoryApi";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HistoryWorkspace } from "./HistoryWorkspace";
import { getHealthStatus, getHistory, getDhHistory, HistoryApiError } from "../services/historyApi";

vi.mock("../services/historyApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/historyApi")>()),
  getHealthStatus: vi.fn(),
  getHistory: vi.fn(),
  getDhHistory: vi.fn(),
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

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["validate_params", "Kiểm tra tham số"],
  ["generate_params", "Sinh tham số"],
  ["generate_keypair", "Sinh cặp khóa"],
  ["derive_shared_secret", "Tính bí mật chung"],
  ["exchange", "Trao đổi khóa"],
] as const)("filters and displays DH %s with metadata only", async (operation, label) => {
  vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
  dhHistoryMock.mockResolvedValue({ items: [], nextCursor: null });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  await user.selectOptions(screen.getByLabelText("Thuật toán"), "diffie-hellman");
  await waitFor(() =>
    expect(dhHistoryMock).toHaveBeenLastCalledWith(
      { cipher: "diffie-hellman", operation: undefined },
      expect.any(AbortSignal),
    ),
  );
  vi.mocked(getSignatureHistory).mockClear();
  dhHistoryMock
    .mockResolvedValueOnce({
      items: [
        {
          ...historyItem,
          cipher: "diffie-hellman",
          operation,
          inputLength: null,
          outputLength: null,
        },
      ],
      nextCursor: "dh-next",
    })
    .mockResolvedValueOnce({
      items: [
        {
          ...historyItem,
          id: 2,
          cipher: "diffie-hellman",
          operation,
          inputLength: null,
          outputLength: null,
          succeeded: false,
          httpStatus: 422,
        },
      ],
      nextCursor: null,
    });
  await user.selectOptions(screen.getByLabelText("Thao tác"), operation);
  const list = await screen.findByRole("list", { name: "Các thao tác gần đây" });
  expect(within(list).getByText("Diffie–Hellman")).toBeVisible();
  expect(within(list).getByText(label)).toBeVisible();
  expect(within(list).getByText("Thông tin thao tác")).toBeVisible();
  expect(within(list).queryByText(/Đầu vào:|Đầu ra:|Văn bản/)).not.toBeInTheDocument();
  expect(within(list).queryByRole("button", { name: "Xem chi tiết" })).not.toBeInTheDocument();
  expect(dhHistoryMock).toHaveBeenLastCalledWith(
    { cipher: "diffie-hellman", operation },
    expect.any(AbortSignal),
  );
  await user.click(screen.getByRole("button", { name: "Tải thêm" }));
  expect(await within(list).findByText("Lỗi 422")).toBeVisible();
  expect(dhHistoryMock).toHaveBeenLastCalledWith(
    { cipher: "diffie-hellman", operation, cursor: "dh-next" },
    expect.any(AbortSignal),
  );
  expect(vi.mocked(getSignatureHistory)).not.toHaveBeenCalled();
});

it("does not load RSA signature streams for a DH operation without a cipher filter", async () => {
  vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
  dhHistoryMock.mockResolvedValue({ items: [], nextCursor: null });
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  await screen.findByText("Chưa có thao tác nào khớp bộ lọc.");
  vi.mocked(getSignatureHistory).mockClear();
  await user.selectOptions(screen.getByLabelText("Thao tác"), "exchange");
  await waitFor(() =>
    expect(dhHistoryMock).toHaveBeenLastCalledWith(
      { cipher: "diffie-hellman", operation: "exchange" },
      expect.any(AbortSignal),
    ),
  );
  expect(vi.mocked(getSignatureHistory)).not.toHaveBeenCalled();
});

it("merges DH with common history using independent ids and preserves common rows on DH failure", async () => {
  vi.stubEnv("VITE_ENABLE_DIFFIE_HELLMAN", "true");
  historyMock.mockResolvedValue({ items: [historyItem], nextCursor: null });
  dhHistoryMock
    .mockResolvedValueOnce({
      items: [
        {
          ...historyItem,
          cipher: "diffie-hellman",
          operation: "exchange",
          inputLength: null,
          outputLength: null,
        },
      ],
      nextCursor: null,
    })
    .mockRejectedValueOnce(new HistoryApiError("BE DH chưa hỗ trợ thao tác mới.", 422));
  const user = userEvent.setup();
  render(<HistoryWorkspace />);
  const list = await screen.findByRole("list", { name: "Các thao tác gần đây" });
  await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
  await user.click(screen.getByRole("button", { name: "Làm mới lịch sử" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Lịch sử Diffie–Hellman: BE DH chưa hỗ trợ thao tác mới.",
  );
  expect(within(screen.getByRole("list")).getByText("Caesar")).toBeVisible();
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
    expect(dhHistoryMock).toHaveBeenLastCalledWith(
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
