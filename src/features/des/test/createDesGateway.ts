import { vi } from "vitest";
import type { DesGateway } from "../services/desGateway";

export function createDesGateway(overrides: Partial<DesGateway> = {}) {
  return {
    process: vi
      .fn<DesGateway["process"]>()
      .mockResolvedValue({ text: " \nMẫu tiếng Việt\n ", attachment: null }),
    ...overrides,
  };
}
