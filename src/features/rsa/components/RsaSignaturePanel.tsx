import { Notification } from "../../../shared/components/Notification";
import { useRef } from "react";
import type { useRsaSignature } from "../hooks/useRsaSignature";

type SignatureController = ReturnType<typeof useRsaSignature>;

function ClipboardActions({
  value,
  label,
  onPaste,
  onCopy,
  onClear,
}: {
  value: string;
  label: string;
  onPaste: () => void;
  onCopy: () => void;
  onClear: () => void;
}) {
  return (
    <div className="button-group" role="group" aria-label={`Thao tác ${label}`}>
      <button className="button button--secondary" type="button" onClick={onPaste}>
        Dán
      </button>
      <button className="button button--secondary" type="button" disabled={!value} onClick={onCopy}>
        Sao chép
      </button>
      <button
        className="button button--secondary"
        type="button"
        disabled={!value}
        onClick={onClear}
      >
        Xóa
      </button>
    </div>
  );
}

export function RsaSignaturePanel({ signature }: { signature: SignatureController }) {
  const modeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const signing = signature.mode === "sign";
  const result = signature.result;
  const messageError = signature.message ? signature.fieldErrors.message : undefined;
  const signatureError = signature.signature ? signature.fieldErrors.signature : undefined;
  const keyError = signature.message || signature.signature ? signature.fieldErrors.key : undefined;
  const modes = ["sign", "verify"] as const;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      signature.setNotice({ kind: "success", message: "Đã sao chép." });
    } catch {
      signature.setNotice({
        kind: "error",
        message: "Không thể sao chép. Hãy chọn nội dung và sao chép thủ công.",
      });
    }
  }
  async function paste(field: "message" | "signature") {
    try {
      const value = await navigator.clipboard.readText();
      if (field === "message") signature.setMessage(value);
      else signature.setSignature(value);
      signature.setNotice({ kind: "success", message: "Đã dán nội dung từ clipboard." });
    } catch {
      signature.setNotice({ kind: "error", message: "Không thể đọc nội dung clipboard." });
    }
  }
  const output = result?.signature ?? result?.recoveredMessage ?? "";

  return (
    <section className="rsa__section panel" aria-labelledby="rsa-signature-title">
      <div className="panel__header">
        <h2 id="rsa-signature-title">{signing ? "Ký một thông điệp số" : "Kiểm tra chữ ký số"}</h2>
        <span className="rsa__demo-label">RSA học thuật</span>
      </div>
      <form
        className="rsa__section-body"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void signature.run();
        }}
      >
        <section className="mode-section" aria-label="Chế độ chữ ký số">
          <div className="section-label">Chế độ</div>
          <div className="mode-selector" role="radiogroup" aria-label="Thao tác chữ ký số">
            {modes.map((mode, index) => (
              <button
                ref={(element) => {
                  modeRefs.current[index] = element;
                }}
                className={
                  signature.mode === mode ? "mode-button mode-button--active" : "mode-button"
                }
                type="button"
                key={mode}
                role="radio"
                aria-checked={signature.mode === mode}
                tabIndex={signature.mode === mode ? 0 : -1}
                onClick={() => signature.setMode(mode)}
                onKeyDown={(event) => {
                  let next: number | null = null;
                  if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key))
                    next = 1 - index;
                  if (event.key === "Home") next = 0;
                  if (event.key === "End") next = 1;
                  if (next === null) return;
                  event.preventDefault();
                  signature.setMode(modes[next]);
                  modeRefs.current[next]?.focus();
                }}
              >
                <span aria-hidden="true">{mode === "sign" ? "✍" : "✓"}</span>
                <span>
                  <small>Chế độ</small>
                  {mode === "sign" ? "Ký" : "Kiểm tra"}
                </span>
              </button>
            ))}
          </div>
        </section>
        <p className="rsa__help">
          {signing
            ? "Dùng khóa riêng {d, n} để ký thông điệp m; nhập thêm e để trả khóa công khai."
            : "Dùng khóa công khai {e, n} của người ký để kiểm tra chữ ký s với thông điệp gốc m."}{" "}
          Mỗi số phải thỏa 0 ≤ m, s &lt; n.
        </p>
        <p className="rsa__help">
          Bấm Tạo ví dụ để điền khóa và dữ liệu mẫu cho chế độ đang chọn. Kết quả và các bước tính
          được trả về từ backend.
        </p>
        <details className="rsa__details rsa__demo-note">
          <summary>Thử tình huống chữ ký sai</summary>
          <p>Chọn một tình huống để điền khóa và dữ liệu mẫu.</p>
          <div className="rsa__presets" role="group" aria-label="Kịch bản chữ ký minh họa">
            {signature.scenarios
              .filter((scenario) => scenario.id === "verify-invalid")
              .map((scenario) => (
                <button
                  className="button button--secondary"
                  key={scenario.id}
                  type="button"
                  aria-pressed={signature.scenario === scenario.id}
                  onClick={() => signature.loadScenario(scenario.id)}
                >
                  {scenario.label}
                </button>
              ))}
          </div>
        </details>
        <div className="panel rsa__signature-input">
          <div className="rsa__signature-fields">
            <div>
              <label className="rsa__field">
                <span>Thông điệp gốc m (số)</span>
                <input
                  value={signature.message}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(messageError)}
                  aria-describedby={messageError ? "rsa-signature-message-error" : undefined}
                  onChange={(event) => signature.setMessage(event.target.value)}
                />
                {messageError && (
                  <small id="rsa-signature-message-error" role="alert">
                    {messageError}
                  </small>
                )}
              </label>
              <ClipboardActions
                label="thông điệp"
                value={signature.message}
                onPaste={() => void paste("message")}
                onCopy={() => void copy(signature.message)}
                onClear={() => signature.setMessage("")}
              />
            </div>
            {!signing && (
              <div>
                <label className="rsa__field">
                  <span>Chữ ký s (số)</span>
                  <input
                    value={signature.signature}
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(signatureError)}
                    aria-describedby={signatureError ? "rsa-signature-value-error" : undefined}
                    onChange={(event) => signature.setSignature(event.target.value)}
                  />
                  {signatureError && (
                    <small id="rsa-signature-value-error" role="alert">
                      {signatureError}
                    </small>
                  )}
                </label>
                <ClipboardActions
                  label="chữ ký"
                  value={signature.signature}
                  onPaste={() => void paste("signature")}
                  onCopy={() => void copy(signature.signature)}
                  onClear={() => signature.setSignature("")}
                />
              </div>
            )}
          </div>
          <div
            className={`status ${messageError || signatureError || keyError ? "status--error" : signature.message && (signing || signature.signature) ? "status--success" : ""}`}
            role="status"
            aria-live="polite"
          >
            {messageError || signatureError || keyError
              ? "! Kiểm tra lại dữ liệu hoặc khóa."
              : signature.message && (signing || signature.signature)
                ? "✓ Đầu vào hợp lệ ở mức sơ bộ."
                : "Chưa có dữ liệu"}
          </div>
        </div>
        {keyError && (
          <p className="rsa__message rsa__message--error" role="alert">
            {keyError}
          </p>
        )}
        <button className="button button--primary" type="submit" disabled={!signature.canRun}>
          {signature.loading ? "Đang xử lý…" : signing ? "Ký" : "Kiểm tra"}
        </button>
        <div className="rsa__signature-result" aria-live="polite" aria-atomic="true">
          {result && (
            <>
              <div className="panel rsa__signature-outcome">
                <div className="panel__header">
                  <h2>{signing ? "Kết quả ký" : "Kết quả kiểm tra"}</h2>
                  <div className="button-group" role="group" aria-label="Thao tác kết quả chữ ký">
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={!output}
                      onClick={() => void copy(output)}
                    >
                      Sao chép
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={signature.clearResult}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
                {result.kind !== "error" && (
                  <dl className="rsa__facts">
                    {result.signature !== undefined && (
                      <div>
                        <dt>Chữ ký s</dt>
                        <dd>{result.signature}</dd>
                      </div>
                    )}
                    {result.recoveredMessage !== undefined && (
                      <div>
                        <dt>Thông điệp khôi phục m′</dt>
                        <dd>{result.recoveredMessage}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {result.kind !== "signed" && (
                  <p className="rsa__help rsa__signature-detail">{result.message}</p>
                )}
                <div
                  className={`status ${result.kind === "error" || result.kind === "invalid" ? "status--error" : "status--success"}`}
                  role="status"
                >
                  {result.kind === "signed"
                    ? "Đã ký"
                    : result.kind === "valid"
                      ? "Chữ ký hợp lệ"
                      : result.kind === "invalid"
                        ? "Chữ ký không hợp lệ"
                        : "Lỗi dịch vụ"}
                </div>
              </div>
              {result.warning && <p className="rsa__help">{result.warning}</p>}
              {result.history && !result.history.saved && (
                <p className="rsa__help" role="status">
                  Kết quả đã xử lý;{" "}
                  {result.history.reason === "disabled"
                    ? "lưu lịch sử đang tắt"
                    : result.history.reason === "capacity"
                      ? "lịch sử đã đầy"
                      : "dịch vụ lịch sử chưa khả dụng"}
                  .
                </p>
              )}
              {result.rows && result.rows.length > 0 && (
                <details className="rsa__details">
                  <summary>Xem từng bước {signing ? "ký" : "kiểm tra"}</summary>
                  <div className="rsa__table-wrap" tabIndex={0}>
                    <table className="rsa__table" aria-label="Các bước chữ ký RSA">
                      <thead>
                        <tr>
                          <th>i</th>
                          <th>Bit</th>
                          <th>Cơ số</th>
                          <th>Trước</th>
                          <th>Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, index) => (
                          <tr key={index}>
                            <td>{row.index}</td>
                            <td>{row.bit}</td>
                            <td>{row.base}</td>
                            <td>{row.before}</td>
                            <td>{row.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              {result.steps.length > 0 && (
                <details className="rsa__details">
                  <summary>Xem từng bước {signing ? "ký" : "kiểm tra"}</summary>
                  <ol className="rsa__signature-steps">
                    {result.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </div>
        <details className="rsa__details">
          <summary>Cách ký và kiểm tra RSA học thuật</summary>
          <div className="rsa__explanation">
            <div>
              <h2>Ký bằng khóa riêng</h2>
              <p>Người ký tính s = mᵈ mod n, rồi gửi thông điệp m cùng chữ ký s.</p>
              <h2>Kiểm tra bằng khóa công khai</h2>
              <p>Người nhận tính m′ = sᵉ mod n. Chữ ký hợp lệ khi m′ = m.</p>
            </div>
            <div>
              <h2>Giới hạn của ví dụ</h2>
              <p>
                Đây là RSA học thuật với số nhỏ, không có bước băm hay padding. Ví dụ giúp hiểu phép
                tính, không dùng để ký tài liệu thực tế.
              </p>
              <p>
                Chữ ký hợp lệ cho biết dữ liệu khớp với khóa công khai được dùng; không tự chứng
                minh danh tính người sở hữu khóa.
              </p>
            </div>
          </div>
        </details>
        {signature.notice && (
          <Notification notice={signature.notice} onClose={signature.closeNotice} />
        )}
      </form>
    </section>
  );
}
