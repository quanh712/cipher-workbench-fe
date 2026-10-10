import { useRef } from "react";
import type { useRsaSignature } from "../hooks/useRsaSignature";

type SignatureController = ReturnType<typeof useRsaSignature>;

export function RsaSignaturePanel({ signature }: { signature: SignatureController }) {
  const modeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const signing = signature.mode === "sign";
  const result = signature.result;
  const messageError = signature.message ? signature.fieldErrors.message : undefined;
  const signatureError = signature.signature ? signature.fieldErrors.signature : undefined;
  const keyError = signature.message || signature.signature ? signature.fieldErrors.key : undefined;
  const modes = ["sign", "verify"] as const;
  return (
    <section className="rsa__section panel" aria-labelledby="rsa-signature-title">
      <div className="panel__header">
        <h2 id="rsa-signature-title">{signing ? "Ký một thông điệp số" : "Kiểm tra chữ ký số"}</h2>
        <span className="rsa__demo-label">Dữ liệu minh họa</span>
      </div>
      <form
        className="rsa__section-body"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          signature.runDemo();
        }}
      >
        <div className="rsa__signature-modes" role="radiogroup" aria-label="Thao tác chữ ký số">
          {modes.map((mode, index) => (
            <button
              ref={(element) => {
                modeRefs.current[index] = element;
              }}
              className="button button--secondary"
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
              {mode === "sign" ? "Ký" : "Kiểm tra"}
            </button>
          ))}
        </div>
        <p className="rsa__help">
          {signing
            ? "Dùng khóa riêng {d, n} để ký thông điệp m."
            : "Dùng khóa công khai {e, n} của người ký để kiểm tra chữ ký s với thông điệp gốc m."}{" "}
          Mỗi số phải thỏa 0 ≤ m, s &lt; n.
        </p>
        <div className="rsa__demo-note">
          <strong>Thử với bộ ví dụ cố định</strong>
          <p>
            Chọn kịch bản để điền khóa và dữ liệu mẫu. Kết quả minh họa chỉ áp dụng cho bộ dữ liệu
            đó. Dữ liệu tự nhập đang chờ backend.
          </p>
          <div className="rsa__presets" role="group" aria-label="Kịch bản chữ ký minh họa">
            {signature.scenarios.map((scenario) => (
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
        </div>
        <div className="rsa__signature-fields">
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
          {!signing && (
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
          )}
        </div>
        {keyError && (
          <p className="rsa__message rsa__message--error" role="alert">
            {keyError}
          </p>
        )}
        <button className="button button--primary" type="submit" disabled={!signature.canRunDemo}>
          {signing ? "Ký minh họa" : "Kiểm tra minh họa"}
        </button>
        {!signature.canRunDemo && (
          <p className="rsa__message rsa__message--pending" role="status">
            <strong>Chờ backend.</strong> Chọn một kịch bản ở trên để xem kết quả minh họa.
          </p>
        )}
        <div className="rsa__signature-result" aria-live="polite" aria-atomic="true">
          {result && (
            <>
              <p
                className={`rsa__message ${result.kind === "error" ? "rsa__message--error" : result.kind === "invalid" ? "rsa__message--invalid" : "rsa__message--success"}`}
              >
                <strong>
                  {result.kind === "signed"
                    ? "Đã ký minh họa"
                    : result.kind === "valid"
                      ? "Chữ ký hợp lệ"
                      : result.kind === "invalid"
                        ? "Chữ ký không hợp lệ"
                        : "Lỗi dịch vụ minh họa"}
                </strong>
                <span>{result.message}</span>
              </p>
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
              {result.steps.length > 0 && (
                <details className="rsa__details">
                  <summary>Xem từng bước {signing ? "ký" : "kiểm tra"} minh họa</summary>
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
      </form>
    </section>
  );
}
