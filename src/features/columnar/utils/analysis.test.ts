import { describe, expect, it } from "vitest";
import { buildColumnarAnalysis } from "./analysis";
import { parseColumnarKey } from "./validation";

function key(raw: string) {
  const parsed = parseColumnarKey(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

describe("Columnar result analysis", () => {
  it("shows physical column lengths and exact source matrix", () => {
    expect(
      buildColumnarAnalysis({
        sourceText: "ABCDE",
        result: "BDAEC",
        mode: "encrypt",
        key: key("3 1 4 2"),
      }),
    ).toMatchObject({
      codePointCount: 5,
      columnLengths: [2, 1, 1, 1],
      readOrder: [2, 4, 1, 3],
      rows: [
        ["A", "B", "C", "D"],
        ["E", null, null, null],
      ],
    });
  });

  it("uses Unicode code points and preserves whitespace in both modes", () => {
    const encrypted = buildColumnarAnalysis({
      sourceText: "😀A𝄞é",
      result: "A😀é𝄞",
      mode: "encrypt",
      key: key("2 1 3"),
    });
    expect(encrypted).toMatchObject({ codePointCount: 4, columnLengths: [2, 1, 1] });
    expect(encrypted?.rows[0]).toEqual(["😀", "A", "𝄞"]);
    const decrypted = buildColumnarAnalysis({
      sourceText: " \nA\r!BC",
      result: "A B\r\nC!",
      mode: "decrypt",
      key: key("2 1 3"),
    });
    expect(decrypted?.rows).toEqual([
      ["A", " ", "B"],
      ["\r", "\n", "C"],
      ["!", null, null],
    ]);
  });

  it("allows empty results for a BOM-only file and previews after 200 code points", () => {
    expect(
      buildColumnarAnalysis({ sourceText: "", result: "", mode: "encrypt", key: key("2 1") }),
    ).toMatchObject({ codePointCount: 0, rows: [] });
    const full = buildColumnarAnalysis({
      sourceText: "😀".repeat(200),
      result: "😀".repeat(200),
      mode: "encrypt",
      key: key("2 1"),
    });
    const preview = buildColumnarAnalysis({
      sourceText: "😀".repeat(201),
      result: "😀".repeat(201),
      mode: "encrypt",
      key: key("2 1"),
    });
    expect(full?.rows).toHaveLength(100);
    expect(preview).toMatchObject({ isPreview: true, totalRows: 101 });
    expect(preview?.rows).toHaveLength(10);
    expect(Array.from(preview?.sourcePreview ?? "")).toHaveLength(80);
    expect(
      buildColumnarAnalysis({ sourceText: "abc", result: "ab", mode: "encrypt", key: key("2 1") }),
    ).toBeNull();
  });
});
