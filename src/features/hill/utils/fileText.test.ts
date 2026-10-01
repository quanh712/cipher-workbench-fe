import { describe, expect, it } from "vitest";
import { HILL_FILE_MAX_BYTES, readHillFile, validateHillFile } from "./fileText";

describe("Hill text files", () => {
  it("accepts the byte limit and rejects wrong extensions and oversized files", () => {
    expect(HILL_FILE_MAX_BYTES).toBe(5_242_880);
    expect(validateHillFile(new File([new Uint8Array(HILL_FILE_MAX_BYTES)], "a.TXT"))).toBeNull();
    expect(validateHillFile(new File([new Uint8Array(HILL_FILE_MAX_BYTES + 1)], "a.txt"))).toBe(
      "Văn bản vượt quá giới hạn 5 MiB.",
    );
    expect(validateHillFile(new File(["hello"], "a.pdf"))).toBe("Chỉ chấp nhận file .txt.");
  });

  it("decodes strict UTF-8 and rejects invalid bytes", async () => {
    await expect(
      readHillFile(new File([new Uint8Array([0xef, 0xbb, 0xbf]), "Tiếng Việt"], "a.txt")),
    ).resolves.toBe("Tiếng Việt");
    await expect(readHillFile(new File(["\uFEFF\uFEFFHELP"], "two-boms.txt"))).resolves.toBe(
      "\uFEFFHELP",
    );
    await expect(readHillFile(new File([new Uint8Array([0xff])], "a.txt"))).rejects.toThrow();
  });
});
