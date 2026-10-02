import { downloadFile, previewFile, transformText } from "../../../shared/services/cipherApi";
import type { CipherMode } from "../../../shared/types/cipher";

export const playfairApi = {
  processText(mode: CipherMode, text: string, key: string) {
    return transformText("playfair", mode, JSON.stringify({ text, key }));
  },

  previewFile(mode: CipherMode, file: File, key: string) {
    return previewFile({ cipher: "playfair", file, key, action: mode });
  },

  downloadFile(mode: CipherMode, file: File, key: string, stripPadding = false) {
    return downloadFile({ cipher: "playfair", file, key, action: mode, stripPadding });
  },
};
