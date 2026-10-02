export interface PaddingInfo {
  count: number;
  positions: number[];
  filtered: string;
}

export function readPadding(value: unknown, raw: string): PaddingInfo | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    !("count" in value) ||
    !("positions" in value) ||
    !("filtered" in value) ||
    !Array.isArray(value.positions) ||
    typeof value.filtered !== "string" ||
    value.count !== value.positions.length
  )
    throw new Error("Phản hồi padding không hợp lệ.");
  const positions: number[] = value.positions;
  const letters = (raw.match(/[A-Za-z]/g) ?? []).length;
  if (
    !positions.every(
      (n, i) => Number.isInteger(n) && n >= 0 && n < letters && (i === 0 || n > positions[i - 1]),
    )
  )
    throw new Error("Phản hồi padding không hợp lệ.");
  let index = 0;
  const removed = new Set(positions);
  const filtered = Array.from(raw)
    .filter((char) => !/[A-Za-z]/.test(char) || !removed.has(index++))
    .join("");
  if (filtered !== value.filtered) throw new Error("Phản hồi padding không hợp lệ.");
  return { count: positions.length, positions, filtered: value.filtered };
}
