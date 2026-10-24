import { useState } from "react";
import { useStandardRsaSignature } from "../hooks/useStandardRsaSignature";
import "./rsa-signatures.css";

export function StandardRsaSignaturePanel({ active }: { active: boolean }) {
  const signature = useStandardRsaSignature(active);
  const [copyStatus, setCopyStatus] = useState("");
  const { draft, result, error } = signature;
  const signing = draft.mode === "sign";
  const outcome = result?.result;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("Đã sao chép.");
    } catch {
      setCopyStatus("Không thể sao chép. Hãy chọn và sao chép thủ công.");
    }
  }
  function fieldError(field: string, value: string) {
    const message =
      error?.field === field ? error.message : value ? signature.fieldErrors[field] : undefined;
    return message ? (
      <small className="rsa__message--error" role="alert">
        {message}
      </small>
    ) : null;
  }
  return (
    <section
      className="rsa__section panel rsa-standard-signature"
      aria-labelledby="rsa-standard-signature-title"
      aria-busy={signature.loading}
    >
      <div className="panel__header">
        <h2 id="rsa-standard-signature-title">Chữ ký văn bản và tệp</h2>
        <span className="rsa__demo-label">RSA-PSS · SHA-256</span>
      </div>
      <form
        className="rsa__section-body"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setCopyStatus("");
          void signature.run();
        }}
      >
        <p className="rsa__help">
          Ký hoặc kiểm tra nội dung bằng khóa PEM. Nội dung được giữ nguyên, gồm dấu cách, xuống
          dòng và BOM của tệp. Chữ ký hợp lệ xác nhận dữ liệu khớp khóa công khai; không xác nhận
          danh tính người ký.
        </p>
        <div className="rsa-standard-signature__options">
          <label className="rsa__field">
            <span>Thao tác chữ ký văn bản</span>
            <select
              value={draft.mode}
              onChange={(event) =>
                signature.update("mode", event.target.value as "sign" | "verify")
              }
            >
              <option value="sign">Ký</option>
              <option value="verify">Kiểm tra</option>
            </select>
          </label>
          <label className="rsa__field">
            <span>Nguồn nội dung chữ ký</span>
            <select
              value={draft.source}
              onChange={(event) =>
                signature.update("source", event.target.value as "text" | "file")
              }
            >
              <option value="text">Văn bản</option>
              <option value="file">Tệp .txt</option>
            </select>
          </label>
        </div>
        {draft.source === "text" ? (
          <label className="rsa__field">
            <span>Nội dung ký / kiểm tra</span>
            <textarea
              rows={6}
              value={draft.text}
              spellCheck={false}
              aria-invalid={Boolean(draft.text && signature.fieldErrors.text)}
              onChange={(event) => signature.update("text", event.target.value)}
            />
            {fieldError("text", draft.text)}
          </label>
        ) : (
          <label className="rsa__field">
            <span>Tệp nội dung .txt</span>
            <input
              type="file"
              accept=".txt"
              onChange={(event) => signature.update("file", event.target.files?.[0] ?? null)}
            />
            {draft.file && <small>Tệp đã chọn: {draft.file.name}</small>}
            {fieldError("file", draft.file?.name ?? "")}
          </label>
        )}
        <p className="rsa__help">
          Tối đa 5 MiB; tệp .txt dùng UTF-8. Khóa PEM và chữ ký tối đa 64 KiB; passphrase tối đa 4
          KiB.
        </p>
        {signing ? (
          <>
            <label className="rsa__field">
              <span>Private key PEM</span>
              <textarea
                rows={6}
                autoComplete="off"
                spellCheck={false}
                value={draft.privateKeyPem}
                onChange={(event) => signature.update("privateKeyPem", event.target.value)}
              />
              {fieldError("privateKeyPem", draft.privateKeyPem)}
            </label>
            <label className="rsa__field">
              <span>Passphrase (nếu khóa được mã hóa)</span>
              <input
                type="password"
                autoComplete="off"
                value={draft.passphrase}
                onChange={(event) => signature.update("passphrase", event.target.value)}
              />
              {fieldError("passphrase", draft.passphrase)}
            </label>
            <p className="rsa__help">
              Khóa riêng và passphrase được gửi tới máy chủ để ký; không lưu vào lịch sử trình
              duyệt. Ô nhập được xóa khi ký thành công hoặc rời phần chữ ký.
            </p>
          </>
        ) : (
          <>
            <label className="rsa__field">
              <span>Public key PEM</span>
              <textarea
                rows={6}
                autoComplete="off"
                spellCheck={false}
                value={draft.publicKeyPem}
                onChange={(event) => signature.update("publicKeyPem", event.target.value)}
              />
              {fieldError("publicKeyPem", draft.publicKeyPem)}
            </label>
            <label className="rsa__field">
              <span>Chữ ký base64</span>
              <textarea
                rows={4}
                autoComplete="off"
                spellCheck={false}
                value={draft.signature}
                onChange={(event) => signature.update("signature", event.target.value)}
              />
              {fieldError("signature", draft.signature)}
            </label>
          </>
        )}
        <div className="button-group">
          <button className="button button--primary" type="submit" disabled={!signature.canRun}>
            {signature.loading ? "Đang xử lý…" : signing ? "Ký nội dung" : "Kiểm tra nội dung"}
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              signature.clear();
              setCopyStatus("");
            }}
          >
            Xóa nội dung và khóa
          </button>
        </div>
        {error && (
          <p className="rsa__message rsa__message--error" role="alert">
            {error.message}
            {error.code ? ` (${error.code})` : ""}
          </p>
        )}
        {outcome && (
          <section className="rsa-standard-signature__result" aria-label="Kết quả chữ ký văn bản">
            <p
              className={`status ${outcome.valid === false ? "status--error" : "status--success"}`}
              role="status"
            >
              {outcome.signature
                ? "Đã ký nội dung."
                : outcome.valid
                  ? "Chữ ký nội dung hợp lệ."
                  : "Chữ ký nội dung không hợp lệ: nội dung hoặc khóa công khai không khớp."}
            </p>
            <dl className="rsa__facts">
              <div>
                <dt>Thuật toán</dt>
                <dd>RSASSA-PSS · SHA-256 · MGF1-SHA-256 · salt 32 byte</dd>
              </div>
              <div>
                <dt>Số byte nội dung</dt>
                <dd>{outcome.contentBytes}</dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd>{outcome.sha256}</dd>
              </div>
            </dl>
            {outcome.signature && (
              <>
                <label className="rsa__field">
                  <span>Chữ ký base64 đã tạo</span>
                  <textarea rows={4} readOnly value={outcome.signature} />
                </label>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => void copy(outcome.signature!)}
                >
                  Sao chép chữ ký base64
                </button>
              </>
            )}
            {outcome.publicKeyPem && (
              <>
                <label className="rsa__field">
                  <span>Public key PEM từ khóa ký</span>
                  <textarea rows={6} readOnly value={outcome.publicKeyPem} />
                </label>
                <div className="button-group">
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void copy(outcome.publicKeyPem!)}
                  >
                    Sao chép public key PEM
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={signature.useForVerification}
                  >
                    Dùng kết quả để kiểm tra
                  </button>
                </div>
              </>
            )}
            <p className="rsa__help" role="status">
              {result!.history.saved
                ? "Đã lưu kết quả vào lịch sử trình duyệt này."
                : `Kết quả đã xử lý; ${result!.history.reason === "disabled" ? "lưu lịch sử đang tắt" : result!.history.reason === "capacity" ? "lịch sử đã đầy" : "dịch vụ lịch sử chưa khả dụng"}.`}
            </p>
          </section>
        )}
        {copyStatus && <p role="status">{copyStatus}</p>}
      </form>
    </section>
  );
}
