import type { CipherMode } from "../../../shared/types/cipher";
import type {
  HillAnalyzeResponse,
  HillKeyPayload,
  HillProcessRequest,
  HillProcessResponse,
  HillRandomResponse,
  HillSize,
} from "../types/cipher";

export interface HillGateway {
  analyze(payload: HillKeyPayload, signal?: AbortSignal): Promise<HillAnalyzeResponse>;
  random(m: HillSize, signal?: AbortSignal): Promise<HillRandomResponse>;
  process(mode: CipherMode, payload: HillProcessRequest): Promise<HillProcessResponse>;
}
