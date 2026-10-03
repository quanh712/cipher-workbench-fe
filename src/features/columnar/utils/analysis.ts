import type { CipherMode } from "../../../shared/types/cipher";
import type { ParsedColumnarKey } from "./validation";

export interface ColumnarAnalysisInput {
  sourceText: string;
  result: string;
  mode: CipherMode;
  key: ParsedColumnarKey;
}

export interface ColumnarAnalysis {
  mode: CipherMode;
  sourcePreview: string;
  codePointCount: number;
  rawKey: string;
  canonicalKey: string;
  kind: ParsedColumnarKey["kind"];
  permutation: number[];
  readOrder: number[];
  columnLengths: number[];
  columnSegments: string[];
  totalRows: number;
  isPreview: boolean;
  rows: Array<Array<string | null>>;
}

const MAX_FULL_MATRIX_CODE_POINTS = 200;
const SOURCE_PREVIEW_CODE_POINTS = 80;
const PREVIEW_ROWS = 10;

// Presentation only: the Backend response owns the actual result.
// Keep only displayed code points, even for a 5 MiB file.
export function buildColumnarAnalysis({
  sourceText,
  result,
  mode,
  key,
}: ColumnarAnalysisInput): ColumnarAnalysis | null {
  const columnCount = key.permutation.length;
  const sourceHead: string[] = [];
  let codePointCount = 0;
  const headLimit = Math.max(MAX_FULL_MATRIX_CODE_POINTS, PREVIEW_ROWS * columnCount);
  for (const character of sourceText) {
    if (sourceHead.length < headLimit) sourceHead.push(character);
    codePointCount += 1;
  }
  let resultCount = 0;
  for (const character of result) {
    if (character) resultCount += 1;
  }
  if (resultCount !== codePointCount) return null;

  const quotient = Math.floor(codePointCount / columnCount);
  const remainder = codePointCount % columnCount;
  const columnLengths = Array.from(
    { length: columnCount },
    (_, index) => quotient + (index < remainder ? 1 : 0),
  );
  const isPreview = codePointCount > MAX_FULL_MATRIX_CODE_POINTS;
  const totalRows = Math.ceil(codePointCount / columnCount);
  const previewRowCount = isPreview ? Math.min(totalRows, PREVIEW_ROWS) : totalRows;

  // Ciphertext is partitioned in rank order; cache just the visible prefix of each column.
  const segmentCharacters = Array.from({ length: columnCount }, () => [] as string[]);
  const segmentSource = mode === "encrypt" ? result : sourceText;
  let readRank = 0;
  let columnOffset = 0;
  for (const character of segmentSource) {
    while (readRank < columnCount && columnOffset >= columnLengths[key.readOrder[readRank] - 1]) {
      readRank += 1;
      columnOffset = 0;
    }
    const physicalColumn = key.readOrder[readRank] - 1;
    if (segmentCharacters[physicalColumn].length < previewRowCount) {
      segmentCharacters[physicalColumn].push(character);
    }
    columnOffset += 1;
  }

  const rows = Array.from({ length: previewRowCount }, (_, row) =>
    Array.from({ length: columnCount }, (_, column) => {
      if (row >= columnLengths[column]) return null;
      return mode === "decrypt"
        ? segmentCharacters[column][row]
        : sourceHead[row * columnCount + column];
    }),
  );

  return {
    mode,
    sourcePreview: sourceHead.slice(0, SOURCE_PREVIEW_CODE_POINTS).join(""),
    codePointCount,
    rawKey: key.raw,
    canonicalKey: key.canonicalKey,
    kind: key.kind,
    permutation: [...key.permutation],
    readOrder: [...key.readOrder],
    columnLengths,
    columnSegments: segmentCharacters.map((characters) => characters.join("")),
    totalRows,
    isPreview,
    rows,
  };
}
