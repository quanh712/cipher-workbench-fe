import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHealthStatus } from "../features/history/services/historyApi";
import { App } from "./App";

vi.mock("../features/history/services/historyApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/history/services/historyApi")>()),
  getHealthStatus: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getHealthStatus).mockResolvedValue({ database: "ok", history: "disabled" });
});

describe("Cipher Workbench", () => {
  it("hides server history unless both health flags allow it", async () => {
    const health = vi.mocked(getHealthStatus);
    const { unmount } = render(<App />);
    await waitFor(() => expect(health).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Lịch sử thao tác" })).not.toBeInTheDocument();
    unmount();

    health.mockResolvedValue({ database: "ok", history: "enabled" });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Lịch sử thao tác" })).toBeVisible();
  });

  it.each([
    ["Caesar", "Khóa Caesar"],
    ["Vigenère", "Khóa Vigenère"],
    ["Playfair", "Khóa Playfair"],
    ["Affine", "Khóa Affine"],
    ["Hệ mã hàng", "Khóa Hệ mã hàng"],
  ])("uses the Caesar workspace structure for %s", async (algorithm, keyHeading) => {
    const user = userEvent.setup();
    render(<App />);
    if (algorithm !== "Caesar") {
      await user.click(screen.getByRole("tab", { name: new RegExp(algorithm) }));
    }

    const workspace = document.querySelector(".cipher-workspace") as HTMLElement;
    const columns = workspace.querySelector(".workspace__columns")!;
    const keySection = workspace.querySelector(".config-section")!;
    const input = within(workspace).getByRole("textbox", { name: "Nội dung đầu vào" });

    expect(within(workspace).getByRole("button", { name: "Tạo ví dụ" })).toBeVisible();
    expect(columns.children).toHaveLength(2);
    expect(columns.children[0].tagName).toBe("SECTION");
    expect(columns.children[1].tagName).toBe("SECTION");
    expect(input.closest(".highlighted-input")).not.toBeNull();
    expect(within(workspace).getByRole("tab", { name: "Văn bản" })).toBeVisible();
    expect(within(workspace).getByRole("tab", { name: "Phân tích" })).toBeVisible();
    expect(within(workspace).getByRole("heading", { name: keyHeading })).toBeVisible();
    expect(
      columns.compareDocumentPosition(keySection) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      keySection.compareDocumentPosition(
        within(workspace).getByRole("button", { name: "Mã hóa" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("switches between independent algorithm workspaces", async () => {
    const user = userEvent.setup();
    render(<App />);

    const caesar = screen.getByRole("tab", { name: /Caesar/ });
    const playfair = screen.getByRole("tab", { name: /Playfair/ });
    const vigenere = screen.getByRole("tab", { name: /Vigenère/ });
    const affine = screen.getByRole("tab", { name: /Affine/ });

    expect(caesar).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toBeInTheDocument();

    await user.click(playfair);
    expect(playfair).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Khóa Playfair" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeDisabled();
    expect(screen.getByText("Kết quả sẽ hiển thị ở đây sau khi xử lý.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("radiogroup", { name: "Chế độ" })).getByRole("radio", {
        name: /Mã hóa/,
      }),
    ).toBeEnabled();

    await user.click(vigenere);
    expect(screen.getByRole("textbox", { name: "Khóa Vigenère" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeDisabled();

    await user.click(affine);
    expect(affine).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Khóa nhân a" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Khóa dịch b" })).toBeInTheDocument();

    await user.click(caesar);
    expect(caesar).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("radiogroup", { name: "Chế độ" })).getByRole("radio", {
        name: /Mã hóa/,
      }),
    ).toBeEnabled();
  });

  it("supports keyboard navigation for algorithm tabs", async () => {
    const user = userEvent.setup();
    render(<App />);

    const caesar = screen.getByRole("tab", { name: /Caesar/ });
    caesar.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /Vigenère/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Khóa Vigenère" })).toBeInTheDocument();

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /Hệ mã hàng/ })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Khóa cột" })).toBeInTheDocument();
  });

  it("supports keyboard navigation for mode and result views", async () => {
    const user = userEvent.setup();
    render(<App />);

    const encrypt = screen.getByRole("radio", { name: /Mã hóa/ });
    encrypt.focus();
    await user.keyboard("{ArrowRight}");

    const decrypt = screen.getByRole("radio", { name: /Giải mã/ });
    expect(decrypt).toHaveFocus();
    expect(decrypt).toHaveAttribute("aria-checked", "true");

    const textTab = screen.getByRole("tab", { name: "Văn bản" });
    const textPanelId = textTab.getAttribute("aria-controls");
    expect(textPanelId).toBeTruthy();
    expect(document.getElementById(textPanelId!)).toHaveAttribute("role", "tabpanel");

    textTab.focus();
    await user.keyboard("{End}");

    const analysisTab = screen.getByRole("tab", { name: "Phân tích" });
    expect(analysisTab).toHaveFocus();
    expect(analysisTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Phân tích" })).toBeVisible();
  });

  it("keeps a separate draft for each planned algorithm", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Vigenère/ }));
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "Vigenere draft");
    await user.type(screen.getByRole("textbox", { name: "Khóa Vigenère" }), " Lemon ");

    await user.click(screen.getByRole("tab", { name: /Playfair/ }));
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "Playfair draft");
    await user.type(screen.getByRole("textbox", { name: "Khóa Playfair" }), "Monarchy");

    await user.click(screen.getByRole("tab", { name: /Vigenère/ }));
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue("Vigenere draft");
    expect(screen.getByRole("textbox", { name: "Khóa Vigenère" })).toHaveValue(" Lemon ");

    await user.click(screen.getByRole("tab", { name: /Playfair/ }));
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue("Playfair draft");
    expect(screen.getByRole("textbox", { name: "Khóa Playfair" })).toHaveValue("Monarchy");
  });

  it("validates the accepted Vigenère key and file rules", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Vigenère/ }));
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "   ");
    await user.type(screen.getByRole("textbox", { name: "Khóa Vigenère" }), "   ");
    expect(screen.getByText("✓ Đầu vào hợp lệ ở mức sơ bộ.")).toBeInTheDocument();
    expect(screen.getByText(/Khóa Vigenère chỉ được chứa/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "File .txt" }));
    await user.upload(
      screen.getByLabelText("Chọn file văn bản"),
      new File(["not read"], "message.csv", { type: "text/csv" }),
    );
    expect(screen.getByText(/Chỉ chấp nhận file \.txt\./)).toBeInTheDocument();
    expect(screen.getByText("message.csv")).toBeInTheDocument();
  });

  it("encrypts the official Vigenère example and explains its key stream", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Vigenère/ }));
    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue(
      "Attack at dawn!",
    );
    expect(screen.getByRole("textbox", { name: "Khóa Vigenère" })).toHaveValue("LEMON");

    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    await waitFor(() =>
      expect(screen.getByRole("tabpanel", { name: "Văn bản" })).toHaveTextContent(
        "Lxfopv ef rnhr!",
      ),
    );

    await user.click(screen.getByRole("tab", { name: "Phân tích" }));
    expect(screen.getByText("LEMONL·EM·ONLE·", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/Dấu · là ký tự không tiêu thụ khóa/)).toBeInTheDocument();
  });

  it("decrypts the official Vigenère vector", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Vigenère/ }));
    await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "Lxfopv ef rnhr!");
    await user.type(screen.getByRole("textbox", { name: "Khóa Vigenère" }), "LEMON");
    await user.click(screen.getByRole("button", { name: "Giải mã" }));

    await waitFor(() =>
      expect(screen.getByRole("tabpanel", { name: "Văn bản" })).toHaveTextContent(
        "Attack at dawn!",
      ),
    );
  });

  it("analyzes the official Playfair example with matrix and digraph mappings", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Playfair/ }));
    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    expect(
      await screen.findByText("BMODZBXDNABEKUDMUIXMMOUVIF", { exact: true }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Phân tích" }));
    expect(screen.getByText("Key Matrix 5×5", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/HI → BM/)).toBeInTheDocument();
    expect(screen.getByText("HIDETHEGOLDINTHETREESTUMP", { exact: true })).toBeInTheDocument();
  });

  it.each([
    ["PDGW", "ABX"],
    ["BMODZBXDNAGE", "HIDETHEGOLD"],
    ["GWGW", "XQX"],
  ])(
    "shows the Backend Playfair decrypt result for %s without stripping again",
    async (ciphertext, expected) => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, "writeText");
      render(<App />);

      await user.click(screen.getByRole("tab", { name: /Playfair/ }));
      await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
      await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), ciphertext);
      await user.type(screen.getByRole("textbox", { name: "Khóa Playfair" }), "PLAYFAIR EXAMPLE");
      await user.click(screen.getByRole("button", { name: "Giải mã" }));

      await waitFor(() =>
        expect(screen.getByRole("tabpanel", { name: "Văn bản" }).textContent).toBe(expected),
      );
      const resultPanel = screen.getByRole("tabpanel", { name: "Văn bản" });
      await user.click(
        within(resultPanel.closest("section")!).getByRole("button", { name: "Sao chép" }),
      );
      expect(writeText).toHaveBeenCalledWith(expected);
    },
  );

  it("previews the trimmed Playfair file result from the Backend", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Playfair/ }));
    await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
    await user.click(screen.getByRole("button", { name: "File .txt" }));
    await user.upload(
      screen.getByLabelText("Chọn file văn bản"),
      new File(["PDGW"], "message.txt", { type: "text/plain" }),
    );
    await user.type(screen.getByRole("textbox", { name: "Khóa Playfair" }), "PLAYFAIR EXAMPLE");
    await user.click(screen.getByRole("button", { name: "Giải mã" }));

    await waitFor(() =>
      expect(screen.getByRole("tabpanel", { name: "Văn bản" }).textContent).toBe("ABX"),
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/playfair/file",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
  });

  it("encrypts and decrypts Affine through the registered workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Affine/ }));
    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    expect(await screen.findByText("RCLLA", { exact: true })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
    await user.clear(screen.getByRole("textbox", { name: "Nội dung đầu vào" }));
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "RCLLA");
    await user.click(screen.getByRole("button", { name: "Giải mã" }));
    expect(await screen.findByText("HELLO", { exact: true })).toBeInTheDocument();
  });

  it("uses the Columnar Backend route in the Workbench", async () => {
    const user = userEvent.setup();
    render(<App />);

    const columnar = screen.getByRole("tab", { name: /Hệ mã hàng/ });
    expect(columnar).toHaveTextContent("Khả dụng");
    await user.click(columnar);

    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/columnar/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"text":"khoacongnghethongtin","key":"3,6,2,1,5,4"}',
    });
    await waitFor(() =>
      expect(screen.getByRole("tabpanel", { name: "Văn bản" })).toHaveTextContent(
        "agnonokntioetchghghn",
      ),
    );

    await user.click(screen.getByRole("tab", { name: "Phân tích" }));
    expect(screen.getByText(/kết quả chính thức lấy từ Backend/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Caesar/ }));
    await user.click(columnar);
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue(
      "khoacongnghethongtin",
    );
    expect(screen.getByRole("tabpanel", { name: "Văn bản" })).toHaveTextContent(
      "Kết quả sẽ hiển thị ở đây sau khi xử lý.",
    );

    await user.click(screen.getByRole("button", { name: /Làm mới/ }));
    await user.click(columnar);
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Khóa cột" })).toHaveValue("");
  });

  it("previews and copies the selected Vigenère file", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Vigenère/ }));
    await user.click(screen.getByRole("button", { name: "File .txt" }));
    await user.upload(
      screen.getByLabelText("Chọn file văn bản"),
      new File(["AéA"], "unicode.TXT", { type: "text/plain" }),
    );

    const preview = await screen.findByLabelText("Xem trước nội dung file");
    expect(preview).toHaveTextContent("AéA");
    await user.click(within(preview.closest("section")!).getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenCalledWith("AéA");
  });

  it("clears a draft notice when mode changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Vigenère/ }));
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "Draft");
    await user.click(screen.getAllByRole("button", { name: "Sao chép" })[0]);
    expect(await screen.findByText("Đã sao chép đầu vào.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
    expect(screen.queryByText("Đã sao chép đầu vào.")).not.toBeInTheDocument();
  });

  it("returns to Caesar when the workspace is refreshed", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Playfair/ }));
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "Draft");
    await user.type(screen.getByRole("textbox", { name: "Khóa Playfair" }), "Key");
    await user.click(screen.getByRole("button", { name: /Làm mới/ }));

    expect(screen.getByRole("tab", { name: /Caesar/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Playfair/ }));
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Khóa Playfair" })).toHaveValue("");
    expect(screen.getByText("Kết quả sẽ hiển thị ở đây sau khi xử lý.")).toBeInTheDocument();
  });

  it("loads the example and encrypts it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    expect(screen.getByRole("textbox", { name: "Nội dung đầu vào" })).toHaveValue("Hello World");

    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    expect(
      await screen.findByText(
        (_, element) => element?.tagName === "PRE" && element.textContent === "Khoor Zruog",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Mã hóa thành công.")).toBeInTheDocument();
  });

  it("shows a copy success toast", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    await user.click(screen.getAllByRole("button", { name: "Sao chép" })[0]);

    expect(await screen.findByText("Đã sao chép đầu vào.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("Hello World");
  });

  it("pastes clipboard text before the copy action for every text workspace", async () => {
    const user = userEvent.setup();
    const readText = vi.spyOn(navigator.clipboard, "readText").mockResolvedValue("Đã dán");
    render(<App />);

    for (const algorithm of [/Caesar/, /Vigenère/, /Playfair/, /Affine/]) {
      await user.click(screen.getByRole("tab", { name: algorithm }));
      const input = screen.getByRole("textbox", { name: "Nội dung đầu vào" });
      const inputSection = input.closest("section")!;
      const paste = within(inputSection).getByRole("button", { name: "Dán" });
      const copy = within(inputSection).getByRole("button", { name: "Sao chép" });

      expect(paste.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await user.click(paste);
      expect(input).toHaveValue("Đã dán");
      expect(await screen.findByText("Đã dán nội dung từ clipboard.")).toBeInTheDocument();
    }

    expect(readText).toHaveBeenCalledTimes(4);
  });

  it("decrypts text", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "Khoor Zruog");
    await user.type(screen.getByRole("textbox", { name: "Khóa Caesar" }), "3");
    await user.click(screen.getByRole("button", { name: "Giải mã" }));

    expect(
      await screen.findByText(
        (_, element) => element?.tagName === "PRE" && element.textContent === "Hello World",
      ),
    ).toBeInTheDocument();
  });

  it("accepts whitespace-only text", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Nội dung đầu vào" }), "   ");
    await user.type(screen.getByRole("textbox", { name: "Khóa Caesar" }), "3");

    expect(screen.getByRole("button", { name: "Mã hóa" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    expect(await screen.findByText("Mã hóa thành công.")).toBeInTheDocument();
  });

  it("reports an invalid key through a toast", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.clear(screen.getByRole("textbox", { name: "Khóa Caesar" }));
    await user.type(screen.getByRole("textbox", { name: "Khóa Caesar" }), "abc");

    expect(screen.getByText(/Khóa phải là số nguyên\./)).toBeInTheDocument();
  });

  it("previews and removes a valid text file", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "File .txt" }));
    const fileInput = screen.getByLabelText("Chọn file văn bản");
    await user.upload(fileInput, new File(["Hello file"], "message.txt", { type: "text/plain" }));

    expect(await screen.findByText("message.txt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gỡ file" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Gỡ file" }));
    expect(await screen.findByText("Kéo thả file .txt vào đây")).toBeInTheDocument();
  });

  it("accepts a file through drag and drop", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "File .txt" }));
    const dropZone = screen.getByText("Kéo thả file .txt vào đây").parentElement!;
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [new File(["Dropped"], "dropped.txt", { type: "text/plain" })] },
    });

    expect(await screen.findByText("dropped.txt")).toBeInTheDocument();
  });

  it("reports an invalid file through a toast", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "File .txt" }));
    await user.upload(
      screen.getByLabelText("Chọn file văn bản"),
      new File(["invalid"], "message.csv", { type: "text/csv" }),
    );

    expect(screen.getByText(/Chỉ chấp nhận file \.txt\./)).toBeInTheDocument();
  });

  it.each([
    ["encrypt", "Hello", "Khoor", "Mã hóa"],
    ["decrypt", "Khoor", "Hello", "Giải mã"],
  ] as const)("processes a file in %s mode", async (mode, source, expected, actionLabel) => {
    const user = userEvent.setup();
    render(<App />);

    if (mode === "decrypt") await user.click(screen.getByRole("radio", { name: /Giải mã/ }));
    await user.click(screen.getByRole("button", { name: "File .txt" }));
    await user.upload(
      screen.getByLabelText("Chọn file văn bản"),
      new File([source], "message.txt", { type: "text/plain" }),
    );
    await user.type(screen.getByRole("textbox", { name: "Khóa Caesar" }), "3");
    await user.click(screen.getByRole("button", { name: actionLabel }));

    expect(
      await screen.findByText(
        (_, element) => element?.tagName === "PRE" && element.textContent === expected,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải kết quả" })).toBeEnabled();
  });

  it("locks request-changing controls while processing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));

    expect(screen.getByRole("radio", { name: /Giải mã/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "File .txt" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Khóa Caesar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tạo ví dụ" })).toBeDisabled();

    expect(await screen.findByText("Mã hóa thành công.")).toBeInTheDocument();
  });

  it("clears stale result when input changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    await user.click(screen.getByRole("button", { name: "Mã hóa" }));
    await screen.findByText("Mã hóa thành công.");

    const input = screen.getByRole("textbox", { name: "Nội dung đầu vào" });
    await user.clear(input);
    await user.type(input, "Changed input");
    expect(screen.getByText("Kết quả sẽ hiển thị ở đây sau khi xử lý.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải kết quả" })).toBeDisabled();
  });
});
