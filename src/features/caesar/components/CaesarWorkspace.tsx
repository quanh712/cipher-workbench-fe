import { CipherActions } from "../../../shared/components/CipherActions";
import { KeyAlignedColumns } from "../../../shared/components/KeyAlignedColumns";
import type { CaesarCipherController } from "../hooks/useCaesarCipher";
import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { Notification } from "../../../shared/components/Notification";
import { AlphabetMap } from "./AlphabetMap";
import { CipherConfig } from "./CipherConfig";
import { InputPanel } from "./InputPanel";
import { OutputPanel } from "./OutputPanel";

interface CaesarWorkspaceProps {
  cipher: CaesarCipherController;
}

export function CaesarWorkspace({ cipher }: CaesarWorkspaceProps) {
  async function copyResult() {
    try {
      await navigator.clipboard.writeText(cipher.result?.text ?? "");
      cipher.setNotice({ kind: "success", message: "Đã sao chép kết quả." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể sao chép kết quả." });
    }
  }

  async function copyInput() {
    try {
      const input = cipher.inputType === "text" ? cipher.text : cipher.fileText;
      await navigator.clipboard.writeText(input);
      cipher.setNotice({ kind: "success", message: "Đã sao chép đầu vào." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể sao chép đầu vào." });
    }
  }

  async function pasteInput() {
    try {
      const text = await navigator.clipboard.readText();
      cipher.setText(text);
      cipher.setNotice({ kind: "success", message: "Đã dán nội dung từ clipboard." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể đọc nội dung clipboard." });
    }
  }

  return (
    <div className="cipher-workspace">
      <CipherModeSelector
        value={cipher.mode}
        disabled={cipher.isLoading}
        onChange={cipher.setMode}
      />
      <div className="helper-row">
        <span>
          {cipher.mode === "encrypt"
            ? "Dán bản rõ bên dưới để mã hóa bằng hệ mật Caesar."
            : "Dán bản mã bên dưới để giải mã bằng hệ mật Caesar."}
        </span>
        <button
          className="button button--secondary"
          type="button"
          onClick={cipher.loadExample}
          disabled={cipher.isLoading}
        >
          Tạo ví dụ
        </button>
      </div>

      <KeyAlignedColumns>
        <div className="workspace__input-column">
          <InputPanel
            inputType={cipher.inputType}
            mode={cipher.mode}
            text={cipher.text}
            file={cipher.file}
            fileText={cipher.fileText}
            error={cipher.inputError}
            disabled={cipher.isLoading}
            onInputTypeChange={cipher.setInputType}
            onTextChange={cipher.setText}
            onFileChange={cipher.setFile}
            onClear={cipher.resetInput}
            onPaste={pasteInput}
            onCopy={copyInput}
          />
          <CipherConfig
            value={cipher.key}
            normalizedKey={cipher.normalizedKey}
            error={cipher.keyError}
            disabled={cipher.isLoading}
            onChange={cipher.setKey}
          />
          <CipherActions disabled={cipher.isLoading} onReset={cipher.resetAll}>
            <button
              className="button button--primary"
              type="button"
              disabled={!cipher.canSubmit}
              onClick={cipher.processCipher}
            >
              {cipher.isLoading ? "Đang xử lý…" : cipher.mode === "encrypt" ? "Mã hóa" : "Giải mã"}
            </button>
          </CipherActions>
        </div>
        <OutputPanel
          key={cipher.result ? "result" : "empty"}
          result={cipher.result}
          mode={cipher.mode}
          processingStatus={cipher.processingStatus}
          disabled={cipher.isLoading}
          onCopy={copyResult}
          onClear={cipher.clearResult}
          onDownload={cipher.downloadResult}
        />
      </KeyAlignedColumns>

      <AlphabetMap
        mode={cipher.mode}
        normalizedKey={cipher.normalizedKey ?? 0}
        input={cipher.inputType === "text" ? cipher.text : cipher.fileText}
      />

      {cipher.notice && (
        <Notification notice={cipher.notice} onClose={() => cipher.setNotice(null)} />
      )}
    </div>
  );
}
