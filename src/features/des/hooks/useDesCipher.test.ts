import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesGatewayError, type DesGateway } from "../services/desGateway";
import type { DesResult } from "../types/cipher";
import { createDesGateway } from "../test/createDesGateway";
import { useDesCipher } from "./useDesCipher";

afterEach(() => vi.restoreAllMocks());

function deferred() {
  let resolve!: (value: DesResult) => void;
  const promise = new Promise<DesResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("DES draft and gateway lifecycle", () => {
  it("blocks missing input and key; accepts whitespace text and preserves raw key", async () => {
    const gateway = createDesGateway();
    const { result } = renderHook(() => useDesCipher(gateway));
    await act(async () => result.current.processCipher());
    expect(result.current.fieldErrors).toEqual({
      input: "Vui lòng nhập nội dung.",
      key: "Vui lòng nhập khóa DES.",
    });
    expect(gateway.process).not.toHaveBeenCalled();
    act(() => {
      result.current.setText(" \n");
      result.current.setKey("  arbitrary key  ");
    });
    await act(async () => result.current.processCipher());
    expect(gateway.process).toHaveBeenCalledWith(
      { operation: "encrypt", inputMode: "text", text: " \n", key: "  arbitrary key  " },
      expect.any(AbortSignal),
    );
    expect(result.current.result?.text).toBe(" \nMẫu tiếng Việt\n ");
  });

  it("submits binary and empty files without reading them or including the text draft", async () => {
    const gateway = createDesGateway();
    const { result } = renderHook(() => useDesCipher(gateway));
    const file = new File([new Uint8Array([0xff, 0, 0xfe])], "binary.des");
    const reader = vi.spyOn(FileReader.prototype, "readAsText");
    act(() => {
      result.current.setText("retained draft");
      result.current.setKey("k");
      result.current.setInputType("file");
      result.current.setFile(file);
      result.current.setMode("decrypt");
    });
    await act(async () => result.current.processCipher());
    expect(gateway.process).toHaveBeenCalledWith(
      { operation: "decrypt", inputMode: "file", file, key: "k" },
      expect.any(AbortSignal),
    );
    expect(reader).not.toHaveBeenCalled();
    act(() => result.current.setFile(new File([], "empty.bin")));
    await act(async () => result.current.processCipher());
    expect(gateway.process).toHaveBeenCalledTimes(2);
  });

  it("locks mutations and double submit, cancels reset, ignores stale completion", async () => {
    const first = deferred();
    const second = deferred();
    const process = vi
      .fn<DesGateway["process"]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useDesCipher({ process }));
    act(() => {
      result.current.setText("original");
      result.current.setKey("k");
    });
    let pending!: ReturnType<typeof result.current.processCipher>;
    act(() => {
      pending = result.current.processCipher();
      void result.current.processCipher();
      result.current.setText("blocked");
    });
    expect(process).toHaveBeenCalledTimes(1);
    expect(result.current.text).toBe("original");
    act(() => result.current.resetAll());
    expect(process.mock.calls[0][1].aborted).toBe(true);
    act(() => {
      result.current.setText("new");
      result.current.setKey("k2");
    });
    let next!: ReturnType<typeof result.current.processCipher>;
    act(() => {
      next = result.current.processCipher();
    });
    await act(async () => {
      first.resolve({ text: "stale", attachment: null });
      await pending;
    });
    expect(result.current.isBusy).toBe(true);
    expect(result.current.result).toBeNull();
    await act(async () => {
      second.resolve({ text: "current", attachment: null });
      await next;
    });
    expect(result.current.result?.text).toBe("current");
    expect(result.current.isBusy).toBe(false);
  });

  it("preserves draft on deactivation, clears errors/results and aborts requests", async () => {
    const task = deferred();
    const process = vi.fn<DesGateway["process"]>().mockReturnValue(task.promise);
    const { result, rerender } = renderHook(({ active }) => useDesCipher({ process }, active), {
      initialProps: { active: true },
    });
    act(() => {
      result.current.setText("draft");
      result.current.setKey("key");
    });
    let pending!: ReturnType<typeof result.current.processCipher>;
    act(() => {
      pending = result.current.processCipher();
    });
    rerender({ active: false });
    expect(process.mock.calls[0][1].aborted).toBe(true);
    expect(result.current).toMatchObject({
      text: "draft",
      key: "key",
      status: "idle",
      result: null,
    });
    await act(async () => {
      task.resolve({ text: "stale", attachment: null });
      await pending;
    });
    rerender({ active: true });
    expect(result.current.result).toBeNull();
  });

  it("aborts on unmount", () => {
    const process = vi.fn<DesGateway["process"]>().mockReturnValue(new Promise(() => {}));
    const { result, unmount } = renderHook(() => useDesCipher({ process }));
    act(() => {
      result.current.setText("x");
      result.current.setKey("k");
    });
    act(() => {
      void result.current.processCipher();
    });
    unmount();
    expect(process.mock.calls[0][1].aborted).toBe(true);
  });

  it("maps trusted field errors, clears them on edits and retries without fallback", async () => {
    const process = vi
      .fn<DesGateway["process"]>()
      .mockRejectedValueOnce(new DesGatewayError("Khóa bị từ chối.", "key"))
      .mockRejectedValueOnce(new Error("raw stack secret"));
    const { result } = renderHook(() => useDesCipher({ process }));
    act(() => {
      result.current.setText("x");
      result.current.setKey("k");
    });
    await act(async () => result.current.processCipher());
    expect(result.current.fieldErrors.key).toBe("Khóa bị từ chối.");
    expect(result.current.isBusy).toBe(false);
    act(() => result.current.setKey("new"));
    expect(result.current.fieldErrors).toEqual({});
    await act(async () => result.current.processCipher());
    expect(result.current.notice?.message).toBe("Không thể xử lý yêu cầu. Vui lòng thử lại.");
    expect(result.current.result).toBeNull();
    expect(process).toHaveBeenCalledTimes(2);
  });

  it("clears derived output on mode/source changes and scopes reset actions", async () => {
    const { result } = renderHook(() => useDesCipher(createDesGateway()));
    const file = new File([], "draft.bin");
    act(() => {
      result.current.setText("x");
      result.current.setKey("k");
      result.current.setFile(file);
    });
    await act(async () => result.current.processCipher());
    act(() => result.current.setMode("decrypt"));
    expect(result.current.result).toBeNull();
    await act(async () => result.current.processCipher());
    act(() => result.current.setInputType("file"));
    expect(result.current.result).toBeNull();
    act(() => result.current.resetInput());
    expect(result.current).toMatchObject({ text: "x", file: null, key: "k" });
    act(() => result.current.resetAll());
    expect(result.current).toMatchObject({
      text: "",
      key: "",
      file: null,
      mode: "encrypt",
      inputType: "text",
    });
  });

  it("copy preserves exact response and utility errors retain output", async () => {
    const { result } = renderHook(() => useDesCipher(createDesGateway()));
    act(() => {
      result.current.setText("x");
      result.current.setKey("k");
    });
    await act(async () => result.current.processCipher());
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await act(async () => result.current.copyResult());
    expect(copy).toHaveBeenCalledWith(" \nMẫu tiếng Việt\n ");
    copy.mockRejectedValueOnce(new Error("denied"));
    await act(async () => result.current.copyResult());
    expect(result.current.result?.text).toBe(" \nMẫu tiếng Việt\n ");
    expect(result.current.notice?.kind).toBe("error");
  });

  it("downloads original binary Blob with no preview and revokes its URL", async () => {
    vi.useFakeTimers();
    try {
      const blob = new Blob([new Uint8Array([0xff, 0, 0xfe])], {
        type: "application/octet-stream",
      });
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:des"),
      });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        expect(this.download).toBe("result.des");
      });
      const { result } = renderHook(() =>
        useDesCipher(
          createDesGateway({
            process: vi
              .fn()
              .mockResolvedValue({ text: null, attachment: { blob, filename: "result.des" } }),
          }),
        ),
      );
      act(() => {
        result.current.setText("x");
        result.current.setKey("k");
      });
      await act(async () => result.current.processCipher());
      await act(async () => result.current.downloadResult());
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(click).toHaveBeenCalledOnce();
      act(() => vi.runAllTimers());
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:des");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retain old data on empty or malformed response", async () => {
    const process = vi
      .fn<DesGateway["process"]>()
      .mockResolvedValueOnce({ text: "old", attachment: null })
      .mockResolvedValueOnce({ text: "", attachment: null })
      .mockResolvedValueOnce(JSON.parse('{"text":4,"attachment":null}'));
    const { result } = renderHook(() => useDesCipher({ process }));
    act(() => {
      result.current.setText("x");
      result.current.setKey("k");
    });
    await act(async () => result.current.processCipher());
    await act(async () => result.current.processCipher());
    expect(result.current.result?.text).toBe("");
    await act(async () => result.current.processCipher());
    expect(result.current.result).toBeNull();
    expect(result.current.status).toBe("error");
  });

  it("keeps output and releases Blob URL when download fails", async () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:failed"),
      });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
        throw new Error("download denied");
      });
      const attachment = { blob: new Blob(["fixture"]), filename: "demo.txt" };
      const { result } = renderHook(() =>
        useDesCipher(
          createDesGateway({ process: vi.fn().mockResolvedValue({ text: "fixture", attachment }) }),
        ),
      );
      act(() => {
        result.current.setText("x");
        result.current.setKey("k");
      });
      await act(async () => result.current.processCipher());
      await act(async () => result.current.downloadResult());
      expect(result.current.result?.attachment).toBe(attachment);
      expect(result.current.notice).toEqual({ kind: "error", message: "Không thể tải kết quả." });
      act(() => vi.runAllTimers());
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:failed");
    } finally {
      vi.useRealTimers();
    }
  });
});
