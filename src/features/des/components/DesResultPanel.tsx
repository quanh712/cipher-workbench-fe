import type { DesCipherController } from "../hooks/useDesCipher";

export function DesResultPanel({ cipher }: { cipher: DesCipherController }) {
  const hasText = Boolean(cipher.result?.text);
  return (
    <section aria-label="Kết quả DES">
      <div className="section-label">{cipher.isDemo ? "Kết quả mô phỏng" : "Kết quả"}</div>
      <div className="panel">
        <div className="panel__header">
          <h2>{cipher.mode === "encrypt" ? "Bản mã" : "Bản rõ"}</h2>
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
        {hasText ? (
          <pre className="output des-result" aria-label="Nội dung kết quả DES">
            {cipher.result?.text}
          </pre>
        ) : (
          <div className="output output--empty">
            {cipher.isDemo
              ? "Chưa có nội dung kết quả mô phỏng."
              : "Kết quả DES sẽ xuất hiện ở đây."}
          </div>
        )}
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
        <div className="status" role="status" aria-live="polite">
          {cipher.isBusy
            ? "Đang xử lý…"
            : cipher.result
              ? cipher.isDemo
                ? "Dữ liệu mô phỏng — chưa tích hợp Backend DES."
                : "Kết quả từ Backend DES."
              : "Chưa có kết quả"}
        </div>
      </div>
    </section>
  );
}
