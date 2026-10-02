import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { CipherMode, CipherResultSnapshot, ProcessingStatus } from "../types/cipher";
import { ColorizedText } from "../../../shared/components/ColorizedText";

interface OutputPanelProps {
  result: CipherResultSnapshot | null;
  mode: CipherMode;
  processingStatus: ProcessingStatus;
  disabled: boolean;
  onClear: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

export function OutputPanel(props: OutputPanelProps) {
  const [view, setView] = useState<"text" | "stats">("text");
  const id = useId();
  const views = ["text", "stats"] as const;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stats = Array.from(props.result?.source ?? "").reduce(
    (result, character) => {
      const code = character.charCodeAt(0);
      if (code >= 65 && code <= 90) result.uppercase += 1;
      else if (code >= 97 && code <= 122) result.lowercase += 1;
      else result.unchanged += 1;
      return result;
    },
    { uppercase: 0, lowercase: 0, unchanged: 0 },
  );

  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % views.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + views.length) % views.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = views.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    setView(views[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="cipher-output-panel">
      <div className="section-label">Kết quả</div>
      <div className="panel">
        <div className="panel__header">
          <h2>{props.mode === "encrypt" ? "Bản mã" : "Bản rõ"}</h2>
          <div className="panel-tabs" role="tablist" aria-label="Kiểu hiển thị kết quả">
            {views.map((nextView, index) => (
              <button
                ref={(button) => {
                  tabRefs.current[index] = button;
                }}
                id={`${id}-${nextView}-tab`}
                key={nextView}
                type="button"
                role="tab"
                aria-controls={`${id}-${nextView}-panel`}
                aria-selected={view === nextView}
                tabIndex={view === nextView ? 0 : -1}
                onClick={() => setView(nextView)}
                onKeyDown={(event) => selectWithKeyboard(event, index)}
                disabled={props.disabled}
              >
                {nextView === "text" ? "Văn bản" : "Phân tích"}
              </button>
            ))}
          </div>
          <div className="button-group">
            <button
              className="button button--secondary"
              onClick={props.onDownload}
              disabled={!props.result || props.disabled}
              type="button"
            >
              Tải kết quả
            </button>
            <button
              className="button button--secondary"
              onClick={props.onCopy}
              disabled={!props.result || props.disabled}
              type="button"
            >
              Sao chép
            </button>
            <button
              className="button button--secondary"
              onClick={props.onClear}
              disabled={!props.result || props.disabled}
              type="button"
            >
              Xóa
            </button>
          </div>
        </div>
        <pre
          id={`${id}-text-panel`}
          className={props.result ? "output" : "output output--empty"}
          role="tabpanel"
          aria-labelledby={`${id}-text-tab`}
          hidden={view !== "text"}
        >
          {props.result ? (
            <ColorizedText text={props.result.text} />
          ) : (
            "Kết quả sẽ hiển thị ở đây sau khi xử lý."
          )}
        </pre>
        <dl
          id={`${id}-stats-panel`}
          className="stats-list"
          role="tabpanel"
          aria-labelledby={`${id}-stats-tab`}
          hidden={view !== "stats"}
        >
          <div>
            <dt>Chế độ</dt>
            <dd>
              {props.result?.mode === "encrypt"
                ? "Mã hóa"
                : props.result?.mode === "decrypt"
                  ? "Giải mã"
                  : "-"}
            </dd>
          </div>
          <div>
            <dt>Nguồn</dt>
            <dd>
              {props.result?.inputType === "text"
                ? "Văn bản"
                : props.result
                  ? `File · ${props.result.fileName ?? "-"}`
                  : "-"}
            </dd>
          </div>
          <div>
            <dt>Khóa nhập / chuẩn hóa</dt>
            <dd>
              {props.result?.keyValue || "-"} / {props.result?.normalizedKey ?? "-"}
            </dd>
          </div>
          <div>
            <dt>Tổng ký tự</dt>
            <dd>{props.result?.source.length ?? 0}</dd>
          </div>
          <div>
            <dt>Chữ hoa dịch chuyển</dt>
            <dd>{stats.uppercase}</dd>
          </div>
          <div>
            <dt>Chữ thường dịch chuyển</dt>
            <dd>{stats.lowercase}</dd>
          </div>
          <div>
            <dt>Ký tự giữ nguyên</dt>
            <dd>{stats.unchanged}</dd>
          </div>
        </dl>
        <div
          className={`status ${props.processingStatus === "success" ? "status--success" : props.processingStatus === "error" ? "status--error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {props.processingStatus === "loading"
            ? "Đang gửi yêu cầu…"
            : props.processingStatus === "error"
              ? "! Xử lý thất bại"
              : props.result
                ? `✓ Xử lý thành công · ${props.result.text.length} ký tự`
                : "Chưa xử lý"}
        </div>
      </div>
    </section>
  );
}
