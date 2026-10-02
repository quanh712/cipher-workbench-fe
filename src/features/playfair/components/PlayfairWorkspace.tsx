import { CipherActions } from "../../../shared/components/CipherActions";
import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { CipherInputPanel } from "../../../shared/components/CipherInputPanel";
import { DraftKeyConfig } from "../../../shared/components/DraftKeyConfig";
import { Notification } from "../../../shared/components/Notification";
import type { PlayfairCipherController } from "../hooks/usePlayfairCipher";
import { PlayfairOutputPanel } from "./PlayfairOutputPanel";

interface PlayfairWorkspaceProps {
  cipher: PlayfairCipherController;
}

export function PlayfairWorkspace({ cipher }: PlayfairWorkspaceProps) {
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
      await navigator.clipboard.writeText(cipher.displayResult);
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
          Playfair chuẩn hóa thành chữ hoa ASCII, gộp J/I, loại định dạng; khi giải mã, bản thô giữ
          mọi filler X/Q, bộ lọc ký tự đệm có thể bỏ nhầm X/Q thật; kết quả không khôi phục nguyên
          văn đầu vào.
        </span>
        <button
          className="button button--secondary playfair-example"
          type="button"
          onClick={cipher.loadExample}
          disabled={cipher.isLoading}
        >
          Tạo ví dụ
        </button>
      </div>

      <div className="workspace__columns">
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
            algorithmName="Playfair"
            value={cipher.key}
            error={cipher.keyError}
            placeholder="Ví dụ: PLAYFAIR EXAMPLE"
            description="Khóa Playfair được chuẩn hóa thành chữ hoa ASCII, gộp J/I và loại ký tự trùng."
            hint="Khoảng trắng và ký tự ngoài ASCII bị loại nếu khóa vẫn còn ít nhất một chữ cái A–Z."
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
        <PlayfairOutputPanel
          key={cipher.result ? "result" : "empty"}
          result={cipher.result}
          displayResult={cipher.displayResult}
          filterPadding={cipher.filterPadding}
          onFilterPadding={cipher.setFilterPadding}
          mode={cipher.mode}
          processingStatus={cipher.processingStatus}
          disabled={cipher.isLoading}
          onCopy={copyResult}
          onClear={cipher.clearResult}
          onDownload={cipher.downloadResult}
        />
      </div>

      {cipher.notice && (
        <Notification notice={cipher.notice} onClose={() => cipher.setNotice(null)} />
      )}
    </div>
  );
}
