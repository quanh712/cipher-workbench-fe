import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dhOperations } from "../services/dhOperations";
import { useDiffieHellman } from "../hooks/useDiffieHellman";
import { DiffieHellmanWorkspace } from "./DiffieHellmanWorkspace";
import { createDhPresetResult } from "../test/fixtures";
import type { DiffieHellmanGateway } from "../services/diffieHellmanGateway";
import { saveBlob } from "../../../shared/utils/download";
vi.mock("../../../shared/utils/download", () => ({ saveBlob: vi.fn() }));
vi.mock("../services/dhOperations", () => ({
  dhOperations: {
    params: vi.fn(),
    randomParams: vi.fn(),
    keypair: vi.fn(),
    sharedSecret: vi.fn(),
    caesar: vi.fn(),
  },
}));
const gateway: DiffieHellmanGateway = { exchange: vi.fn(), generatePrivateValues: vi.fn() };
const preset = createDhPresetResult();
const keyA = {
  success: true as const,
  privateKey: "6",
  publicKey: "8",
  steps: preset.traces!.publicA.steps,
};
const keyB = {
  success: true as const,
  privateKey: "15",
  publicKey: "19",
  steps: preset.traces!.publicB.steps,
};
const caesarReply = { success: true as const, sharedKey: "2", shift: "2", result: "Jgnnq Yqtnf" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(gateway.exchange).mockResolvedValue(preset);
  vi.mocked(dhOperations.caesar).mockResolvedValue(caesarReply);
});
function Harness() {
  const cipher = useDiffieHellman(gateway, true);
  return <DiffieHellmanWorkspace cipher={cipher} />;
}
function setup() {
  render(<Harness />);
}
const main = () => screen.getByRole("form", { name: "Thiết lập Diffie–Hellman" });
const practice = () => screen.getByRole("region", { name: "Thực hành Diffie–Hellman từng bước" });
const caesar = () => screen.getByRole("region", { name: "Caesar bằng khóa chung" });
const output = () =>
  within(caesar()).getByRole("region", { name: "Kết quả Caesar bằng khóa chung" });
function change(name: string, value: string) {
  fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
}
function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}
function group() {
  change("Số nguyên tố q", "23");
  change("Căn nguyên thủy α", "5");
}
async function exchange() {
  click("Tạo ví dụ");
  click("Thiết lập bí mật chung");
  await screen.findByText("Hai bên đã thiết lập cùng bí mật chung.");
}
function select(side: "A" | "B") {
  fireEvent.click(
    within(practice()).getByRole("group", { name: "Bên thực hành DH" }).querySelectorAll("button")[
      side === "A" ? 0 : 1
    ],
  );
}
async function keys() {
  vi.mocked(dhOperations.keypair).mockResolvedValueOnce(keyA).mockResolvedValueOnce(keyB);
  group();
  click("Tạo cặp khóa bên A");
  await screen.findByText("Khóa công khai Y_A");
  select("B");
  click("Tạo cặp khóa bên B");
  await screen.findByText("Khóa công khai Y_B");
}

describe("linked DH practice and Caesar", () => {
  it("is visible without disclosure, shares main inputs and requires explicit alpha suggestion", async () => {
    setup();
    expect(dhOperations.params).not.toHaveBeenCalled();
    expect(within(practice()).queryAllByRole("textbox")).toHaveLength(0);
    change("Số nguyên tố q", "23");
    vi.mocked(dhOperations.params).mockResolvedValue({
      success: true,
      q: "23",
      alpha: null,
      suggestedAlpha: "5",
      factors: ["2", "11"],
      primitiveRootChecks: [],
    });
    click("Kiểm tra q và α");
    await screen.findByText("Gợi ý α: 5");
    expect(dhOperations.params).toHaveBeenCalledWith({ q: "23" }, expect.any(AbortSignal));
    expect(within(main()).getByRole("textbox", { name: "Căn nguyên thủy α" })).toHaveValue("");
    click("Dùng α gợi ý");
    expect(within(main()).getByRole("textbox", { name: "Căn nguyên thủy α" })).toHaveValue("5");
  });
  it("retains A/B keys, computes from peer public key, and invalidates only dependent results", async () => {
    setup();
    await keys();
    expect(within(main()).getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("6");
    expect(dhOperations.keypair).toHaveBeenNthCalledWith(
      1,
      { q: "23", alpha: "5" },
      expect.any(AbortSignal),
    );
    select("A");
    vi.mocked(dhOperations.sharedSecret).mockResolvedValue({
      success: true,
      sharedKey: "2",
      steps: preset.traces!.sharedA.steps,
    });
    click("Tính khóa chung bên A");
    await screen.findByText("K_A = 19^6 mod 23 = 2");
    expect(dhOperations.sharedSecret).toHaveBeenCalledWith(
      { q: "23", privateKey: "6", otherPublicKey: "19" },
      expect.any(AbortSignal),
    );
    change("Số mũ riêng X_B", "17");
    expect(screen.getByText("Khóa công khai Y_A")).toBeVisible();
    expect(screen.queryByText("Khóa công khai Y_B")).not.toBeInTheDocument();
    expect(screen.queryByText("K_A = 19^6 mod 23 = 2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tính khóa chung bên A" })).toBeDisabled();
  });
  it("applies random group atomically and removes old keys/results", async () => {
    setup();
    await keys();
    vi.mocked(dhOperations.randomParams).mockResolvedValue({
      success: true,
      q: "32843",
      alpha: "2",
      p: "16421",
      factors: ["2", "16421"],
      primitiveRootChecks: [],
      suggestedAlpha: null,
    });
    click("Sinh nhóm tham số");
    await screen.findByText("q = 2p + 1; p = 16421");
    expect(within(main()).getByRole("textbox", { name: "Số nguyên tố q" })).toHaveValue("32843");
    expect(within(main()).getByRole("textbox", { name: "Căn nguyên thủy α" })).toHaveValue("2");
    expect(within(main()).getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("");
    expect(within(main()).getByRole("textbox", { name: "Số mũ riêng X_B" })).toHaveValue("");
    expect(screen.queryByText("Khóa công khai Y_A")).not.toBeInTheDocument();
  });
  it("requires exchange and uses returned private keys when main input omitted them", async () => {
    setup();
    group();
    change("Văn bản Caesar", "Hello World");
    expect(screen.getByRole("button", { name: "Mã hóa bằng khóa chung" })).toBeDisabled();
    click("Thiết lập bí mật chung");
    await screen.findByText("Hai bên đã thiết lập cùng bí mật chung.");
    expect(within(main()).getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("");
    click("Mã hóa bằng khóa chung");
    await within(output()).findByText("✓ Xử lý thành công · 11 ký tự");
    expect(dhOperations.caesar).toHaveBeenCalledWith(
      { q: "23", privateKey: "6", otherPublicKey: "19", action: "encrypt", data: "Hello World" },
      expect.any(AbortSignal),
    );
    fireEvent.click(within(output()).getByRole("tab", { name: "Phân tích" }));
    expect(within(output()).getByText("2 mod 26 = 2")).toBeVisible();
    select("B");
    expect(within(output()).queryByText("2 mod 26 = 2")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Văn bản Caesar" })).toHaveValue("Hello World");
    click("Mã hóa bằng khóa chung");
    await within(output()).findByText("✓ Xử lý thành công · 11 ký tự");
    expect(dhOperations.caesar).toHaveBeenLastCalledWith(
      { q: "23", privateKey: "15", otherPublicKey: "8", action: "encrypt", data: "Hello World" },
      expect.any(AbortSignal),
    );
    change("Số nguyên tố q", "353");
    expect(screen.getByRole("button", { name: "Mã hóa bằng khóa chung" })).toBeDisabled();
    expect(within(output()).queryByText("2 mod 26 = 2")).not.toBeInTheDocument();
  });
  it("locks main and practice tasks together and aborts stale keypair on edit", async () => {
    setup();
    group();
    let finish!: (value: typeof keyA) => void;
    vi.mocked(dhOperations.keypair).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    click("Tạo cặp khóa bên A");
    expect(screen.getByRole("button", { name: "Thiết lập bí mật chung" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sinh nhóm tham số" })).toBeDisabled();
    const signal = vi.mocked(dhOperations.keypair).mock.calls[0][1];
    change("Căn nguyên thủy α", "3");
    expect(signal.aborted).toBe(true);
    await act(async () => finish(keyA));
    expect(screen.queryByText("Khóa công khai Y_A")).not.toBeInTheDocument();
    expect(within(main()).getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("");
  });
  it("aborts Caesar on input edits, preserves input when clearing output, and ignores late response", async () => {
    setup();
    await exchange();
    change("Văn bản Caesar", "Hello World");
    let finish!: (value: typeof caesarReply) => void;
    vi.mocked(dhOperations.caesar).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    click("Mã hóa bằng khóa chung");
    const signal = vi.mocked(dhOperations.caesar).mock.calls[0][1];
    change("Văn bản Caesar", "new input");
    expect(signal.aborted).toBe(true);
    await act(async () => finish(caesarReply));
    expect(within(output()).getByRole("tabpanel", { name: "Văn bản" })).toHaveTextContent(
      "Kết quả sẽ hiển thị",
    );
    click("Mã hóa bằng khóa chung");
    await within(output()).findByText("✓ Xử lý thành công · 11 ký tự");
    fireEvent.click(within(output()).getByRole("button", { name: "Xóa" }));
    expect(screen.getByRole("textbox", { name: "Văn bản Caesar" })).toHaveValue("new input");
  });
  it("uses file input and downloads returned JSON locally without calling API again", async () => {
    setup();
    await exchange();
    fireEvent.click(within(caesar()).getByRole("button", { name: "File .txt" }));
    const file = new File(["Hello World"], "hello.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Chọn file Caesar DH"), { target: { files: [file] } });
    await screen.findByText("hello.txt");
    await act(async () => {});
    click("Mã hóa bằng khóa chung");
    await within(output()).findByText("✓ Xử lý thành công · 11 ký tự");
    expect(dhOperations.caesar).toHaveBeenCalledWith(
      { q: "23", privateKey: "6", otherPublicKey: "19", action: "encrypt", file },
      expect.any(AbortSignal),
    );
    click("Tải kết quả");
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), "dh-caesar.encrypted.txt");
    expect(dhOperations.caesar).toHaveBeenCalledTimes(1);
    click("Gỡ file");
    expect(screen.queryByText("hello.txt")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa bằng khóa chung" })).toBeDisabled();
  });
  it("scopes Caesar reset and resets every practice/input with main reset", async () => {
    setup();
    await keys();
    await exchange();
    change("Văn bản Caesar", "keep");
    click("Đặt lại Caesar");
    expect(screen.getByText("Khóa công khai Y_A")).toBeVisible();
    expect(screen.getByText("Hai bên đã thiết lập cùng bí mật chung.")).toBeVisible();
    change("Văn bản Caesar", "clear all");
    click("Đặt lại");
    expect(screen.queryByText("Khóa công khai Y_A")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Văn bản Caesar" })).toHaveValue("");
    expect(within(main()).getByRole("textbox", { name: "Số nguyên tố q" })).toHaveValue("");
  });
  it("rejects a Caesar response derived from a different shared key", async () => {
    setup();
    await exchange();
    change("Văn bản Caesar", "Hello");
    vi.mocked(dhOperations.caesar).mockResolvedValue({
      success: true,
      sharedKey: "26",
      shift: "0",
      result: "Hello",
      warning: { code: "SHIFT_ZERO", message: "Văn bản không đổi." },
    });
    click("Mã hóa bằng khóa chung");
    await within(output()).findByRole("alert");
    expect(within(output()).getByRole("alert")).toHaveTextContent("không khớp khóa chung");
  });
});
