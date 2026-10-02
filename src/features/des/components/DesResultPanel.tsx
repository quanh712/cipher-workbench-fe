import type { DesCipherController } from "../hooks/useDesCipher";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ColorizedText } from "../../../shared/components/ColorizedText";
import { DesAnalysis } from "./DesAnalysis";

export function DesResultPanel({ cipher }: { cipher: DesCipherController }) {
  const hasText = Boolean(cipher.result?.text);
  const [view, setView] = useState<"text" | "analysis">("text");
  const id = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const views = ["text", "analysis"] as const;
  function selectTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowRight"
            ? 1 - index
            : null;
    if (next === null) return;
    event.preventDefault();
    setView(views[next]);
    tabs.current[next]?.focus();
  }
  return (
    <section className="cipher-output-panel" aria-label="Kết quả DES">
      <div className="section-label">{cipher.isDemo ? "Kết quả mô phỏng" : "Kết quả"}</div>
      <div className="panel">
        <div className="panel__header">
          <h2>{cipher.mode === "encrypt" ? "Bản mã" : "Bản rõ"}</h2>
          <div className="panel-tabs" role="tablist" aria-label="Kiểu hiển thị kết quả DES">
            {views.map((tab, index) => (
              <button
                key={tab}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                id={`${id}-${tab}-tab`}
                aria-controls={`${id}-${tab}-panel`}
                type="button"
                role="tab"
                aria-selected={view === tab}
                tabIndex={view === tab ? 0 : -1}
                disabled={cipher.isBusy}
                onClick={() => setView(tab)}
                onKeyDown={(event) => selectTab(event, index)}
              >
                {tab === "text" ? "Văn bản" : "Phân tích"}
              </button>
            ))}
          </div>
          <div className="button-group">
            <button
              className="button button--secondary"
              type="button"
              disabled={cipher.isBusy || !cipher.canDownload}
              onClick={cipher.downloadResult}
            >
              Tải kết quả
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={cipher.isBusy || !hasText}
              onClick={cipher.copyResult}
            >
              Sao chép
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={cipher.isBusy || !cipher.result}
              onClick={cipher.clearResult}
            >
              Xóa
            </button>
          </div>
        </div>
        <div
          id={`${id}-text-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-text-tab`}
          hidden={view !== "text"}
        >
          {hasText ? (
            <pre className="output des-result" aria-label="Nội dung kết quả DES">
              <ColorizedText text={cipher.result?.text ?? ""} />
            </pre>
          ) : (
            <div className="output output--empty">
              {cipher.isDemo
                ? "Chưa có nội dung kết quả mô phỏng."
                : "Kết quả sẽ hiển thị ở đây sau khi xử lý."}
            </div>
          )}
        </div>
        <div
          id={`${id}-analysis-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-analysis-tab`}
          hidden={view !== "analysis"}
        >
          {view === "analysis" && <DesAnalysis cipher={cipher} />}
        </div>
        {!cipher.isDemo && cipher.resultOptions?.cipherMode === "CBC" && (
          <div className="key-note">
            CBC · IV: <code>{cipher.resultOptions.iv}</code>. Hãy giữ IV cùng bản mã; giải mã với IV
            sai vẫn có thể thành công nhưng sai dữ liệu.
          </div>
        )}
        {cipher.result?.warnings?.map((warning) => (
          <p className="des-warning" role="status" key={warning.code}>
            {warning.message}
          </p>
        ))}
        <div
          className={`status ${cipher.status === "success" ? "status--success" : cipher.status === "error" ? "status--error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {cipher.isBusy
            ? "Đang gửi yêu cầu…"
            : cipher.status === "error"
              ? "! Xử lý thất bại"
              : cipher.result
                ? cipher.isDemo
                  ? "Dữ liệu mô phỏng — chưa tích hợp Backend DES."
                  : `✓ Xử lý thành công · ${Array.from(cipher.result.text ?? "").length} ký tự`
                : "Chưa xử lý"}
        </div>
      </div>
    </section>
  );
}
