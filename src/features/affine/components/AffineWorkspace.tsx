import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { CipherInputPanel } from "../../../shared/components/CipherInputPanel";
import { Notification } from "../../../shared/components/Notification";
import type { AffineCipherController } from "../hooks/useAffineCipher";
import { AffineKeyConfig } from "./AffineKeyConfig";
import { AffineMap } from "./AffineMap";
import { AffineOutputPanel } from "./AffineOutputPanel";

interface AffineWorkspaceProps {
  cipher: AffineCipherController;
}

export function AffineWorkspace({ cipher }: AffineWorkspaceProps) {
  async function copyInput() {
    try {
      const input = cipher.inputType === "text" ? cipher.text : cipher.fileText;
      await navigator.clipboard.writeText(input);
      cipher.setNotice({ kind: "success", message: "Đã sao chép đầu vào." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể sao chép đầu vào." });
    }
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(cipher.result?.text ?? "");
      cipher.setNotice({ kind: "success", message: "Đã sao chép kết quả." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể sao chép kết quả." });
    }
  }

  async function pasteInput() {
    try {
      const text = await navigator.clipboard.readText();
      const accepted = cipher.setText(text);
      if (accepted) {
        cipher.setNotice({ kind: "success", message: "Đã dán nội dung từ clipboard." });
      }
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể đọc nội dung clipboard." });
    }
  }

  const currentInput = cipher.inputType === "text" ? cipher.text : cipher.fileText;

  return (
    <div className="cipher-workspace">
      <CipherModeSelector value={cipher.mode} disabled={cipher.isBusy} onChange={cipher.setMode} />

      <div className="helper-row">
        <span>
          Chỉ chữ cái ASCII được biến đổi; Unicode, số, dấu câu và khoảng trắng được giữ nguyên.
        </span>
        <button
          className="button button--secondary"
          type="button"
          onClick={cipher.loadExample}
          disabled={cipher.isBusy}
        >
          Tạo ví dụ
        </button>
      </div>

      <div className="workspace__columns">
        <CipherInputPanel
          inputType={cipher.inputType}
          mode={cipher.mode}
          text={cipher.text}
          file={cipher.file}
          fileText={cipher.fileText}
          error={cipher.inputError}
          disabled={cipher.isBusy}
          isReadingFile={cipher.isReadingFile}
          onInputTypeChange={cipher.setInputType}
          onTextChange={cipher.setText}
          onFileChange={cipher.setFile}
          onClear={cipher.resetInput}
          onPaste={pasteInput}
          onCopy={copyInput}
        />
        <AffineOutputPanel
          key={cipher.result ? "result" : "empty"}
          result={cipher.result}
          mode={cipher.mode}
          processingStatus={cipher.processingStatus}
          disabled={cipher.isBusy}
          onCopy={copyResult}
          onClear={cipher.clearResult}
          onDownload={cipher.downloadResult}
        />
      </div>

      <AffineMap mode={cipher.mode} input={currentInput} validation={cipher.keyValidation} />

      <AffineKeyConfig
        mode={cipher.mode}
        a={cipher.a}
        b={cipher.b}
        validation={cipher.keyValidation}
        disabled={cipher.isBusy}
        onAChange={cipher.setA}
        onBChange={cipher.setB}
      />

      <button
        className="button button--primary"
        type="button"
        disabled={!cipher.canSubmit}
        onClick={cipher.processCipher}
      >
        {cipher.isReadingFile
          ? "Đang đọc file…"
          : cipher.isLoading
            ? "Đang xử lý…"
            : cipher.mode === "encrypt"
              ? "Mã hóa"
              : "Giải mã"}
      </button>

      {cipher.notice && (
        <Notification notice={cipher.notice} onClose={() => cipher.setNotice(null)} />
      )}
    </div>
  );
}
