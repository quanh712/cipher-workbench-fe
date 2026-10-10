import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ColorizedText } from "../../../shared/components/ColorizedText";
import { CipherAnalysisEmpty } from "../../../shared/components/CipherAnalysisEmpty";
import type { DhCaesarController } from "../hooks/useDhCaesar";

export function DhCaesarOutput({ cipher }: { cipher: DhCaesarController }) {
  const [view, setView] = useState<"text" | "analysis">("text");
  const id = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const views = ["text", "analysis"] as const;
  function key(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % 2
        : event.key === "ArrowLeft"
          ? (index + 1) % 2
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setView(views[next]);
    tabs.current[next]?.focus();
  }
  const result = cipher.result;
  const count = Array.from(result?.source ?? "").reduce(
    (counts, ch) => {
      if (/^[A-Za-z]$/.test(ch)) counts.shifted++;
      else counts.unchanged++;
      return counts;
    },
    { shifted: 0, unchanged: 0 },
  );
  return (
    <section className="cipher-output-panel" aria-label="Kết quả Caesar bằng khóa chung">
      <div className="section-label">Kết quả</div>
      <div className="panel">
        <div className="panel__header">
          <h3>{cipher.mode === "encrypt" ? "Bản mã" : "Bản rõ"}</h3>
          <div className="panel-tabs" role="tablist" aria-label="Kiểu hiển thị kết quả Caesar DH">
            {views.map((next, index) => (
              <button
                key={next}
                ref={(button) => {
                  tabs.current[index] = button;
                }}
                type="button"
                id={`${id}-${next}-tab`}
                role="tab"
                aria-controls={`${id}-${next}-panel`}
                aria-selected={view === next}
                tabIndex={view === next ? 0 : -1}
                onClick={() => setView(next)}
                onKeyDown={(event) => key(event, index)}
              >
                {next === "text" ? "Văn bản" : "Phân tích"}
              </button>
            ))}
          </div>
          <div className="button-group">
            <button
              className="button button--secondary"
              type="button"
              disabled={!result}
              onClick={cipher.download}
            >
              Tải kết quả
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!result}
              onClick={() => void cipher.copyResult()}
            >
              Sao chép
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!result && !cipher.isRunning && !cipher.error}
              onClick={cipher.clearResult}
            >
              Xóa
            </button>
          </div>
        </div>
        <pre
          className={result ? "output" : "output output--empty"}
          role="tabpanel"
          id={`${id}-text-panel`}
          aria-labelledby={`${id}-text-tab`}
          hidden={view !== "text"}
        >
          {result ? (
            <ColorizedText text={result.response.result} />
          ) : (
            "Kết quả sẽ hiển thị ở đây sau khi xử lý."
          )}
        </pre>
        <div
          className="cipher-analysis"
          role="tabpanel"
          id={`${id}-analysis-panel`}
          aria-labelledby={`${id}-analysis-tab`}
          hidden={view !== "analysis"}
        >
          {result ? (
            <>
              <dl className="stats-list">
                <div>
                  <dt>Bên thực hiện</dt>
                  <dd>Bên {result.side}</dd>
                </div>
                <div>
                  <dt>Chế độ</dt>
                  <dd>{result.mode === "encrypt" ? "Mã hóa" : "Giải mã"}</dd>
                </div>
                <div>
                  <dt>Nguồn</dt>
                  <dd>{result.inputType === "text" ? "Văn bản" : `File: ${result.fileName}`}</dd>
                </div>
                <div>
                  <dt>Khóa chung K</dt>
                  <dd>{result.response.sharedKey}</dd>
                </div>
                <div>
                  <dt>Độ dịch Caesar</dt>
                  <dd>
                    {result.response.sharedKey} mod 26 = {result.response.shift}
                  </dd>
                </div>
                <div>
                  <dt>Tổng ký tự</dt>
                  <dd>{count.shifted + count.unchanged}</dd>
                </div>
                <div>
                  <dt>Chữ cái ASCII</dt>
                  <dd>{count.shifted}</dd>
                </div>
                <div>
                  <dt>Ký tự giữ nguyên</dt>
                  <dd>{count.unchanged}</dd>
                </div>
              </dl>
              <div className="analysis-section dh__caesar-analysis-notes">
                <p className="dh__formula">
                  {result.mode === "encrypt" ? "C = (P + " : "P = (C − "}
                  {result.response.shift}) mod 26
                </p>
                <p className="dh__help">
                  Chỉ dịch A–Z và a–z; giữ nguyên Unicode, dấu câu và xuống dòng.
                </p>
              </div>
            </>
          ) : (
            <CipherAnalysisEmpty />
          )}
        </div>
        {result?.response.warning && (
          <p className="dh__notice">{result.response.warning.message}</p>
        )}
        <div
          className={`status ${cipher.error ? "status--error" : result ? "status--success" : ""}`}
          role={cipher.error ? "alert" : "status"}
          aria-live="polite"
        >
          {cipher.error ??
            (cipher.isRunning
              ? "Đang xử lý Caesar bằng khóa chung…"
              : result
                ? `✓ Xử lý thành công · ${Array.from(result.response.result).length} ký tự`
                : "Chưa xử lý")}
        </div>
      </div>
    </section>
  );
}
