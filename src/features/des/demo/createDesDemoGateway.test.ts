import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesRequest } from "../types/cipher";
import { createDesDemoGateway } from "./createDesDemoGateway";

afterEach(() => vi.useRealTimers());

describe("DES demo fixtures", () => {
  it.each(["encrypt", "decrypt"] as const)(
    "delays %s text/file fixtures without network or reading file",
    async (operation) => {
      vi.useFakeTimers();
      const fetch = vi.spyOn(globalThis, "fetch");
      const read = vi.spyOn(FileReader.prototype, "readAsText");
      const gateway = createDesDemoGateway();
      const controller = new AbortController();
      const request: DesRequest = { operation, inputMode: "text", text: "secret", key: "key" };
      const text = gateway.process(request, controller.signal);
      const file = gateway.process(
        { operation, inputMode: "file", file: new File([], "secret.bin"), key: "different" },
        controller.signal,
      );
      await vi.advanceTimersByTimeAsync(500);
      expect((await text).text).toContain("Dữ liệu mô phỏng");
      expect((await text).text).not.toContain("secret");
      expect((await file).attachment?.filename).toBe(`des-demo-${operation}.txt`);
      expect(fetch).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("rejects pre-aborted and in-flight requests without waiting for timer", async () => {
    vi.useFakeTimers();
    const gateway = createDesDemoGateway();
    const request: DesRequest = { operation: "encrypt", inputMode: "text", text: "x", key: "k" };
    const controller = new AbortController();
    const pending = gateway.process(request, controller.signal);
    const check = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await check;
    expect(vi.getTimerCount()).toBe(0);
    await expect(gateway.process(request, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
