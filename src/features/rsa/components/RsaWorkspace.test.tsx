import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RsaWorkspace } from "./RsaWorkspace";
import { parseRsaCipher, useRsaCipher } from "../hooks/useRsaCipher";
import { createRsaGateway } from "../test/createRsaGateway";
import type { RsaTransformResult } from "../types/cipher";

function setup() {
  const gateway = createRsaGateway();
  vi.spyOn(gateway, "generateKey");
  vi.spyOn(gateway, "transform");
  function Fixture() {
    return <RsaWorkspace cipher={useRsaCipher(gateway, true)} />;
  }
  render(
    <StrictMode>
      <Fixture />
    </StrictMode>,
  );
  const number = within(screen.getByRole("region", { name: "Mã hóa và giải mã một khối số" }));
  const text = within(screen.getByRole("region", { name: "Văn bản: mỗi ký tự là một khối" }));
  return { gateway, number, text };
}
function manual() {
  fireEvent.click(screen.getByRole("button", { name: "Nhập khóa" }));
  fireEvent.change(screen.getByRole("textbox", { name: "n · modulo" }), {
    target: { value: "187" },
  });
}

describe("RSA independent operations", () => {
  it("never auto-runs, including examples, presets and StrictMode mounting", async () => {
    const { gateway, number } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Tạo ví dụ" }));
    fireEvent.click(screen.getByRole("button", { name: "61, 53, 17" }));
    await act(async () => {});
    expect(gateway.generateKey).not.toHaveBeenCalled();
    expect(gateway.transform).not.toHaveBeenCalled();
    expect(number.getByRole("button", { name: "Mã hóa" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tạo khóa" }));
    expect(await screen.findByText("{17, 3233}", { exact: true })).toBeVisible();
    expect(gateway.generateKey).toHaveBeenCalledTimes(1);
    expect(gateway.transform).not.toHaveBeenCalled();
  });

  it("encrypts with public key only and keeps text mode independent", async () => {
    const { gateway, number, text } = setup();
    manual();
    fireEvent.change(screen.getByRole("textbox", { name: "e · khóa công khai" }), {
      target: { value: "7" },
    });
    fireEvent.click(number.getByRole("button", { name: "Mã hóa" }));
    expect(await number.findByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue(
      '["11"]',
    );
    await waitFor(() => expect(gateway.transform).toHaveBeenCalledTimes(1));
    expect(gateway.transform).toHaveBeenCalledWith(
      { operation: "encrypt", inputType: "number", n: "187", e: "7", data: "88" },
      expect.any(AbortSignal),
    );
    fireEvent.click(number.getByRole("radio", { name: /Giải mã/ }));
    expect(text.getByRole("radio", { name: /Mã hóa/ })).toHaveAttribute("aria-checked", "true");
    expect(number.getByRole("textbox", { name: "Kết quả bản rõ" })).toHaveValue("");
  });

  it("decrypts pasted JSON with private key only and rejects numeric JSON values", async () => {
    const { gateway, text } = setup();
    manual();
    fireEvent.change(screen.getByRole("textbox", { name: "d · khóa riêng" }), {
      target: { value: "23" },
    });
    fireEvent.click(text.getByRole("radio", { name: /Giải mã/ }));
    const input = text.getByRole("textbox", { name: "Bản mã (JSON)" });
    fireEvent.change(input, { target: { value: "[9007199254740993]" } });
    fireEvent.click(text.getByRole("button", { name: "Giải mã" }));
    expect(text.getByRole("alert")).toHaveTextContent("chuỗi số");
    expect(gateway.transform).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '["9007199254740993"]' } });
    fireEvent.click(text.getByRole("button", { name: "Giải mã" }));
    await waitFor(() =>
      expect(text.getByRole("textbox", { name: "Kết quả bản rõ" })).toHaveValue("88"),
    );
    expect(gateway.transform).toHaveBeenCalledWith(
      { operation: "decrypt", inputType: "text", n: "187", d: "23", cipher: ["9007199254740993"] },
      expect.any(AbortSignal),
    );
  });

  it("clears manual keys, results and modes on reset without sending requests", async () => {
    const { gateway, number } = setup();
    manual();
    fireEvent.change(screen.getByRole("textbox", { name: "e · khóa công khai" }), {
      target: { value: "7" },
    });
    fireEvent.click(number.getByRole("button", { name: "Mã hóa" }));
    await waitFor(() =>
      expect(number.getByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue('["11"]'),
    );
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(
      within(screen.getByRole("region", { name: "Mã hóa và giải mã một khối số" })).getByRole(
        "textbox",
        { name: "Kết quả bản mã (JSON)" },
      ),
    ).toHaveValue("");
    manual();
    expect(screen.getByRole("textbox", { name: "e · khóa công khai" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "d · khóa riêng" })).toHaveValue("");
    expect(gateway.transform).toHaveBeenCalledTimes(1);
  });

  it("copies, pastes and clears input/output independently", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue("88");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText, readText },
    });
    const { number } = setup();
    manual();
    fireEvent.change(screen.getByRole("textbox", { name: "e · khóa công khai" }), {
      target: { value: "7" },
    });
    fireEvent.click(number.getByRole("button", { name: "Dán" }));
    await waitFor(() => expect(readText).toHaveBeenCalled());
    fireEvent.click(number.getByRole("button", { name: "Mã hóa" }));
    await waitFor(() =>
      expect(number.getByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue('["11"]'),
    );
    const output = within(number.getByRole("group", { name: "Thao tác kết quả" }));
    fireEvent.click(output.getByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenCalledWith('["11"]');
    fireEvent.click(output.getByRole("button", { name: "Xóa" }));
    expect(number.getByRole("textbox", { name: "Bản rõ P (số)" })).toHaveValue("88");
    expect(number.getByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue("");
  });

  it("shows errors as text and retries the same explicit operation", async () => {
    const gateway = createRsaGateway({ failOnce: "number" });
    function Fixture() {
      return <RsaWorkspace cipher={useRsaCipher(gateway, true)} />;
    }
    render(<Fixture />);
    manual();
    fireEvent.change(screen.getByRole("textbox", { name: "e · khóa công khai" }), {
      target: { value: "7" },
    });
    const number = within(screen.getByRole("region", { name: "Mã hóa và giải mã một khối số" }));
    fireEvent.click(number.getByRole("button", { name: "Mã hóa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("<Backend>");
    expect(document.querySelector("backend")).toBeNull();
    fireEvent.click(number.getByRole("button", { name: "Mã hóa" }));
    await waitFor(() =>
      expect(number.getByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue('["11"]'),
    );
  });
});

const lateResult: RsaTransformResult = {
  operation: "encrypt",
  inputType: "number",
  output: '["11"]',
  blocks: ["88"],
  cipher: ["11"],
  rows: [],
};
it.each(["input", "mode", "key", "reset", "inactive", "unmount"])(
  "discards late responses after %s",
  async (change) => {
    const gateway = createRsaGateway();
    let resolve!: (result: RsaTransformResult) => void;
    const request = vi.spyOn(gateway, "transform").mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const hook = renderHook(({ active }) => useRsaCipher(gateway, active), {
      initialProps: { active: true },
    });
    act(() => hook.result.current.setKeySource("manual"));
    act(() => {
      hook.result.current.setManualKey("n", "187");
      hook.result.current.setManualKey("e", "7");
    });
    act(() => {
      hook.result.current.process("number");
      hook.result.current.process("number");
    });
    expect(request).toHaveBeenCalledTimes(1);
    const signal = request.mock.calls[0][1];
    if (change === "input") act(() => hook.result.current.setInput("number", "99"));
    if (change === "mode") act(() => hook.result.current.setMode("number", "decrypt"));
    if (change === "key") act(() => hook.result.current.setManualKey("n", "3233"));
    if (change === "reset") act(() => hook.result.current.resetAll());
    if (change === "inactive") hook.rerender({ active: false });
    if (change === "unmount") hook.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(lateResult));
    expect(hook.result.current.results.number).toBeUndefined();
  },
);
it("validates ciphertext without converting large integers to numbers", () => {
  expect(parseRsaCipher('["9007199254740993"]', "number")).toEqual(["9007199254740993"]);
  for (const value of ["[]", "[11]", '["-1"]', '["1.5"]', "{}", '"11"', '["1","2"]'])
    expect(() => parseRsaCipher(value, "number")).toThrow();
});
