import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { CipherInputPanel } from "../../../shared/components/CipherInputPanel";
import { Notification } from "../../../shared/components/Notification";
import type { ColumnarCipherController } from "../hooks/useColumnarCipher";
import { ColumnarKeyConfig } from "./ColumnarKeyConfig";
import { ColumnarOutputPanel } from "./ColumnarOutputPanel";

interface ColumnarWorkspaceProps {
  cipher: ColumnarCipherController;
}

export function ColumnarWorkspace({ cipher }: ColumnarWorkspaceProps) {
  async function copyInput() {
    try {
      await navigator.clipboard.writeText(
        cipher.inputType === "text" ? cipher.text : cipher.fileText,
      );
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
      if (cipher.setText(text)) {
        cipher.setNotice({ kind: "success", message: "Đã dán nội dung từ clipboard." });
      }
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể đọc nội dung clipboard." });
    }
  }

  return (
    <div className="cipher-workspace">
      <CipherModeSelector value={cipher.mode} disabled={cipher.isBusy} onChange={cipher.setMode} />

      <div className="helper-row">
        <span>
          Hệ mã hàng hoán vị nguyên vẹn mọi ký tự Unicode, kể cả dấu, khoảng trắng và xuống dòng;
          không thêm hoặc xóa ký tự đệm.
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
        <ColumnarOutputPanel
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

      <ColumnarKeyConfig
        keyValue={cipher.key}
        validation={cipher.keyValidation}
        disabled={cipher.isBusy}
        onKeyChange={cipher.setKey}
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
