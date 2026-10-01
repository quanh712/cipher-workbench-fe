import { describe, expect, it } from "vitest";
import type { DesDraft } from "../types/cipher";
import { DES_MAX_INPUT_BYTES, validateDesDraft } from "./validation";

const draft: DesDraft = {
  mode: "encrypt",
  inputType: "text",
  text: " \n",
  file: null,
  key: "133457799BBCDFF1",
  cipherMode: "ECB",
  format: "text",
  iv: "",
};

describe("DES official validation", () => {
  it("allows ASCII whitespace/lowercase key and whitespace plaintext without rewriting", () => {
    expect(validateDesDraft({ ...draft, key: "13345779\t9bbcdff1" }, false)).toEqual({});
    expect(validateDesDraft({ ...draft, key: "13345779\u00a09bbcdff1" }, false).key).toMatch(/hex/);
    expect(validateDesDraft({ ...draft, key: "not hex" }, false).key).toBeDefined();
  });
  it("requires valid IV only for CBC and hex blocks for decrypt/raw hex", () => {
    expect(validateDesDraft({ ...draft, iv: "bad" }, false)).toEqual({});
    expect(validateDesDraft({ ...draft, cipherMode: "CBC" }, false).iv).toBeDefined();
    expect(
      validateDesDraft({ ...draft, cipherMode: "CBC", iv: "00000000 00000000" }, false),
    ).toEqual({});
    expect(validateDesDraft({ ...draft, mode: "decrypt" }, false).input).toBeDefined();
    expect(
      validateDesDraft({ ...draft, mode: "decrypt", text: "85e81354\n0f0ab405" }, false),
    ).toEqual({});
    expect(validateDesDraft({ ...draft, format: "hex", text: "0123" }, false).input).toMatch(/bội/);
  });
  it("counts UTF-8 bytes before hex cleaning and accepts the exact 5 MiB boundary", () => {
    const text = "A".repeat(DES_MAX_INPUT_BYTES);
    expect(validateDesDraft({ ...draft, text }, false)).toEqual({});
    expect(validateDesDraft({ ...draft, text: text + "é" }, false).input).toBe(
      "Dữ liệu vượt quá 5 MiB.",
    );
  });
  it("checks file extension, exact raw size including BOM and empty files", () => {
    const base = { ...draft, inputType: "file" as const };
    expect(validateDesDraft({ ...base, file: new File(["x"], "file.des") }, false).file).toMatch(
      /\.txt/,
    );
    expect(validateDesDraft({ ...base, file: new File([], "file.txt") }, false).file).toBe(
      "File không được để trống.",
    );
    expect(
      validateDesDraft(
        { ...base, file: new File([new Uint8Array(DES_MAX_INPUT_BYTES)], "file.TXT") },
        false,
      ),
    ).toEqual({});
    expect(
      validateDesDraft(
        { ...base, file: new File([new Uint8Array(DES_MAX_INPUT_BYTES + 1)], "file.txt") },
        false,
      ).file,
    ).toMatch(/5 MB/);
    expect(
      validateDesDraft(
        { ...base, file: new File([new Uint8Array([0xef, 0xbb, 0xbf])], "bom.txt") },
        false,
      ),
    ).toEqual({});
  });
});
