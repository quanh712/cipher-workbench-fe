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
import { useRsaCipher } from "../hooks/useRsaCipher";
import { RsaGatewayError, type RsaGateway } from "../services/rsaGateway";
import type { RsaKeyResult, RsaNumberResult, RsaTextResult } from "../types/cipher";
import { RsaWorkspace } from "./RsaWorkspace";

const keyResult: RsaKeyResult = {
  p: "17",
  q: "11",
  e: "7",
  n: "187",
  phi: "160",
  d: "23",
  verification: "1",
  euclidRows: [
    { quotient: null, remainder: "160", coefficient: "0" },
    { quotient: null, remainder: "7", coefficient: "1" },
    { quotient: "3", remainder: "1", coefficient: "23" },
  ],
};

function createGateway(): RsaGateway {
  return {
    generateKey: vi.fn().mockResolvedValue(keyResult),
    roundTripNumber: vi.fn().mockResolvedValue({
      plaintext: "88",
      ciphertext: "11",
      decrypted: "88",
      plaintextInRange: true,
      encryptRows: [
        { index: 0, bit: 1, base: "88", before: "1", after: "88" },
        { index: 1, bit: 1, base: "77", before: "88", after: "44" },
        { index: 2, bit: 1, base: "132", before: "44", after: "11" },
      ],
      decryptRows: [
        { index: 0, bit: 1, base: "11", before: "1", after: "11" },
        { index: 1, bit: 1, base: "121", before: "11", after: "22" },
        { index: 2, bit: 1, base: "55", before: "22", after: "88" },
        { index: 3, bit: 0, base: "33", before: "88", after: "88" },
        { index: 4, bit: 1, base: "154", before: "88", after: "88" },
      ],
    }),
    roundTripText: vi.fn().mockResolvedValue({
      rows: [
        {
          character: "<",
          plaintext: "60",
          ciphertext: "51",
          decrypted: "60",
          recovered: true,
        },
        {
          character: "à",
          plaintext: "224",
          ciphertext: "51",
          decrypted: "37",
          recovered: false,
        },
      ],
      invalidCount: 1,
    }),
  };
}

function Harness({ gateway, active = true }: { gateway: RsaGateway | null; active?: boolean }) {
  const cipher = useRsaCipher(gateway, active);
  return <RsaWorkspace cipher={cipher} />;
}

describe("RsaWorkspace", () => {
  it("shows the gated learning UI without computing when no Backend gateway exists", () => {
    render(<Harness gateway={null} />);

    expect(screen.getByRole("heading", { name: "RSA từng bước" })).toBeVisible();
    expect(screen.getByRole("list", { name: "Luồng mã hóa RSA" })).toHaveTextContent(
      "Bob sinh khóa",
    );
    expect(screen.getByRole("textbox", { name: "Thông điệp" })).toHaveValue("Xin chao");
    expect(screen.getByRole("button", { name: "Sinh khóa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mã hóa rồi giải mã" })).toBeDisabled();
    expect(screen.getByText(/sau khi Backend RSA được kết nối/)).toBeVisible();
  });

  it("renders Backend results and escapes message characters", async () => {
    const gateway = createGateway();
    render(<Harness gateway={gateway} />);

    expect(await screen.findByText("{7, 187}")).toBeVisible();
    expect(screen.getByText("{23, 187}")).toBeVisible();
    expect(await screen.findByText("Giải mã khôi phục đúng P = 88.")).toBeVisible();
    expect(await screen.findByText(/1 ký tự có mã ≥ n/)).toBeVisible();
    expect(screen.getByText(/Các bước mã hóa · Số mũ dạng nhị phân: 111 · 3 vòng/)).toBeVisible();
    expect(
      screen.getByText(/Các bước giải mã · Số mũ dạng nhị phân: 10111 · 5 vòng/),
    ).toBeInTheDocument();
    const textTable = screen.getByRole("table", { name: "Kết quả mã hóa từng ký tự" });
    expect(within(textTable).getAllByText("<")).toHaveLength(2);
    expect(within(textTable).getByText("✗ sai")).toBeVisible();
    expect(textTable.querySelector("script")).toBeNull();
    expect(gateway.generateKey).toHaveBeenCalledWith(
      { p: "17", q: "11", e: "7" },
      expect.any(AbortSignal),
    );
    expect(gateway.roundTripNumber).toHaveBeenCalledWith(
      { p: "17", q: "11", e: "7", plaintext: "88" },
      expect.any(AbortSignal),
    );
  });

  it("invalidates the key and dependent results when parameters change", async () => {
    const gateway = createGateway();
    render(<Harness gateway={gateway} />);
    await screen.findByText("{7, 187}");

    fireEvent.change(screen.getByRole("textbox", { name: "p · số nguyên tố" }), {
      target: { value: "11" },
    });
    expect(screen.queryByText("{7, 187}")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa rồi giải mã" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Sinh khóa" }));
    expect(screen.getByText("p và q phải khác nhau.")).toBeVisible();
    expect(gateway.generateKey).toHaveBeenCalledTimes(1);
  });

  it("ignores an old key response after the input changes", async () => {
    let resolveKey!: (value: RsaKeyResult) => void;
    const gateway = createGateway();
    gateway.generateKey = vi.fn().mockImplementation(
      () =>
        new Promise<RsaKeyResult>((resolve) => {
          resolveKey = resolve;
        }),
    );
    render(<Harness gateway={gateway} />);
    await waitFor(() => expect(gateway.generateKey).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole("textbox", { name: "p · số nguyên tố" }), {
      target: { value: "19" },
    });
    await act(async () => resolveKey(keyResult));
    expect(screen.queryByText("{7, 187}")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mã hóa rồi giải mã" })).toBeDisabled();
  });
});

function deferred<Result>() {
  let resolve!: (result: Result) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Result>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("RSA request lifecycle", () => {
  it("uses only the latest preset key and does not rerun dependent examples", async () => {
    const gateway = createGateway();
    const { result } = renderHook(() => useRsaCipher(gateway, true));
    await waitFor(() => expect(result.current.statuses.text).toBe("success"));
    const oldKey = deferred<RsaKeyResult>();
    const latestKey = deferred<RsaKeyResult>();
    vi.mocked(gateway.generateKey)
      .mockReturnValueOnce(oldKey.promise)
      .mockReturnValueOnce(latestKey.promise);
    const oldParameters = { p: "61", q: "53", e: "17" };
    const latestParameters = { p: "101", q: "113", e: "3533" };
    act(() => result.current.choosePreset(oldParameters));
    const oldSignal = vi.mocked(gateway.generateKey).mock.calls[1][1];
    act(() => result.current.choosePreset(latestParameters));
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.numberResult).toBeNull();
    expect(result.current.textResult).toBeNull();
    const latestResult = { ...keyResult, ...latestParameters, n: "11413", phi: "11200", d: "6597" };
    await act(async () => latestKey.resolve(latestResult));
    await act(async () => oldKey.resolve({ ...keyResult, ...oldParameters, n: "3233" }));
    expect(result.current.key).toEqual(latestResult);
    expect(result.current.draft).toMatchObject(latestParameters);
    expect(gateway.roundTripNumber).toHaveBeenCalledTimes(1);
    expect(gateway.roundTripText).toHaveBeenCalledTimes(1);
  });

  it("discards number and text responses after their inputs change independently", async () => {
    const gateway = createGateway();
    const number = deferred<RsaNumberResult>();
    const text = deferred<RsaTextResult>();
    vi.mocked(gateway.roundTripNumber).mockReturnValueOnce(number.promise);
    vi.mocked(gateway.roundTripText).mockReturnValueOnce(text.promise);
    const { result } = renderHook(() => useRsaCipher(gateway, true));
    await waitFor(() => expect(result.current.statuses.text).toBe("loading"));
    const numberSignal = vi.mocked(gateway.roundTripNumber).mock.calls[0][1];
    const textSignal = vi.mocked(gateway.roundTripText).mock.calls[0][1];
    act(() => result.current.setPlaintext("0"));
    expect(numberSignal.aborted).toBe(true);
    expect(textSignal.aborted).toBe(false);
    expect(result.current.key).toEqual(keyResult);
    act(() => result.current.setText("new text"));
    expect(textSignal.aborted).toBe(true);
    await act(async () => {
      number.resolve({
        plaintext: "88",
        ciphertext: "11",
        decrypted: "88",
        plaintextInRange: true,
        encryptRows: [],
        decryptRows: [],
      });
      text.reject(new RsaGatewayError("Old error"));
    });
    expect(result.current.numberResult).toBeNull();
    expect(result.current.textResult).toBeNull();
    expect(result.current.statuses).toEqual({ key: "success", number: "idle", text: "idle" });
    expect(result.current.taskErrors.text).toBeUndefined();
  });

  it("preserves drafts when switching away, cancels requests and does not auto-run on return", async () => {
    const gateway = createGateway();
    const { result, rerender } = renderHook(({ active }) => useRsaCipher(gateway, active), {
      initialProps: { active: true },
    });
    await waitFor(() => expect(result.current.statuses.text).toBe("success"));
    act(() => result.current.setPlaintext("0"));
    act(() => result.current.setText("à 😀"));
    const pending = deferred<RsaNumberResult>();
    vi.mocked(gateway.roundTripNumber).mockReturnValueOnce(pending.promise);
    act(() => result.current.processNumber());
    const signal = vi.mocked(gateway.roundTripNumber).mock.calls[1][1];
    rerender({ active: false });
    expect(signal.aborted).toBe(true);
    expect(result.current.key).toBeNull();
    expect(result.current.draft).toMatchObject({ plaintext: "0", text: "à 😀" });
    await act(async () =>
      pending.resolve({
        plaintext: "0",
        ciphertext: "0",
        decrypted: "0",
        plaintextInRange: true,
        encryptRows: [],
        decryptRows: [],
      }),
    );
    rerender({ active: true });
    expect(result.current.numberResult).toBeNull();
    expect(gateway.generateKey).toHaveBeenCalledTimes(1);
  });

  it("resets drafts and discards a key response that arrives after reset", async () => {
    const gateway = createGateway();
    const pending = deferred<RsaKeyResult>();
    vi.mocked(gateway.generateKey).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useRsaCipher(gateway, true));
    const signal = vi.mocked(gateway.generateKey).mock.calls[0][1];
    act(() => result.current.setText("changed"));
    act(() => result.current.resetAll());
    await act(async () => pending.resolve(keyResult));
    expect(signal.aborted).toBe(true);
    expect(result.current.draft).toEqual({
      p: "17",
      q: "11",
      e: "7",
      plaintext: "88",
      text: "Xin chao",
    });
    expect(result.current.key).toBeNull();
    expect(result.current.statuses).toEqual({ key: "idle", number: "idle", text: "idle" });
    expect(gateway.roundTripNumber).not.toHaveBeenCalled();
    expect(gateway.roundTripText).not.toHaveBeenCalled();
  });

  it("shows a Backend business error and allows retry without local results", async () => {
    const gateway = createGateway();
    vi.mocked(gateway.generateKey).mockRejectedValueOnce(
      new RsaGatewayError("e không khả nghịch."),
    );
    render(<Harness gateway={gateway} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("e không khả nghịch.");
    expect(screen.getByRole("button", { name: "Mã hóa rồi giải mã" })).toBeDisabled();
    expect(gateway.roundTripNumber).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sinh khóa" }));
    expect(await screen.findByText("{7, 187}")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(gateway.roundTripNumber).not.toHaveBeenCalled();
  });
});

describe("RSA result semantics", () => {
  it.each([
    ["187", false, "P ≥ n nên chỉ khôi phục được P mod n = 0."],
    ["0", true, "Giải mã khôi phục đúng P = 0."],
  ])(
    "renders the Backend result for P=%s with the correct notice",
    async (plaintext, inRange, notice) => {
      const gateway = createGateway();
      render(<Harness gateway={gateway} />);
      await screen.findByText("Giải mã khôi phục đúng P = 88.");
      vi.mocked(gateway.roundTripNumber).mockResolvedValueOnce({
        plaintext,
        ciphertext: "0",
        decrypted: "0",
        plaintextInRange: inRange,
        encryptRows: [],
        decryptRows: [],
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Bản rõ P (số)" }), {
        target: { value: plaintext },
      });
      fireEvent.click(screen.getByRole("button", { name: "Mã hóa rồi giải mã" }));
      const message = await screen.findByText(notice);
      expect(message).toHaveClass(inRange ? "rsa__message--success" : "rsa__message--error");
      expect(gateway.roundTripNumber).toHaveBeenLastCalledWith(
        { p: "17", q: "11", e: "7", plaintext },
        expect.any(AbortSignal),
      );
    },
  );

  it("preserves Unicode, spaces, newlines and HTML characters from the Backend rows", async () => {
    const gateway = createGateway();
    render(<Harness gateway={gateway} />);
    await screen.findByText(/1 ký tự có mã ≥ n/);
    const text = "à 😀<&\n";
    // Test fixture mirrors the Backend's code-point DTO; the FE must not split or recalculate it.
    const rows = [
      { character: "à", plaintext: "224", ciphertext: "51", decrypted: "37", recovered: false },
      { character: " ", plaintext: "32", ciphertext: "76", decrypted: "32", recovered: true },
      { character: "😀", plaintext: "128512", ciphertext: "0", decrypted: "43", recovered: false },
      { character: "<", plaintext: "60", ciphertext: "51", decrypted: "60", recovered: true },
      { character: "&", plaintext: "38", ciphertext: "0", decrypted: "38", recovered: true },
      { character: "\n", plaintext: "10", ciphertext: "0", decrypted: "10", recovered: true },
    ];
    vi.mocked(gateway.roundTripText).mockResolvedValueOnce({ rows, invalidCount: 2 });
    fireEvent.change(screen.getByRole("textbox", { name: "Thông điệp" }), {
      target: { value: text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mã hóa văn bản" }));
    expect(await screen.findByText(/2 ký tự có mã ≥ n/)).toBeVisible();
    const table = screen.getByRole("table", { name: "Kết quả mã hóa từng ký tự" });
    expect(within(table).getAllByRole("row")).toHaveLength(rows.length + 1);
    expect(within(table).getByText("😀")).toBeVisible();
    expect(within(table).getAllByText("␣")).toHaveLength(2);
    expect(within(table).getAllByText("<")).toHaveLength(2);
    expect(within(table).getAllByText("&")).toHaveLength(2);
    expect(table.querySelector("script")).toBeNull();
    expect(screen.queryByText(/Bản mã gửi đi:/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Thông điệp" })).toHaveValue(text);
    expect(gateway.roundTripText).toHaveBeenLastCalledWith(
      { p: "17", q: "11", e: "7", text },
      expect.any(AbortSignal),
    );
  });
});
