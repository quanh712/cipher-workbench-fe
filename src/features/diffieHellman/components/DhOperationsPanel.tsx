import { useState } from "react";
import { CipherInputPanel } from "../../../shared/components/CipherInputPanel";
import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { KeyAlignedColumns } from "../../../shared/components/KeyAlignedColumns";
import { Notification } from "../../../shared/components/Notification";
import type { DiffieHellmanController } from "../hooks/useDiffieHellman";
import { useDhPractice, type DhSide, type DhPracticeController } from "../hooks/useDhPractice";
import { useDhCaesar } from "../hooks/useDhCaesar";
import { TraceTable } from "./DiffieHellmanAnalysis";
import { DhCaesarOutput } from "./DhCaesarOutput";

function SideSelector({
  side,
  onChange,
  label,
}: {
  side: DhSide;
  onChange: (side: DhSide) => void;
  label: string;
}) {
  return (
    <div className="segmented dh__side-selector" role="group" aria-label={label}>
      {(["A", "B"] as const).map((value) => (
        <button
          key={value}
          type="button"
          className={side === value ? "is-active" : ""}
          aria-pressed={side === value}
          onClick={() => onChange(value)}
        >
          Bên {value}
        </button>
      ))}
    </div>
  );
}
function KeyResults({ practice }: { practice: DhPracticeController }) {
  return (
    <div className="dh__parties">
      {(["A", "B"] as const).map((side) => {
        const key = practice.keys[side];
        const shared = practice.shared[side];
        return (
          <section
            className="panel dh__practice-result"
            key={side}
            aria-label={`Kết quả thực hành bên ${side}`}
          >
            <div className="panel__header">
              <h3>Bên {side}</h3>
              <button
                className="button button--secondary"
                type="button"
                disabled={!key}
                onClick={() => practice.clearKey(side)}
              >
                Xóa cặp khóa
              </button>
            </div>
            <div className="dh__result-body">
              {key ? (
                <>
                  <dl className="stats-list">
                    <div>
                      <dt>Khóa riêng X_{side}</dt>
                      <dd>{key.privateKey}</dd>
                    </div>
                    <div>
                      <dt>Khóa công khai Y_{side}</dt>
                      <dd>{key.response.publicKey}</dd>
                    </div>
                  </dl>
                  <TraceTable
                    compact
                    symbol={`Y_${side} thực hành`}
                    trace={{
                      base: key.alpha,
                      exponent: key.privateKey,
                      modulus: key.q,
                      result: key.response.publicKey,
                      steps: key.response.steps,
                    }}
                  />
                </>
              ) : (
                <p className="dh__help">
                  Chọn bên {side} rồi bấm Tạo cặp khóa để xem khóa và phép tính.
                </p>
              )}
              {shared && (
                <>
                  <div className="dh__preset-bar">
                    <p className="dh__formula">
                      K_{side} = {shared.otherPublicKey}^{shared.privateKey} mod {shared.q} ={" "}
                      {shared.response.sharedKey}
                    </p>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => practice.clearShared(side)}
                    >
                      Xóa khóa chung
                    </button>
                  </div>
                  <TraceTable
                    compact
                    symbol={`K_${side} thực hành`}
                    trace={{
                      base: shared.otherPublicKey,
                      exponent: shared.privateKey,
                      modulus: shared.q,
                      result: shared.response.sharedKey,
                      steps: shared.response.steps,
                    }}
                  />
                </>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
export function DhOperationsPanel({ cipher }: { cipher: DiffieHellmanController }) {
  const [side, setSide] = useState<DhSide>("A");
  const practice = useDhPractice(cipher, side);
  const caesar = useDhCaesar(cipher, side, practice.shared[side] ?? null);
  function changeSide(next: DhSide) {
    if (next === side) return;
    cipher.cancelSupplemental();
    caesar.clearResult();
    setSide(next);
  }
  const busy = cipher.isBusy;
  const params = practice.params?.response;
  return (
    <>
      <section className="dh__practice" aria-label="Thực hành Diffie–Hellman từng bước">
        <header className="dh__section-heading">
          <h2>Thực hành DH</h2>
          <p className="dh__help">
            Dùng tham số phía trên để kiểm tra và đối chiếu từng phép tính. Kết quả của mỗi bên được
            giữ riêng.
          </p>
        </header>
        <section className="panel" aria-label="Kiểm tra và sinh tham số DH">
          <div className="panel__header">
            <h3>Tham số chung</h3>
            <button
              className="button button--secondary"
              type="button"
              disabled={!params}
              onClick={practice.clearParams}
            >
              Xóa kiểm tra tham số
            </button>
          </div>
          <div className="dh__practice-body">
            <p className="dh__formula">
              q = {cipher.draft.q || "chưa nhập"}, α = {cipher.draft.alpha || "chưa chọn"}
            </p>
            <div className="dh__practice-actions">
              <button
                className="button button--primary"
                type="button"
                disabled={busy || !cipher.draft.q.trim()}
                onClick={() => void practice.validateParams()}
              >
                Kiểm tra q và α
              </button>
              <label className="dh__bits">
                Độ dài nhóm
                <select
                  value={practice.bits}
                  onChange={(event) => {
                    cipher.cancelSupplemental();
                    practice.setBits(Number(event.target.value) as 16 | 32 | 64 | 128);
                  }}
                >
                  {[16, 32, 64, 128].map((bits) => (
                    <option value={bits} key={bits}>
                      {bits} bit
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button button--secondary"
                type="button"
                disabled={busy}
                onClick={() => void practice.randomParams()}
              >
                Sinh nhóm tham số
              </button>
            </div>
            <p className="dh__help">
              Kiểm tra thủ công: q ≤ 10¹². Nhóm sinh ngẫu nhiên dùng được đến 128 bit; sinh nhóm mới
              sẽ xóa hai khóa riêng cũ.
            </p>
            {params && (
              <div
                className="dh__parameter-result"
                aria-label="Kết quả kiểm tra tham số"
                role="region"
              >
                <p className="dh__formula">Thừa số của q−1: {params.factors.join(", ")}</p>
                {"p" in params && <p className="dh__formula">q = 2p + 1; p = {params.p}</p>}
                {params.suggestedAlpha && (
                  <div className="dh__preset-bar">
                    <p>Gợi ý α: {params.suggestedAlpha}</p>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={practice.useSuggestion}
                    >
                      Dùng α gợi ý
                    </button>
                  </div>
                )}
                {params.primitiveRootChecks.length > 0 && (
                  <ul className="dh__checks">
                    {params.primitiveRootChecks.map((check) => (
                      <li key={check.factor}>
                        α^{check.exponent} mod q = {check.result}; thừa số {check.factor}:{" "}
                        {check.passes ? "Đạt" : "Không đạt"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
        <div className="dh__preset-bar">
          <SideSelector side={side} onChange={changeSide} label="Bên thực hành DH" />
          <div className="button-group dh__key-actions">
            <button
              className="button button--primary"
              type="button"
              disabled={busy || !cipher.draft.q.trim() || !cipher.draft.alpha.trim()}
              onClick={() => void practice.keypair()}
            >
              Tạo cặp khóa bên {side}
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={busy || !practice.canShared}
              onClick={() => void practice.sharedSecret()}
            >
              Tính khóa chung bên {side}
            </button>
          </div>
        </div>
        {!practice.canShared && (
          <p className="dh__help">
            Tạo cặp khóa cho cả A và B để tính khóa chung từng bên, hoặc dùng kết quả thiết lập bí
            mật chung phía trên.
          </p>
        )}
        <div aria-live="polite">
          {practice.task && cipher.supplementalBusy && (
            <p className="dh__message" role="status">
              Đang {practice.task.toLowerCase()}…
            </p>
          )}
          {practice.error && (
            <p className="dh__message dh__message--error" role="alert">
              {practice.error}
            </p>
          )}
        </div>
        <KeyResults practice={practice} />
      </section>
      <section className="dh__caesar cipher-workspace" aria-label="Caesar bằng khóa chung">
        <header className="dh__section-heading">
          <h2>Caesar bằng khóa chung</h2>
          <p className="dh__help">
            Dùng bí mật chung từ lần trao đổi DH thành công để dịch chữ cái với K mod 26.
          </p>
        </header>
        <CipherModeSelector value={caesar.mode} disabled={false} onChange={caesar.setMode} />
        <div className="helper-row">
          <span>
            {caesar.mode === "encrypt"
              ? "Nhập bản rõ để mã hóa bằng khóa chung DH."
              : "Nhập bản mã để giải mã bằng khóa chung DH."}
          </span>
          <button className="button button--secondary" type="button" onClick={caesar.loadExample}>
            Tạo ví dụ văn bản
          </button>
        </div>
        <KeyAlignedColumns>
          <div className="workspace__input-column">
            <CipherInputPanel
              inputType={caesar.inputType}
              mode={caesar.mode}
              text={caesar.text}
              file={caesar.file}
              fileText={caesar.fileText}
              isReadingFile={caesar.isReadingFile}
              error={caesar.inputError}
              disabled={false}
              ariaLabel="Đầu vào Caesar DH"
              textAriaLabel="Văn bản Caesar"
              fileAriaLabel="Chọn file Caesar DH"
              onInputTypeChange={caesar.setInputType}
              onTextChange={caesar.setText}
              onFileChange={(file) => void caesar.setFile(file)}
              onClear={caesar.resetInput}
              onPaste={() => void caesar.paste()}
              onCopy={() => void caesar.copyInput()}
            />
            <section className="config-section" aria-label="Khóa Caesar từ DH">
              <div className="section-label">Khóa chung</div>
              <div className="panel dh__key-source">
                <SideSelector side={side} onChange={changeSide} label="Bên dùng cho Caesar" />
                {caesar.source ? (
                  <>
                    <p className="dh__formula">K = {caesar.source.sharedKey}; độ dịch = K mod 26</p>
                    <p className="dh__help">
                      Bên {side} dùng khóa riêng của mình và khóa công khai của bên{" "}
                      {side === "A" ? "B" : "A"}. Khóa lấy từ lần tính khóa chung hoặc trao đổi DH
                      thành công.
                    </p>
                  </>
                ) : (
                  <p className="dh__help">
                    Tính khóa chung cho bên đang chọn trong phần thực hành hoặc thiết lập bí mật
                    chung phía trên để dùng Caesar.
                  </p>
                )}
              </div>
            </section>
            <div className="workspace__actions">
              <button
                className="button button--primary"
                type="button"
                disabled={!caesar.canSubmit}
                onClick={() => void caesar.process()}
              >
                {caesar.isRunning
                  ? "Đang xử lý…"
                  : caesar.mode === "encrypt"
                    ? "Mã hóa bằng khóa chung"
                    : "Giải mã bằng khóa chung"}
              </button>
              <button className="button button--secondary" type="button" onClick={caesar.resetAll}>
                Đặt lại Caesar
              </button>
            </div>
          </div>
          <DhCaesarOutput cipher={caesar} />
        </KeyAlignedColumns>
        {caesar.notice && (
          <Notification notice={caesar.notice} onClose={() => caesar.setNotice(null)} />
        )}
      </section>
    </>
  );
}
