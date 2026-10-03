import { CipherActions } from "../../../shared/components/CipherActions";
import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { CipherInputPanel } from "../../../shared/components/CipherInputPanel";
import { DraftKeyConfig } from "../../../shared/components/DraftKeyConfig";
import { KeyAlignedColumns } from "../../../shared/components/KeyAlignedColumns";
import { Notification } from "../../../shared/components/Notification";
import type { VigenereCipherController } from "../hooks/useVigenereCipher";
import { VigenereOutputPanel } from "./VigenereOutputPanel";

interface VigenereWorkspaceProps {
  cipher: VigenereCipherController;
}

export function VigenereWorkspace({ cipher }: VigenereWorkspaceProps) {
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
          Chỉ chữ cái ASCII tiêu thụ dòng khóa; Unicode, số, dấu câu và khoảng trắng được giữ
          nguyên.
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
          <CipherInputPanel
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

          <DraftKeyConfig
            algorithmName="Vigenère"
            value={cipher.key}
            error={cipher.keyError}
            placeholder="Ví dụ: LEMON"
            description="Khóa Vigenère phải là chuỗi không rỗng chỉ gồm A–Z hoặc a–z."
            hint="Backend nhận đúng giá trị đã nhập; chữ thường và chữ hoa cho cùng dòng khóa logic."
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
        <VigenereOutputPanel
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

      {cipher.notice && (
        <Notification notice={cipher.notice} onClose={() => cipher.setNotice(null)} />
      )}
    </div>
  );
}
