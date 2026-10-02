import type { PaddingInfo } from "../../../shared/utils/padding";
import type { CipherMode, InputType } from "../../../shared/types/cipher";

export type ProcessingStatus = "idle" | "loading" | "success" | "error";

export interface PlayfairResultSnapshot {
  text: string;
  padding?: PaddingInfo;
  source: string;
  mode: CipherMode;
  inputType: InputType;
  file?: File;
  keyValue: string;
}
