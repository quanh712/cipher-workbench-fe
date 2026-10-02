import type { PaddingInfo } from "../../../shared/utils/padding";
import type { CipherMode } from "../../../shared/types/cipher";

export type HillSize = 2 | 3 | 4;
export type HillMatrix = number[][];
export type HillKeyPayload =
  { key: HillMatrix; keyword?: never; m?: never } | { keyword: string; m: HillSize; key?: never };
export type HillKeyInputMode = "grid" | "keyword";

export interface HillKeyAnalysis {
  matrix: HillMatrix;
  m: HillSize;
  det: number;
  gcd: number;
  detInverse: number;
  adjugate: HillMatrix;
  inverse: HillMatrix;
}

export interface HillBlock {
  input: number[];
  output: number[];
}

export interface HillWarning {
  code: "W01" | "W02" | "W03";
  message: string;
  details: Record<string, unknown>;
}

export interface HillAnalyzeResponse {
  success: true;
  result: HillKeyAnalysis;
  warnings: HillWarning[];
}

export type HillRandomResponse = HillAnalyzeResponse;

export type HillProcessRequest = HillKeyPayload & {
  text: string;
  options: { stripDiacritics: boolean; padChar: "X" };
};

export interface HillProcessResponse {
  padding?: PaddingInfo;
  success: true;
  result: string;
  blocks: HillBlock[];
  key: HillKeyAnalysis;
  warnings: HillWarning[];
}

export interface HillResultSnapshot extends HillProcessResponse {
  mode: CipherMode;
  source: string;
}

export interface HillErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
