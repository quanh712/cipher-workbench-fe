import { describe, expect, it } from "vitest";
import { keywordMatrix, validateHillKey, validateHillText } from "./validation";

describe("Hill FE validation", () => {
  it("sends raw signed integers and displays normalized values", () => {
    expect(
      validateHillKey(
        2,
        "grid",
        [
          ["-3", "29"],
          ["2", "5"],
        ],
        "",
      ),
    ).toMatchObject({
      payload: {
        key: [
          [-3, 29],
          [2, 5],
        ],
      },
      matrix: [
        [23, 3],
        [2, 5],
      ],
      error: null,
    });
    expect(
      validateHillKey(
        2,
        "grid",
        [
          ["9007199254740992", "3"],
          ["2", "5"],
        ],
        "",
      ).badCell,
    ).toEqual([0, 0]);
    expect(
      validateHillKey(
        2,
        "grid",
        [
          ["3", "a"],
          ["2", "5"],
        ],
        "",
      ).error,
    ).toBe("Ô hàng 1 cột 2 phải là số nguyên.");
  });

  it("requires exactly m² ASCII letters for a keyword", () => {
    expect(keywordMatrix("HILL", 2)).toEqual([
      [7, 8],
      [11, 11],
    ]);
    expect(validateHillKey(2, "keyword", [], "HIL").error).toBe(
      "Từ khóa cần đúng 4 chữ cái, hiện có 3.",
    );
    expect(validateHillKey(2, "keyword", [], "HÍLL").payload).toBeNull();
  });

  it("rejects blank input but leaves nonletter input to Backend", () => {
    expect(validateHillText(" \n ")).toBe("Nhập văn bản hoặc tải file .txt để bắt đầu.");
    expect(validateHillText("123")).toBeNull();
  });

  it("accepts exactly 5 MiB of UTF-8 and rejects one extra byte before normalization", () => {
    const asciiLimit = "A".repeat(5_242_880);
    const unicodeLimit = "ế".repeat(1_747_626) + "AA";
    expect(validateHillText(asciiLimit)).toBeNull();
    expect(validateHillText(asciiLimit + "A")).toBe("Văn bản vượt quá giới hạn 5 MiB.");
    expect(validateHillText(unicodeLimit)).toBeNull();
    expect(validateHillText(unicodeLimit + "A")).toBe("Văn bản vượt quá giới hạn 5 MiB.");
    expect(validateHillText(" ".repeat(5_242_881))).toBe("Văn bản vượt quá giới hạn 5 MiB.");
  });
});
