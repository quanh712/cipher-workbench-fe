import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useHillCipher } from "../hooks/useHillCipher";
import { HillApiError } from "../services/hillApi";
import type { HillGateway } from "../services/hillGateway";
import { createHillGateway, exampleKey, exampleKey3 } from "../test/createHillGateway";
import { HillWorkspace } from "./HillWorkspace";

function Harness({ gateway }: { gateway: HillGateway }) {
  const cipher = useHillCipher(gateway, true);
  return <HillWorkspace cipher={cipher} />;
}

function renderWithExampleKey(gateway: HillGateway) {
  const view = render(<Harness gateway={gateway} />);
  for (const [label, value] of [
    ["Khóa hàng 1 cột 1", "3"],
    ["Khóa hàng 1 cột 2", "3"],
    ["Khóa hàng 2 cột 1", "2"],
    ["Khóa hàng 2 cột 2", "5"],
  ])
    fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
  return view;
}

describe("Hill workspace", () => {
  it("starts and resets empty, with a sample only after Tạo ví dụ", async () => {
    const gateway = createHillGateway();
    render(<Harness gateway={gateway} />);
    for (const input of screen.getAllByRole("textbox", { name: /Khóa hàng/ }))
      expect(input).toHaveValue("");
    expect(gateway.analyze).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(screen.getByRole("textbox", { name: "Văn bản đầu vào" })).toHaveValue("HELP");
    expect(screen.getByRole("textbox", { name: "Khóa hàng 1 cột 1" })).toHaveValue("3");
    await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    for (const input of screen.getAllByRole("textbox", { name: /Khóa hàng/ }))
      expect(input).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Văn bản đầu vào" })).toHaveValue("");
  });

  it("filters backend padding for display and copy without processing again", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    const gateway = createHillGateway({
      process: vi.fn().mockResolvedValue({
        success: true,
        result: "HELLO!X",
        key: exampleKey,
        warnings: [],
        blocks: [
          { input: [3, 15], output: [7, 4] },
          { input: [3, 10], output: [11, 11] },
          { input: [10, 1], output: [14, 23] },
        ],
        padding: { count: 1, positions: [5], filtered: "HELLO!" },
      }),
    });
    renderWithExampleKey(gateway);
    await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
    await user.type(screen.getByRole("textbox", { name: "Văn bản đầu vào" }), "DPDKK!B");
    await waitFor(() => expect(screen.getByRole("button", { name: "Giải mã" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Giải mã" }));
    await waitFor(() =>
      expect(
        Array.from(screen.getByLabelText("Kết quả").querySelectorAll(".character"))
          .map((n) => n.textContent)
          .join(""),
      ).toBe("HELLO!"),
    );
    const output = within(screen.getByRole("region", { name: "Bản rõ" }));
    await user.click(output.getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenLastCalledWith("HELLO!");
    await user.click(screen.getByRole("checkbox", { name: /Tự động lọc/ }));
    expect(
      Array.from(screen.getByLabelText("Kết quả").querySelectorAll(".character"))
        .map((n) => n.textContent)
        .join(""),
    ).toBe("HELLO!X");
    await user.click(output.getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenLastCalledWith("HELLO!X");
    expect(screen.getByText("Xem bản thô và bản đã lọc")).not.toBeVisible();
    await user.click(output.getByRole("tab", { name: "Phân tích" }));
    expect(screen.getByRole("checkbox", { name: /Tự động lọc/ })).toBeVisible();
    await user.click(screen.getByText("Xem bản thô và bản đã lọc"));
    const analysis = screen.getByRole("region", { name: "Phân tích khóa" });
    expect(within(analysis).getByText("Bản đã lọc", { exact: true })).toBeVisible();
    expect(analysis.querySelector("mark")).toHaveTextContent("X");
    expect(within(analysis).getByText(/khối 3, ô 2/)).toBeVisible();
    expect(gateway.process).toHaveBeenCalledTimes(1);
  });
  it("runs HELP through the gateway and shows backend blocks, key facts, copy and steps", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    const gateway = createHillGateway();
    renderWithExampleKey(gateway);
    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(screen.getByRole("textbox", { name: "Văn bản đầu vào" })).toHaveValue("HELP");
    await waitFor(() => expect(screen.getByRole("button", { name: "Mã hóa" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    expect(gateway.process).toHaveBeenCalledWith("encrypt", {
      text: "HELP",
      key: [
        [3, 3],
        [2, 5],
      ],
      options: { stripDiacritics: false, padChar: "X" },
    });
    const result = screen.getByRole("region", { name: "Bản mã" });
    expect(within(result).getByLabelText(/Khối 1: 7, 4 · K → 3, 15/)).toHaveTextContent("DP");
    expect(within(result).getByLabelText(/Khối 2: 11, 15 · K → 11, 4/)).toHaveTextContent("LE");
    expect(within(result).getByLabelText(/Khối 1: 7, 4 · K → 3, 15/)).toHaveAttribute(
      "aria-label",
      expect.stringContaining("K=[3, 3] [2, 5]"),
    );
    await user.click(within(result).getByRole("tab", { name: "Phân tích" }));
    const analysis = screen.getByRole("region", { name: "Phân tích khóa" });
    await user.click(within(analysis).getByText("Xem từng bước (2 khối)"));
    expect(within(analysis).getByText(/\[7, 4\] · K = \[3, 15\]/)).toBeVisible();
    expect(screen.getByText("ƯCLN(det K, 26)").parentElement).toHaveTextContent("1");
    await user.click(within(result).getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenCalledWith("DPLE");
  });

  it("shows format and backend key errors at the matrix and blocks submit", async () => {
    const user = userEvent.setup();
    const gateway = createHillGateway({
      analyze: vi
        .fn()
        .mockResolvedValueOnce({ success: true, result: exampleKey, warnings: [] })
        .mockRejectedValue(
          new HillApiError(
            {
              code: "E04",
              message: "Khóa không khả nghịch: det K mod 26 = 2.",
              details: { det: 2, gcd: 2 },
            },
            422,
          ),
        ),
    });
    renderWithExampleKey(gateway);
    await waitFor(() => expect(gateway.analyze).toHaveBeenCalledTimes(1));
    await user.type(screen.getByRole("textbox", { name: "Văn bản đầu vào" }), "HELP");
    const cell = screen.getByRole("textbox", { name: "Khóa hàng 1 cột 1" });
    await user.clear(cell);
    await user.type(cell, "a");
    expect(screen.getByText("Ô hàng 1 cột 1 phải là số nguyên.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeDisabled();
    await user.clear(cell);
    await user.type(cell, "2");
    expect(await screen.findByText(/Khóa không khả nghịch: det K mod 26 = 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeDisabled();
  });

  it("validates keyword, uploads text, and keeps draft after a rejected file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithExampleKey(createHillGateway());
    await user.click(screen.getByRole("button", { name: "Từ khóa" }));
    expect(screen.queryByLabelText("Cấp ma trận")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Lưới ma trận khóa")).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Từ khóa/ }), "HIL");
    expect(screen.getByText("Từ khóa cần đúng 4 chữ cái, hiện có 3.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Từ khóa/ }), "L");
    expect(screen.queryByRole("textbox", { name: "Khóa hàng 1 cột 1" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ma trận" }));
    expect(screen.getByRole("textbox", { name: "Khóa hàng 1 cột 1" })).toHaveValue("7");
    await user.click(screen.getByRole("button", { name: "File .txt" }));
    const fileInput = screen.getByLabelText("Chọn file văn bản");
    await user.upload(fileInput, new File(["HELP"], "text.txt"));
    expect(await screen.findByLabelText("Xem trước nội dung file")).toHaveTextContent("HELP");
    await user.upload(fileInput, new File(["oops"], "bad.pdf"));
    expect(screen.getByText("Chỉ chấp nhận file .txt.")).toBeInTheDocument();
    expect(screen.getByLabelText("Xem trước nội dung file")).toHaveTextContent("HELP");
    expect(screen.getByText("text.txt")).toBeInTheDocument();
  });

  it("uses Backend random key on size change and retries W02 with stripDiacritics", async () => {
    const user = userEvent.setup();
    const process = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        result: "DPLE",
        key: exampleKey,
        blocks: [
          { input: [7, 4], output: [3, 15] },
          { input: [11, 15], output: [11, 4] },
        ],
        warnings: [
          { code: "W02", message: "1 chữ có dấu được giữ nguyên.", details: { count: 1 } },
        ],
      })
      .mockResolvedValue({
        success: true,
        result: "DPLE",
        key: exampleKey,
        blocks: [
          { input: [7, 4], output: [3, 15] },
          { input: [11, 15], output: [11, 4] },
        ],
        warnings: [],
      });
    const gateway = createHillGateway({
      process,
      random: vi.fn().mockResolvedValue({
        success: true,
        result: exampleKey3,
        warnings: [],
      }),
    });
    renderWithExampleKey(gateway);
    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mã hóa" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    await user.click(await screen.findByRole("button", { name: "Bỏ dấu và thử lại" }));
    await waitFor(() => expect(process).toHaveBeenCalledTimes(2));
    expect(process.mock.calls[1][1].options.stripDiacritics).toBe(true);
    await user.selectOptions(screen.getByLabelText("Cấp ma trận"), "3");
    await waitFor(() => expect(gateway.random).toHaveBeenCalledWith(3, expect.any(AbortSignal)));
    expect(screen.getAllByRole("textbox", { name: /Khóa hàng/ })).toHaveLength(9);
  });

  it("keeps input after invalid UTF-8 and puts E05 in the result panel", async () => {
    const user = userEvent.setup();
    const gateway = createHillGateway({
      process: vi.fn().mockRejectedValue(
        new HillApiError(
          {
            code: "E05",
            message:
              "Bản mã có 3 chữ cái, không chia hết cho m = 2. Kiểm tra lại bản mã hoặc cấp khóa.",
            details: { n: 3, m: 2 },
          },
          422,
        ),
      ),
    });
    renderWithExampleKey(gateway);
    await user.type(screen.getByRole("textbox", { name: "Văn bản đầu vào" }), "DPL");
    await user.click(screen.getByRole("button", { name: "File .txt" }));
    const fileInput = screen.getByLabelText("Chọn file văn bản");
    await user.upload(fileInput, new File([new Uint8Array([0xff])], "bad.txt"));
    expect(
      await screen.findByText("Không đọc được file. Lưu lại file với mã hóa UTF-8."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Văn bản" }));
    expect(screen.getByRole("textbox", { name: "Văn bản đầu vào" })).toHaveValue("DPL");
    await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Giải mã" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Giải mã" }));
    const resultPanel = screen.getByRole("region", { name: "Bản rõ" });
    expect(
      await within(resultPanel).findByText(
        "Bản mã có 3 chữ cái, không chia hết cho m = 2. Kiểm tra lại bản mã hoặc cấp khóa.",
      ),
    ).toBeInTheDocument();
  });

  it("shows backend padding warning and retries a temporary process failure", async () => {
    const user = userEvent.setup();
    const gateway = createHillGateway({
      process: vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({
          success: true,
          result: "DPDKKB",
          key: exampleKey,
          blocks: [
            { input: [7, 4], output: [3, 15] },
            { input: [11, 11], output: [3, 10] },
            { input: [14, 23], output: [10, 1] },
          ],
          warnings: [
            {
              code: "W01",
              message: "Đã thêm 1 ký tự X vào cuối để đủ khối 2 chữ.",
              details: { count: 1, char: "X", m: 2 },
            },
          ],
        }),
    });
    renderWithExampleKey(gateway);
    await user.type(screen.getByRole("textbox", { name: "Văn bản đầu vào" }), "HELLO");
    await waitFor(() => expect(screen.getByRole("button", { name: "Mã hóa" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    const result = screen.getByRole("region", { name: "Bản mã" });
    expect(
      await within(result).findByText("Không kết nối được máy chủ. Thử lại."),
    ).toBeInTheDocument();
    await user.click(within(result).getByRole("button", { name: "Thử lại" }));
    expect(
      await within(result).findByText("Đã thêm 1 ký tự X vào cuối để đủ khối 2 chữ."),
    ).toBeInTheDocument();
    expect(within(result).getAllByLabelText(/Khối \d:/)).toHaveLength(3);
    expect(gateway.process).toHaveBeenCalledTimes(2);
  });

  it("retries random key generation after a network error on size change", async () => {
    const user = userEvent.setup();
    const gateway = createHillGateway({
      random: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
        success: true,
        result: exampleKey3,
        warnings: [],
      }),
    });
    renderWithExampleKey(gateway);
    await user.selectOptions(screen.getByLabelText("Cấp ma trận"), "3");
    await user.click(screen.getByRole("tab", { name: "Phân tích" }));
    const analysis = screen.getByRole("region", { name: "Khóa Hill" });
    expect(
      await within(analysis).findByText("Không kết nối được máy chủ. Thử lại."),
    ).toBeInTheDocument();
    await user.click(within(analysis).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(gateway.random).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("textbox", { name: "Khóa hàng 3 cột 3" })).toHaveValue("15");
  });
  it("retries the random endpoint at the same size and reuses its analysis", async () => {
    const user = userEvent.setup();
    const gateway = createHillGateway({
      random: vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({ success: true, result: exampleKey, warnings: [] }),
    });
    renderWithExampleKey(gateway);
    await waitFor(() => expect(gateway.analyze).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Khóa ngẫu nhiên" }));
    await user.click(screen.getByRole("tab", { name: "Phân tích" }));
    const panel = screen.getByRole("region", { name: "Khóa Hill" });
    await user.click(await within(panel).findByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(gateway.random).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(within(panel).getByText("✓ Khóa khả nghịch modulo 26.")).toBeInTheDocument(),
    );
    expect(gateway.analyze).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      code: "E06",
      message: "Backend byte limit message",
      details: { maxBytes: 5242880 },
      region: "Bản rõ",
    },
    {
      code: "E03",
      message: "Backend invalid cell message",
      details: { reason: "invalid_cell", row: 1, column: 2 },
      region: "Khóa Hill",
    },
    {
      code: "E10",
      message: "Backend options message",
      details: { field: "stripDiacritics" },
      region: null,
    },
  ])(
    "routes $code from transform without replacing the server message",
    async ({ code, message, details, region }) => {
      const user = userEvent.setup();
      const gateway = createHillGateway({
        process: vi
          .fn()
          .mockRejectedValue(
            new HillApiError({ code, message, details }, code === "E06" ? 413 : 422),
          ),
      });
      renderWithExampleKey(gateway);
      await user.type(screen.getByRole("textbox", { name: "Văn bản đầu vào" }), "HELP");
      await waitFor(() => expect(screen.getByRole("button", { name: "Mã hóa" })).toBeEnabled());
      await user.click(screen.getByRole("button", { name: "Mã hóa" }));
      const scope = region ? within(screen.getByRole("region", { name: region })) : screen;
      expect(await scope.findByText(message)).toBeInTheDocument();
      if (code === "E03") {
        expect(screen.getByRole("textbox", { name: "Khóa hàng 1 cột 2" })).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        expect(screen.getByRole("button", { name: "Mã hóa" })).toBeDisabled();
      }
    },
  );
  it("keeps text/file drafts separate and sends the full file through JSON, beyond the preview", async () => {
    const user = userEvent.setup();
    const gateway = createHillGateway();
    renderWithExampleKey(gateway);
    await user.type(screen.getByRole("textbox", { name: "Văn bản đầu vào" }), "Typed draft");
    await user.click(screen.getByRole("button", { name: "File .txt" }));
    expect(screen.getByText("Kéo thả file .txt vào đây")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeDisabled();
    const content = "HELP" + "!".repeat(6000);
    await user.upload(screen.getByLabelText("Chọn file văn bản"), new File([content], "full.txt"));
    const preview = await screen.findByLabelText("Xem trước nội dung file");
    expect(preview.textContent).toBe(content.slice(0, 5000) + "\n…");
    await waitFor(() => expect(screen.getByRole("button", { name: "Mã hóa" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    expect(gateway.process).toHaveBeenCalledWith(
      "encrypt",
      expect.objectContaining({ text: content }),
    );
    const filePanel = screen.getByRole("region", { name: "Tệp văn bản" });
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(within(filePanel).getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenCalledWith(content);
    await user.click(screen.getByRole("button", { name: "Văn bản" }));
    expect(screen.getByRole("textbox", { name: "Văn bản đầu vào" })).toHaveValue("Typed draft");
    await user.click(screen.getByRole("button", { name: "File .txt" }));
    expect(screen.getByText("full.txt")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gỡ file" }));
    expect(screen.getByText("Kéo thả file .txt vào đây")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeDisabled();
  });
});
