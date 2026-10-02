import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ColorizedText } from "../../../shared/components/ColorizedText";
import type { CipherMode } from "../../../shared/types/cipher";
import type { ColumnarResultSnapshot, ProcessingStatus } from "../types/cipher";
import { buildColumnarAnalysis } from "../utils/analysis";

interface ColumnarOutputPanelProps {
  result: ColumnarResultSnapshot | null;
  mode: CipherMode;
  processingStatus: ProcessingStatus;
  disabled: boolean;
  onClear: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

const VIEWS = ["text", "analysis"] as const;

function visibleCharacter(character: string): string {
  if (character === " ") return "␠";
  if (character === "\n") return "↵";
  if (character === "\r") return "↩";
  if (character === "\t") return "⇥";
  if (character === "\f") return "␌";
  if (character === "\v") return "␋";
  if (character === "\uFEFF") return "BOM";
  if (/\p{Mark}/u.test(character)) return `◌${character}`;
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Zs}]/u.test(character)) {
    return `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  return character;
}

function visibleSegment(segment: string): string {
  return segment ? Array.from(segment, visibleCharacter).join("") : "∅";
}

export function ColumnarOutputPanel(props: ColumnarOutputPanelProps) {
  const [view, setView] = useState<(typeof VIEWS)[number]>("text");
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const analysis = useMemo(
    () =>
      props.result
        ? buildColumnarAnalysis({
            sourceText: props.result.source,
            result: props.result.text,
            mode: props.result.mode,
            key: props.result.key,
          })
        : null,
    [props.result],
  );

  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % VIEWS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = VIEWS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setView(VIEWS[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="columnar-output-panel cipher-output-panel">
      <div className="section-label">Kết quả</div>
      <div className="panel">
        <div className="panel__header">
          <h2>{props.mode === "encrypt" ? "Bản mã" : "Bản rõ"}</h2>
          <div className="panel-tabs" role="tablist" aria-label="Kiểu hiển thị kết quả">
            {VIEWS.map((nextView, index) => (
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
                disabled={props.disabled}
                onClick={() => setView(nextView)}
                onKeyDown={(event) => selectWithKeyboard(event, index)}
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
          className="columnar-analysis"
          role="tabpanel"
          aria-labelledby={`${id}-analysis-tab`}
          hidden={view !== "analysis"}
        >
          {analysis ? (
            <>
              <dl className="stats-list">
                <div>
                  <dt>Khóa nhập / hiệu lực</dt>
                  <dd>
                    {analysis.rawKey} / {analysis.canonicalKey}
                  </dd>
                </div>
                <div>
                  <dt>Hoán vị cột</dt>
                  <dd>{analysis.permutation.join(", ")}</dd>
                </div>
                <div>
                  <dt>Đầu vào</dt>
                  <dd>
                    {visibleSegment(analysis.sourcePreview)}
                    {analysis.codePointCount > 200 ? "… (bản xem trước)" : ""}
                  </dd>
                </div>
                <div>
                  <dt>Số ký tự Unicode</dt>
                  <dd>{analysis.codePointCount}</dd>
                </div>
                <div>
                  <dt>Độ dài từng cột</dt>
                  <dd>{analysis.columnLengths.join(", ")}</dd>
                </div>
              </dl>

              <div className="columnar-analysis__order">
                <strong>
                  {analysis.mode === "encrypt" ? "Thứ tự đọc cột" : "Phân bổ bản mã vào cột"}
                </strong>
                <ol>
                  {analysis.readOrder.map((column, index) => (
                    <li key={column}>
                      <span>{index + 1}</span>
                      Cột {column}
                      <code>{visibleSegment(analysis.columnSegments[column - 1])}</code>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="columnar-analysis__matrix">
                <div className="columnar-analysis__matrix-heading">
                  <strong>Ma trận {analysis.permutation.length} cột</strong>
                  <span>
                    {analysis.isPreview
                      ? `Bản xem trước: ${analysis.rows.length} / ${analysis.totalRows} hàng`
                      : `${analysis.totalRows} hàng`}
                  </span>
                </div>
                <div className="columnar-matrix-viewport">
                  <table className="columnar-matrix" aria-label="Ma trận Hệ mã hàng">
                    <thead>
                      <tr>
                        {analysis.permutation.map((rank, index) => (
                          <th key={index} scope="col">
                            <span>{rank}</span>
                            <small>Cột {index + 1}</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((character, columnIndex) => (
                            <td
                              key={columnIndex}
                              className={character === null ? "columnar-matrix__empty" : undefined}
                              aria-label={
                                character === null
                                  ? `Hàng ${rowIndex + 1}, cột ${columnIndex + 1}: trống`
                                  : `Hàng ${rowIndex + 1}, cột ${columnIndex + 1}: ${visibleCharacter(character)}`
                              }
                            >
                              {character === null ? "·" : visibleCharacter(character)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <small>
                  {analysis.isPreview &&
                    (analysis.rows.length < analysis.totalRows
                      ? `Chỉ hiện ${analysis.rows.length} hàng đầu và đoạn đầu của từng cột. `
                      : `Hiện đủ ${analysis.totalRows} hàng; chỉ rút gọn phần Đầu vào. `)}
                  Ký hiệu: ␠ khoảng trắng, ↵ xuống dòng, ↩ CR, ⇥ tab. "BOM" là U+FEFF; tab Văn bản
                  giữ nguyên dữ liệu. Ma trận chỉ giải thích phép hoán vị; kết quả chính thức lấy từ
                  Backend.
                </small>
              </div>
            </>
          ) : (
            <div className="analysis-empty">
              {props.result
                ? "Không thể dựng Phân tích từ kết quả này. Kết quả chính thức vẫn ở tab Văn bản."
                : "Chưa có kết quả để phân tích."}
            </div>
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
                ? `✓ Xử lý thành công · ${Array.from(props.result.text).length} ký tự`
                : "Chưa xử lý"}
        </div>
      </div>
    </section>
  );
}
