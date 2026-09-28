import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { shiftText } from "../features/caesar/utils/caesar";
import { transformAffineForAnalysis } from "../features/affine/utils/analysis";
import { normalizeAffineKey } from "../features/affine/utils/validation";
import { buildPlayfairMatrix, preparePlayfairDigraphs } from "../features/playfair/utils/analysis";

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("cipher-workbench-theme");
  delete document.documentElement.dataset.theme;
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    readText: vi.fn().mockResolvedValue("Nội dung clipboard"),
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

function vigenere(text: string, key: string, decrypt: boolean) {
  const normalizedKey = key.toUpperCase();
  let keyIndex = 0;
  return Array.from(text)
    .map((character) => {
      const code = character.charCodeAt(0);
      const base = code >= 65 && code <= 90 ? 65 : code >= 97 && code <= 122 ? 97 : null;
      if (base === null) return character;
      const shift = normalizedKey.charCodeAt(keyIndex % normalizedKey.length) - 65;
      keyIndex += 1;
      return String.fromCharCode(
        base + ((((code - base + (decrypt ? -shift : shift)) % 26) + 26) % 26),
      );
    })
    .join("");
}

function playfair(text: string, key: string, decrypt: boolean) {
  const matrix = buildPlayfairMatrix(key);
  const positions = new Map<string, [number, number]>();
  matrix.forEach((row, rowIndex) =>
    row.forEach((letter, columnIndex) => positions.set(letter, [rowIndex, columnIndex])),
  );
  const result = preparePlayfairDigraphs(text, decrypt ? "decrypt" : "encrypt")
    .map((pair) => {
      const [firstRow, firstColumn] = positions.get(pair[0])!;
      const [secondRow, secondColumn] = positions.get(pair[1])!;
      const direction = decrypt ? -1 : 1;
      if (firstRow === secondRow) {
        return (
          matrix[firstRow][(firstColumn + direction + 5) % 5] +
          matrix[secondRow][(secondColumn + direction + 5) % 5]
        );
      }
      if (firstColumn === secondColumn) {
        return (
          matrix[(firstRow + direction + 5) % 5][firstColumn] +
          matrix[(secondRow + direction + 5) % 5][secondColumn]
        );
      }
      return matrix[firstRow][secondColumn] + matrix[secondRow][firstColumn];
    })
    .join("");

  if (!decrypt) return result;
  if (result.endsWith("XQ")) return result.slice(0, -1);
  if (result.endsWith("X")) return result.slice(0, -1);
  return result;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readFile(file: File) {
  if (typeof file.text === "function") return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  const url = String(input);
  const cipher = url.includes("/vigenere/")
    ? "vigenere"
    : url.includes("/playfair/")
      ? "playfair"
      : url.includes("/affine/")
        ? "affine"
        : url.includes("/columnar/")
          ? "columnar"
          : "caesar";
  const decrypt = url.includes("/decrypt");

  if (url.endsWith("/file")) {
    const form = init?.body as FormData;
    const file = form.get("file") as File;
    const key = String(form.get("key") ?? "");
    const action = String(form.get("action"));
    const responseMode = String(form.get("response_mode"));
    if (!/\.txt$/i.test(file.name))
      return json({ success: false, message: "Chỉ chấp nhận file .txt." }, 415);
    const source = await readFile(file);
    const result =
      cipher === "affine"
        ? transformAffineForAnalysis(
            source,
            action === "decrypt" ? "decrypt" : "encrypt",
            normalizeAffineKey(BigInt(String(form.get("a")).trim())),
            normalizeAffineKey(BigInt(String(form.get("b")).trim())),
          )
        : cipher === "columnar"
          ? source === "khoacongnghethongtin"
            ? "agnonokntioetchghghn"
            : source
          : cipher === "caesar"
            ? shiftText(source, (action === "decrypt" ? -1 : 1) * Number(BigInt(key) % 26n))
            : cipher === "vigenere"
              ? vigenere(source, key, action === "decrypt")
              : playfair(source, key, action === "decrypt");
    if (responseMode === "file") {
      const suffix = action === "encrypt" ? "encrypted" : "decrypted";
      const filename = `${file.name.replace(/\.txt$/i, "")}.${suffix}.txt`;
      return new Response(result, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
    return json({ success: true, result });
  }

  const rawBody = String(init?.body);
  const body = JSON.parse(rawBody) as { text: string; key: number | string };
  const result =
    cipher === "affine"
      ? (() => {
          const tokens = rawBody.match(/,"a":(-?(?:0|[1-9][0-9]*)),"b":(-?(?:0|[1-9][0-9]*))}$/);
          if (!tokens) throw new Error("Invalid Affine test request");
          return transformAffineForAnalysis(
            body.text,
            decrypt ? "decrypt" : "encrypt",
            normalizeAffineKey(BigInt(tokens[1])),
            normalizeAffineKey(BigInt(tokens[2])),
          );
        })()
      : cipher === "columnar"
        ? body.text === "khoacongnghethongtin"
          ? "agnonokntioetchghghn"
          : body.text
        : cipher === "caesar"
          ? shiftText(body.text, (decrypt ? -1 : 1) * Number(BigInt(body.key) % 26n))
          : cipher === "vigenere"
            ? vigenere(body.text, String(body.key), decrypt)
            : playfair(body.text, String(body.key), decrypt);
  return json({ success: true, result });
});

vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockClear();
});
