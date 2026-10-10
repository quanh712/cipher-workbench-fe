import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createHillGateway, exampleKey } from "../test/createHillGateway";
import { useHillCipher } from "./useHillCipher";

describe("useHillCipher analysis state", () => {
  it("debounces rapid key edits and blocks submit until the matching analysis arrives", async () => {
    const gateway = createHillGateway();
    const { result } = renderHook(() => useHillCipher(gateway, true));
    act(() => result.current.loadExample());
    await waitFor(() => expect(gateway.analyze).toHaveBeenCalledTimes(1));
    act(() => result.current.setText("HELP"));
    await waitFor(() => expect(result.current.canSubmit).toBe(true));

    for (const value of ["31", "312", "3123", "31234", "312345"]) {
      act(() => result.current.setMatrixCell(0, 0, value));
      expect(result.current.canSubmit).toBe(false);
    }
    await waitFor(() => expect(gateway.analyze).toHaveBeenCalledTimes(2));
    expect(gateway.analyze).toHaveBeenLastCalledWith(
      {
        key: [
          [312345, 3],
          [2, 5],
        ],
      },
      expect.any(AbortSignal),
    );
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
  });

  it("aborts a superseded request and ignores its late response", async () => {
    let resolveOld!: (value: { success: true; result: typeof exampleKey; warnings: [] }) => void;
    const old = new Promise<{ success: true; result: typeof exampleKey; warnings: [] }>(
      (resolve) => {
        resolveOld = resolve;
      },
    );
    const analyze = vi
      .fn()
      .mockReturnValueOnce(old)
      .mockResolvedValue({ success: true, result: exampleKey, warnings: [] });
    const gateway = createHillGateway({ analyze });
    const { result } = renderHook(() => useHillCipher(gateway, true));
    act(() => result.current.loadExample());
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    const oldSignal = analyze.mock.calls[0][1] as AbortSignal;
    act(() => result.current.setMatrixCell(0, 0, "5"));
    expect(oldSignal.aborted).toBe(true);
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveOld({ success: true, result: exampleKey, warnings: [] });
      await old;
    });
    expect(result.current.keyValidation.payload).toEqual({
      key: [
        [5, 3],
        [2, 5],
      ],
    });
    expect(result.current.analysis.status).toBe("valid");
    expect(result.current.analysis.fingerprint).toBe(
      JSON.stringify({
        key: [
          [5, 3],
          [2, 5],
        ],
      }),
    );
  });
});

describe("Hill processing notifications", () => {
  it.each(["encrypt", "decrypt"] as const)("announces successful %s", async (mode) => {
    const { result } = renderHook(() => useHillCipher(createHillGateway(), true));
    act(() => result.current.loadExample());
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    act(() => {
      result.current.setMode(mode);
      result.current.setText("HELP");
    });
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    await act(async () => result.current.processCipher());
    expect(result.current.notice).toEqual({
      kind: "success",
      message: mode === "encrypt" ? "Mã hóa thành công." : "Giải mã thành công.",
    });
  });
});
