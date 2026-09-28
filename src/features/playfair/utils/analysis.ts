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

export interface PlayfairFillerSuggestion {
  text: string;
  removedCount: number;
}

export function suggestPlayfairPlaintext(text: string): PlayfairFillerSuggestion | null {
  const normalized = normalizePlayfairLetters(text);
  if (normalized !== text || normalized.length === 0) {
    return null;
  }

  // The Backend removes one terminal filler after decrypting an even digraph stream.
  // Reconstruct it only to validate an analysis suggestion, never to change the result.
  const prepared =
    normalized.length % 2 === 0 ? normalized : normalized + (normalized.endsWith("X") ? "Q" : "X");

  const possibleFillers = new Set<number>();
  for (let index = 1; index < prepared.length - 1; index += 2) {
    const preceding = prepared[index - 1];
    const expectedFiller = preceding === "X" ? "Q" : "X";
    if (prepared[index] !== expectedFiller) continue;

    if (prepared[index + 1] === preceding) {
      possibleFillers.add(index);
    }
  }

  if (possibleFillers.size === 0) return null;
  const candidate = Array.from(normalized)
    .filter((_, index) => !possibleFillers.has(index))
    .join("");

  // A suggestion must be able to produce the exact decrypted digraph stream again.
  if (preparePlayfairDigraphs(candidate, "encrypt").join("") !== prepared) return null;

  return { text: candidate, removedCount: possibleFillers.size };
}
