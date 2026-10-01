import { vi } from "vitest";
import type { HillGateway } from "../services/hillGateway";
import type { HillKeyAnalysis } from "../types/cipher";

export const exampleKey: HillKeyAnalysis = {
  matrix: [
    [3, 3],
    [2, 5],
  ],
  m: 2,
  det: 9,
  gcd: 1,
  detInverse: 3,
  adjugate: [
    [5, 23],
    [24, 3],
  ],
  inverse: [
    [15, 17],
    [20, 9],
  ],
};

export function createHillGateway(overrides: Partial<HillGateway> = {}): HillGateway {
  return {
    analyze: vi.fn().mockResolvedValue({ success: true, result: exampleKey, warnings: [] }),
    random: vi.fn().mockResolvedValue({ success: true, result: exampleKey, warnings: [] }),
    process: vi.fn().mockResolvedValue({
      success: true,
      result: "DPLE",
      key: exampleKey,
      blocks: [
        { input: [7, 4], output: [3, 15] },
        { input: [11, 15], output: [11, 4] },
      ],
      warnings: [],
    }),
    ...overrides,
  };
}

export const exampleKey3: HillKeyAnalysis = {
  matrix: [
    [6, 24, 1],
    [13, 16, 10],
    [20, 17, 15],
  ],
  m: 3,
  det: 25,
  gcd: 1,
  detInverse: 25,
  adjugate: [
    [18, 21, 16],
    [5, 18, 5],
    [5, 14, 18],
  ],
  inverse: [
    [8, 5, 10],
    [21, 8, 21],
    [21, 12, 8],
  ],
};
