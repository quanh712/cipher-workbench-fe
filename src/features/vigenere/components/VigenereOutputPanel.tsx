import { CipherAnalysisEmpty } from "../../../shared/components/CipherAnalysisEmpty";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ColorizedText } from "../../../shared/components/ColorizedText";
import type { CipherMode } from "../../../shared/types/cipher";
import type { ProcessingStatus, VigenereResultSnapshot } from "../types/cipher";
import { analyzeVigenere } from "../utils/analysis";

interface VigenereOutputPanelProps {
  result: VigenereResultSnapshot | null;
  mode: CipherMode;
  processingStatus: ProcessingStatus;
  disabled: boolean;
  onClear: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

export function VigenereOutputPanel(props: VigenereOutputPanelProps) {
  const [view, setView] = useState<"text" | "analysis">("text");
  const id = useId();
  const views = ["text", "analysis"] as const;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const analysis = props.result
    ? analyzeVigenere(props.result.source, props.result.normalizedKey)
    : null;

  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % views.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + views.length) % views.length;
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
              type="button"
              disabled={!props.result || props.disabled}
              onClick={props.onDownload}
            >
              Tải kết quả
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!props.result || props.disabled}
              onClick={props.onCopy}
            >
              Sao chép
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!props.result || props.disabled}
              onClick={props.onClear}
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

        <div
          id={`${id}-analysis-panel`}
          className="cipher-analysis vigenere-analysis"
          role="tabpanel"
          aria-labelledby={`${id}-analysis-tab`}
          hidden={view !== "analysis"}
        >
          {props.result && analysis ? (
            <>
              <dl className="stats-list">
                <div>
                  <dt>Khóa nhập / chuẩn hóa</dt>
                  <dd>
                    {props.result.keyValue} / {props.result.normalizedKey}
                  </dd>
                </div>
                <div>
                  <dt>Tổng ký tự</dt>
                  <dd>{analysis.totalCharacters}</dd>
                </div>
                <div>
                  <dt>Chữ ASCII biến đổi</dt>
                  <dd>{analysis.transformedCharacters}</dd>
                </div>
                <div>
                  <dt>Ký tự giữ nguyên</dt>
                  <dd>{analysis.unchangedCharacters}</dd>
                </div>
              </dl>
              <div className="key-stream analysis-section" aria-label="Minh họa dòng khóa Vigenère">
                <div>
                  <strong>Đầu vào</strong>
                  <pre>{analysis.sample || "-"}</pre>
                </div>
                <div>
                  <strong>Dòng khóa</strong>
                  <pre>{analysis.keyStream || "-"}</pre>
                </div>
                <small>
                  Dấu · là ký tự không tiêu thụ khóa. Đang hiển thị {analysis.shownCharacters}/
                  {analysis.totalCharacters} ký tự{analysis.truncated ? " đầu tiên" : ""}.
                </small>
              </div>
            </>
          ) : (
            <CipherAnalysisEmpty />
          )}
        </div>

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
