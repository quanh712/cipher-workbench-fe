import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesGatewayError, type DesGateway } from "../services/desGateway";
import type { DesResult } from "../types/cipher";
import { useDesCipher } from "./useDesCipher";

const key = "133457799BBCDFF1";
afterEach(() => vi.restoreAllMocks());

describe("DES real gateway controller", () => {
  it("validates options, sends raw CBC settings and invalidates result on changes", async () => {
    const process = vi
      .fn<DesGateway["process"]>()
      .mockResolvedValue({ text: "ciphertext", attachment: null, warnings: [] });
    const { result } = renderHook(() => useDesCipher({ kind: "api", process }));
    act(() => {
      result.current.setText("Hello World");
      result.current.setKey(key);
      result.current.setCipherMode("CBC");
    });
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setIv(" 00000000 00000000 "));
    expect(result.current.canSubmit).toBe(true);
    await act(async () => result.current.processCipher());
    expect(process).toHaveBeenCalledWith(
      {
        inputMode: "text",
        operation: "encrypt",
        text: "Hello World",
        key,
        cipherMode: "CBC",
        format: "text",
        iv: " 00000000 00000000 ",
      },
      expect.any(AbortSignal),
    );
    expect(result.current.resultOptions?.iv).toBe(" 00000000 00000000 ");
    act(() => result.current.setFormat("hex"));
    expect(result.current.result).toBeNull();
    expect(result.current.canSubmit).toBe(false);
  });

  it("uses a second gateway request on download, locks edits and retains preview on failure", async () => {
    const file = new File(["Hello"], "hello.txt");
    const process = vi
      .fn<DesGateway["process"]>()
      .mockResolvedValue({ text: "preview", attachment: null, warnings: [] });
    const download = vi
      .fn<NonNullable<DesGateway["download"]>>()
      .mockRejectedValue(new DesGatewayError("File phải sử dụng UTF-8."));
    const { result } = renderHook(() => useDesCipher({ kind: "api", process, download }));
    act(() => {
      result.current.setInputType("file");
      result.current.setFile(file);
      result.current.setKey(key);
    });
    await act(async () => result.current.processCipher());
    expect(download).not.toHaveBeenCalled();
    expect(result.current.canDownload).toBe(true);
    await act(async () => {
      const pending = result.current.downloadResult();
      result.current.setKey("blocked");
      await pending;
    });
    expect(result.current.key).toBe(key);
    expect(download).toHaveBeenCalledWith(
      { inputMode: "file", operation: "encrypt", file, key, cipherMode: "ECB", format: "text" },
      expect.any(AbortSignal),
    );
    expect(result.current.result?.text).toBe("preview");
    expect(result.current.notice?.message).toBe("File phải sử dụng UTF-8.");
    expect(result.current.isBusy).toBe(false);
  });

  it("warns before round-trip size overflow and accepts text at the supported boundary", () => {
    const { result } = renderHook(() => useDesCipher({ kind: "api", process: vi.fn() }));
    act(() => {
      result.current.setKey(key);
      result.current.setText("a".repeat(2_621_439));
    });
    expect(result.current.roundTripWarning).toBe(false);
    act(() => result.current.setText("a".repeat(2_621_440)));
    expect(result.current.roundTripWarning).toBe(true);
    expect(result.current.canSubmit).toBe(true);
  });

  it("aborts a pending download when leaving the workspace and ignores its response", async () => {
    let complete!: (value: { blob: Blob; filename: string }) => void;
    const download = vi.fn<NonNullable<DesGateway["download"]>>().mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const gateway: DesGateway = {
      kind: "api",
      process: vi.fn().mockResolvedValue({ text: "preview", attachment: null } satisfies DesResult),
      download,
    };
    const { result, rerender } = renderHook(({ active }) => useDesCipher(gateway, active), {
      initialProps: { active: true },
    });
    act(() => {
      result.current.setInputType("file");
      result.current.setFile(new File(["Hello"], "hello.txt"));
      result.current.setKey(key);
    });
    await act(async () => result.current.processCipher());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.downloadResult();
    });
    rerender({ active: false });
    expect(download.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      complete({ blob: new Blob(["stale"]), filename: "stale.txt" });
      await pending;
    });
    expect(result.current.result).toBeNull();
    expect(result.current.notice).toBeNull();
  });
});
