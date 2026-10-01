import { useRef } from "react";
import { CipherInputPanel } from "../../../shared/components/CipherInputPanel";
import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { Notification } from "../../../shared/components/Notification";
import type { DesCipherController } from "../hooks/useDesCipher";
import { DesKeyInput } from "./DesKeyInput";
import { DesResultPanel } from "./DesResultPanel";

export function DesWorkspace({ cipher }: { cipher: DesCipherController }) {
  const workspace = useRef<HTMLDivElement>(null);

  async function submit() {
    const errors = await cipher.processCipher();
    if (!errors) return;
    const label = errors.input
      ? "Nội dung đầu vào DES"
      : errors.file
        ? "Chọn file DES"
        : errors.key
          ? "Khóa DES"
          : "IV DES";
    workspace.current?.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.focus();
  }

  async function pasteInput() {
    try {
      cipher.setText(await navigator.clipboard.readText());
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể đọc nội dung clipboard." });
    }
  }

  async function copyInput() {
    try {
      await navigator.clipboard.writeText(cipher.text);
      cipher.setNotice({ kind: "success", message: "Đã sao chép đầu vào." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể sao chép đầu vào." });
    }
  }

  return (
    <div className="cipher-workspace" ref={workspace} aria-busy={cipher.isBusy}>
      {cipher.isDemo && (
        <p className="des-demo-banner" role="note">
          Dữ liệu mô phỏng — kết quả không được tính từ nội dung hoặc khóa bạn nhập.
        </p>
      )}
      <CipherModeSelector value={cipher.mode} disabled={cipher.isBusy} onChange={cipher.setMode} />
      <div className="helper-row">
        <span>
          DES xử lý block 64 bit, dùng khóa 64 bit với 56 bit hiệu dụng và cấu trúc Feistel 16 vòng.
          Giải mã dùng khóa con theo thứ tự ngược.
        </span>
        <button
          className="button button--secondary"
          type="button"
          disabled={cipher.isBusy}
          onClick={cipher.loadExample}
        >
          Tạo ví dụ
        </button>
      </div>
      {!cipher.isDemo && (
        <section className="des-options" aria-label="Tùy chọn DES">
          {cipher.inputType === "text" && (
            <label>
              <span className="section-label">
                Định dạng {cipher.mode === "encrypt" ? "bản rõ" : "kết quả"}
              </span>
              <select
                aria-label="Định dạng DES"
                value={cipher.format}
                disabled={cipher.isBusy}
                onChange={(event) =>
                  cipher.setFormat(event.target.value === "hex" ? "hex" : "text")
                }
              >
                <option value="text">Văn bản UTF-8 (PKCS#7)</option>
                <option value="hex">HEX (không gỡ/thêm padding)</option>
              </select>
            </label>
          )}
          <label>
            <span className="section-label">Chế độ mã khối</span>
            <select
              aria-label="Chế độ mã khối DES"
              value={cipher.cipherMode}
              disabled={cipher.isBusy}
              onChange={(event) =>
                cipher.setCipherMode(event.target.value === "CBC" ? "CBC" : "ECB")
              }
            >
              <option>ECB</option>
              <option>CBC</option>
            </select>
          </label>
          {cipher.cipherMode === "CBC" && (
            <label>
              IV (16 ký tự HEX)
              <input
                aria-label="IV DES"
                autoComplete="off"
                spellCheck={false}
                value={cipher.iv}
                disabled={cipher.isBusy}
                aria-invalid={Boolean(cipher.fieldErrors.iv)}
                aria-describedby="des-iv-note"
                onChange={(event) => cipher.setIv(event.target.value)}
              />
              <span id="des-iv-note">
                Giữ IV cùng bản mã. IV sai vẫn có thể giải mã thành công nhưng sai 8 byte đầu.
              </span>
              {cipher.fieldErrors.iv && <span role="alert">{cipher.fieldErrors.iv}</span>}
            </label>
          )}
        </section>
      )}
      {cipher.roundTripWarning && (
        <p className="des-warning" role="status">
          Văn bản vượt 2.621.439 byte UTF-8: bản mã sẽ vượt giới hạn giải mã 5 MiB. Hãy chia nhỏ dữ
          liệu nếu cần giải mã lại qua API.
        </p>
      )}
      <div className="workspace__columns">
        <div className="des-column">
          <CipherInputPanel
            inputType={cipher.inputType}
            mode={cipher.mode}
            text={cipher.text}
            file={cipher.file}
            fileText=""
            metadataOnly
            fileAriaLabel="Chọn file DES"
            fileAccept={cipher.isDemo ? undefined : ".txt,text/plain"}
            fileHint={
              cipher.isDemo
                ? "Loại file và dung lượng sẽ được xác nhận theo API DES."
                : "Chỉ nhận file .txt UTF-8, tối đa 5 MiB. File encrypt ra HEX; file decrypt luôn trả văn bản."
            }
            showErrorWithoutInput
            ariaLabel="Đầu vào DES"
            textAriaLabel="Nội dung đầu vào DES"
            error={cipher.fieldErrors.input ?? cipher.fieldErrors.file ?? null}
            disabled={cipher.isBusy}
            onInputTypeChange={cipher.setInputType}
            onTextChange={cipher.setText}
            onFileChange={cipher.setFile}
            onClear={cipher.resetInput}
            onPaste={pasteInput}
            onCopy={copyInput}
          />
          <DesKeyInput
            isDemo={cipher.isDemo}
            value={cipher.key}
            error={cipher.fieldErrors.key}
            disabled={cipher.isBusy}
            onChange={cipher.setKey}
          />
          <div className="button-group des-actions">
            <button
              className="button button--primary"
              type="button"
              disabled={!cipher.canSubmit}
              onClick={submit}
            >
              {cipher.isBusy ? "Đang xử lý…" : cipher.mode === "encrypt" ? "Mã hóa" : "Giải mã"}
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={cipher.isBusy}
              onClick={cipher.resetAll}
            >
              Đặt lại DES
            </button>
          </div>
        </div>
        <div className="des-column">
          <DesResultPanel cipher={cipher} />
        </div>
      </div>
      {cipher.notice && (
        <Notification notice={cipher.notice} onClose={() => cipher.setNotice(null)} />
      )}
    </div>
  );
}
