import { normalizePlayfairLetters } from "./validation";

const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

export function normalizePlayfairKey(key: string): string {
  return Array.from(new Set(normalizePlayfairLetters(key))).join("");
}

export function buildPlayfairMatrix(key: string): string[][] {
  const prefix = normalizePlayfairKey(key);
  const flattened =
    prefix +
    Array.from(ALPHABET)
      .filter((letter) => !prefix.includes(letter))
      .join("");
  return Array.from({ length: 5 }, (_, row) => Array.from(flattened.slice(row * 5, row * 5 + 5)));
}

export function preparePlayfairDigraphs(text: string, mode: "encrypt" | "decrypt"): string[] {
  const normalized = normalizePlayfairLetters(text);
  if (mode === "decrypt") {
    return Array.from({ length: normalized.length / 2 }, (_, index) =>
      normalized.slice(index * 2, index * 2 + 2),
    );
  }

  const prepared: string[] = [];
  let index = 0;
  while (index < normalized.length) {
    const current = normalized[index];
    const following = normalized[index + 1];
    if (!following || following === current) {
      prepared.push(current + (current === "X" ? "Q" : "X"));
      index += 1;
    } else {
      prepared.push(current + following);
      index += 2;
    }
  }
  return prepared;
}
