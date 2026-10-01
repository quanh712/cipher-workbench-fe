import { useId, useRef, useState } from "react";
import type { CipherMode, InputType } from "../types/cipher";
import { formatFileSize } from "../utils/formatFileSize";
import { ColorizedText } from "./ColorizedText";
import { HighlightedTextArea } from "./HighlightedTextArea";

interface CipherInputPanelProps {
  inputType: InputType;
  mode: CipherMode;
  text: string;
  file: File | null;
  fileText: string;
  error: string | null;
  disabled: boolean;
  isReadingFile?: boolean;
  metadataOnly?: boolean;
  fileAccept?: string;
  fileAriaLabel?: string;
  fileHint?: string;
  ariaLabel?: string;
  textAriaLabel?: string;
  showErrorWithoutInput?: boolean;
  onInputTypeChange: (value: InputType) => void;
  onTextChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onClear: () => void;
  onPaste: () => void;
  onCopy: () => void;
}

export function CipherInputPanel(props: CipherInputPanelProps) {
  const hasInput = props.inputType === "text" ? props.text.length > 0 : Boolean(props.file);
  const error = hasInput || props.showErrorWithoutInput ? props.error : null;
  const statusId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(file: File | undefined) {
    if (!props.disabled && file) void props.onFileChange(file);
  }

  return (
    <section aria-label={props.ariaLabel}>
      <div className="section-label">
        <span>Đầu vào</span>
        <div className="segmented" role="group" aria-label="Nguồn đầu vào">
          {(["text", "file"] as const).map((type) => (
            <button
              className={props.inputType === type ? "is-active" : ""}
              key={type}
              type="button"
              onClick={() => props.onInputTypeChange(type)}
              disabled={props.disabled}
              aria-pressed={props.inputType === type}
            >
              {type === "text" ? "Văn bản" : props.metadataOnly ? "File" : "File .txt"}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <h2>
            {props.inputType === "file"
              ? props.metadataOnly
                ? "Tệp dữ liệu"
                : "Tệp văn bản"
              : props.mode === "encrypt"
                ? "Bản rõ"
                : "Bản mã"}
          </h2>
          <div className="button-group">
            {props.inputType === "text" && (
              <button
                className="button button--secondary"
                type="button"
                onClick={props.onPaste}
                disabled={props.disabled}
              >
                Dán
              </button>
            )}
            <button
              className="button button--secondary"
              type="button"
              onClick={props.onCopy}
              disabled={
                props.disabled || (props.inputType === "text" ? !props.text : !props.fileText)
              }
            >
              Sao chép
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={props.onClear}
              disabled={props.disabled || (props.inputType === "text" ? !props.text : !props.file)}
            >
              Xóa
            </button>
          </div>
        </div>

        {props.inputType === "text" ? (
          <HighlightedTextArea
            ariaLabel={props.textAriaLabel}
            ariaInvalid={Boolean(error)}
            ariaDescribedBy={error ? statusId : undefined}
            value={props.text}
            onChange={props.onTextChange}
            disabled={props.disabled}
          />
        ) : (
          <div>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              aria-label={
                props.fileAriaLabel ??
                (props.metadataOnly ? "Chọn file dữ liệu" : "Chọn file văn bản")
              }
              accept={props.fileAccept ?? (props.metadataOnly ? undefined : ".txt,text/plain")}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? statusId : undefined}
              disabled={props.disabled}
              onChange={(event) => {
                selectFile(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            {props.file ? (
              <div className="file-card">
                <div className="file-card__header">
                  <span className="file-extension">{props.metadataOnly ? "FILE" : "TXT"}</span>
                  <span className="file-card__meta">
                    <strong>{props.file.name}</strong>
                    <small>{formatFileSize(props.file.size)}</small>
                  </span>
                  <div className="button-group">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={props.disabled}
                    >
                      Đổi file
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => props.onFileChange(null)}
                      disabled={props.disabled}
                    >
                      Gỡ file
                    </button>
                  </div>
                </div>
                {!props.metadataOnly && (
                  <pre className="file-preview" aria-label="Xem trước nội dung file">
                    <ColorizedText text={props.fileText.slice(0, 5_000)} />
                    {props.fileText.length > 5_000 ? "\n…" : ""}
                  </pre>
                )}
              </div>
            ) : (
              <div
                className={isDragging ? "file-picker file-picker--dragging" : "file-picker"}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (props.disabled) return;
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (props.disabled) return;
                  selectFile(event.dataTransfer.files[0]);
                }}
              >
                <strong>
                  {props.metadataOnly ? "Kéo thả file vào đây" : "Kéo thả file .txt vào đây"}
                </strong>
                <span>hoặc</span>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={props.disabled}
                >
                  Chọn file
                </button>
                <small>
                  {props.fileHint ??
                    (props.metadataOnly
                      ? "Chỉ hiển thị tên và dung lượng file."
                      : "Chỉ nhận file .txt UTF-8, tối đa 5 MiB")}
                </small>
              </div>
            )}
          </div>
        )}

        <div
          id={statusId}
          className={`status ${props.isReadingFile ? "" : error ? "status--error" : (props.inputType === "text" ? props.text.length > 0 : Boolean(props.file)) ? "status--success" : ""}`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {props.isReadingFile ? (
            "Đang đọc nội dung file…"
          ) : error ? (
            <>
              <span aria-hidden="true">! </span>
              <span>{error}</span>
            </>
          ) : props.inputType === "text" && !props.text ? (
            "Chưa có dữ liệu"
          ) : props.inputType === "file" && !props.file ? (
            "Chưa chọn file"
          ) : (
            "✓ Đầu vào hợp lệ ở mức sơ bộ."
          )}
        </div>
      </div>
    </section>
  );
}
