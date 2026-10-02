import { useId, useRef, useState, type KeyboardEvent } from "react";
import { PaddingResult } from "../../../shared/components/PaddingResult";
import { ColorizedText } from "../../../shared/components/ColorizedText";
import type { CipherMode } from "../../../shared/types/cipher";
import type { PlayfairResultSnapshot, ProcessingStatus } from "../types/cipher";
import {
  buildPlayfairMatrix,
  normalizePlayfairKey,
  preparePlayfairDigraphs,
} from "../utils/analysis";
import { normalizePlayfairLetters } from "../utils/validation";

interface PlayfairOutputPanelProps {
  result: PlayfairResultSnapshot | null;
  displayResult?: string;
  filterPadding?: boolean;
  onFilterPadding?: (value: boolean) => void;
  mode: CipherMode;
  processingStatus: ProcessingStatus;
  disabled: boolean;
  onClear: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

export function PlayfairOutputPanel(props: PlayfairOutputPanelProps) {
  const [view, setView] = useState<"text" | "analysis">("text");
  const id = useId();
  const views = ["text", "analysis"] as const;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const matrix = props.result ? buildPlayfairMatrix(props.result.keyValue) : null;
  const normalizedInput = props.result ? normalizePlayfairLetters(props.result.source) : "";
  const normalizedKey = props.result ? normalizePlayfairKey(props.result.keyValue) : "";
  const inputDigraphs = props.result
    ? preparePlayfairDigraphs(props.result.source, props.result.mode)
    : [];
  const outputDigraphs = props.result?.text.match(/.{1,2}/g) ?? [];
  const fillerCount =
    props.result?.mode === "encrypt"
      ? inputDigraphs.join("").length - normalizedInput.length
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
    <section>
      <div className="section-label">Kết quả</div>
      <div className="panel">
        <div className="panel__header">
          <h2>{props.mode === "encrypt" ? "Bản mã" : "Bản rõ chuẩn hóa"}</h2>
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
            <ColorizedText text={props.displayResult ?? props.result.text} />
          ) : (
            "Kết quả sẽ hiển thị ở đây sau khi xử lý."
          )}
        </pre>

        <div
          id={`${id}-analysis-panel`}
          className="playfair-analysis"
          role="tabpanel"
          aria-labelledby={`${id}-analysis-tab`}
          hidden={view !== "analysis"}
        >
          {props.result && matrix ? (
            <>
              <dl className="stats-list">
                <div>
                  <dt>Khóa nhập / chuẩn hóa</dt>
                  <dd>
                    {props.result.keyValue} / {normalizedKey}
                  </dd>
                </div>
                <div>
                  <dt>Đầu vào chuẩn hóa</dt>
                  <dd>{normalizedInput}</dd>
                </div>
                <div>
                  <dt>Số digraph</dt>
                  <dd>{inputDigraphs.length}</dd>
                </div>
                <div>
                  <dt>{fillerCount === null ? "Filler khi giải mã" : "Filler được chèn"}</dt>
                  <dd>
                    {fillerCount === null
                      ? (props.result?.padding?.count ?? "Chưa có thông tin")
                      : fillerCount}
                  </dd>
                </div>
              </dl>

              <div className="playfair-analysis__details">
                <div className="key-stream">
                  <strong>Key Matrix 5×5</strong>
                  <pre className="playfair-matrix">
                    {matrix.map((row) => row.join("  ")).join("\n")}
                  </pre>
                </div>
                <div className="key-stream">
                  <strong>Ánh xạ digraph đầu vào → đầu ra</strong>
                  <pre>
                    {inputDigraphs
                      .map((pair, index) => `${pair} → ${outputDigraphs[index] ?? "–"}`)
                      .join("   ")}
                  </pre>
                  <small>
                    Ánh xạ dùng bản thô đủ cặp chữ do backend trả về, trước khi lọc ký tự đệm.
                  </small>
                </div>
              </div>
            </>
          ) : (
            <div className="analysis-empty">Chưa có kết quả để phân tích.</div>
          )}
        </div>

        {props.result?.mode === "decrypt" && (
          <PaddingResult
            raw={props.result.text}
            padding={props.result.padding}
            enabled={props.filterPadding ?? true}
            disabled={props.disabled}
            onChange={props.onFilterPadding ?? (() => {})}
          />
        )}
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
                ? `✓ Xử lý thành công · ${(props.displayResult ?? props.result.text).length} ký tự`
                : "Chưa xử lý"}
        </div>
      </div>
    </section>
  );
}
