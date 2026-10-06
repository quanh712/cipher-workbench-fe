import type { RsaCipherController } from "../hooks/useRsaCipher";
import type { EuclidRow, ModPowRow, RsaParameters, RsaTask } from "../types/cipher";
import "./rsa.css";

const presets: { label: string; parameters: RsaParameters }[] = [
  { label: "Giáo trình · 17, 11, 7", parameters: { p: "17", q: "11", e: "7" } },
  { label: "61, 53, 17", parameters: { p: "61", q: "53", e: "17" } },
  {
    label: "Tiếng Việt · 101, 113, 3533",
    parameters: { p: "101", q: "113", e: "3533" },
  },
];

function TaskMessage({ cipher, task }: { cipher: RsaCipherController; task: RsaTask }) {
  if (cipher.taskErrors[task]) {
    return (
      <p className="rsa__message rsa__message--error" role="alert">
        {cipher.taskErrors[task]}
      </p>
    );
  }
  if (cipher.statuses[task] === "loading") {
    return (
      <p className="rsa__message" role="status">
        Đang xử lý…
      </p>
    );
  }
  return null;
}

function EuclidTable({ rows }: { rows: EuclidRow[] }) {
  return (
    <div className="rsa__table-wrap">
      <table className="rsa__table">
        <caption>Các bước Euclid mở rộng</caption>
        <thead>
          <tr>
            <th scope="col">Thương q</th>
            <th scope="col">Số dư r</th>
            <th scope="col">Hệ số t</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={row.remainder === "1" ? "rsa__table-row--hit" : ""}>
              <td>{row.quotient ?? "—"}</td>
              <td>{row.remainder}</td>
              <td>{row.coefficient}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModPowTable({ rows, title }: { rows: ModPowRow[]; title: string }) {
  return (
    <div className="rsa__table-wrap">
      <table className="rsa__table">
        <caption>
          {title} · Số mũ dạng nhị phân:{" "}
          {rows
            .map((row) => row.bit)
            .reverse()
            .join("")}{" "}
          · {rows.length} vòng
        </caption>
        <thead>
          <tr>
            <th scope="col">Bit thứ</th>
            <th scope="col">Bit</th>
            <th scope="col">Cơ số</th>
            <th scope="col">Trước bước</th>
            <th scope="col">Sau bước</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.index} className={row.bit === 1 ? "rsa__table-row--hit" : ""}>
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
  );
}

export function RsaWorkspace({ cipher }: { cipher: RsaCipherController }) {
  const { draft, key, numberResult, textResult, fieldErrors, statuses } = cipher;
  const numberRecovered = Boolean(
    numberResult?.plaintextInRange && numberResult.decrypted === numberResult.plaintext,
  );
  const keyDisabled = !cipher.hasGateway || statuses.key === "loading";
  const numberDisabled = !cipher.hasGateway || !key || statuses.number === "loading";
  const textDisabled = !cipher.hasGateway || !key || statuses.text === "loading";

  return (
    <div className="cipher-workspace rsa" aria-busy={cipher.isBusy}>
      <header className="rsa__intro">
        <div>
          <h2>RSA từng bước</h2>
          <p>
            Tạo khóa của người nhận, mã hóa bằng khóa công khai rồi giải mã bằng khóa riêng. Các
            phép tính ở đây dùng số nhỏ để bạn thấy từng bước.
          </p>
        </div>
        <span className="rsa__education-badge">Minh họa thuật toán</span>
      </header>

      <ol className="rsa__flow" aria-label="Luồng mã hóa RSA">
        <li>
          <strong>Bob sinh khóa</strong>
          <span>
            Công bố {"{e, n}"}, giữ {"{d, n}"}
          </span>
        </li>
        <li>
          <strong>Alice mã hóa</strong>
          <span>Dùng khóa công khai của Bob</span>
        </li>
        <li>
          <strong>Gửi bản mã</strong>
          <span>Truyền C qua kênh liên lạc</span>
        </li>
        <li>
          <strong>Bob giải mã</strong>
          <span>Dùng khóa riêng của mình</span>
        </li>
      </ol>

      {!cipher.hasGateway && (
        <p className="rsa__message rsa__message--pending" role="status">
          Giao diện RSA đã sẵn sàng. Chức năng tính toán sẽ mở sau khi Backend RSA được kết nối.
        </p>
      )}

      <section className="rsa__section panel" aria-labelledby="rsa-key-title">
        <div className="panel__header">
          <h2 id="rsa-key-title">Sinh khóa</h2>
          <code>n = p·q · φ(n) = (p−1)(q−1)</code>
        </div>
        <div className="rsa__section-body">
          <p className="rsa__help">
            Chọn hai số nguyên tố khác nhau và số mũ e nguyên tố cùng nhau với φ(n). d là nghịch đảo
            của e theo modulo φ(n).
          </p>
          <div className="rsa__presets" role="group" aria-label="Bộ tham số mẫu RSA">
            {presets.map((preset) => (
              <button
                className="button button--secondary"
                key={preset.label}
                type="button"
                disabled={!cipher.hasGateway}
                onClick={() => cipher.choosePreset(preset.parameters)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="rsa__fields">
            {(["p", "q", "e"] as const).map((field) => (
              <label className="rsa__field" key={field}>
                <span>{field === "e" ? "e · số mũ công khai" : `${field} · số nguyên tố`}</span>
                <input
                  value={draft[field]}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(fieldErrors[field])}
                  onChange={(event) => cipher.setParameter(field, event.target.value)}
                />
                {fieldErrors[field] && <small role="alert">{fieldErrors[field]}</small>}
              </label>
            ))}
          </div>
          <button
            className="button button--primary"
            type="button"
            disabled={keyDisabled}
            onClick={() => void cipher.generateKey()}
          >
            Sinh khóa
          </button>
          <TaskMessage cipher={cipher} task="key" />
          {key && (
            <>
              <dl className="rsa__facts">
                <div>
                  <dt>n = p·q</dt>
                  <dd>{key.n}</dd>
                </div>
                <div>
                  <dt>φ(n)</dt>
                  <dd>{key.phi}</dd>
                </div>
                <div className="rsa__fact--public">
                  <dt>Khóa công khai của Bob</dt>
                  <dd>{`{${key.e}, ${key.n}}`}</dd>
                </div>
                <div className="rsa__fact--private">
                  <dt>Khóa riêng của Bob</dt>
                  <dd>{`{${key.d}, ${key.n}}`}</dd>
                </div>
              </dl>
              <p className="rsa__message rsa__message--success" role="status">
                Kiểm tra: e·d mod φ(n) = {key.verification}
              </p>
              <details className="rsa__details">
                <summary>Xem từng bước Euclid mở rộng tìm d</summary>
                <EuclidTable rows={key.euclidRows} />
              </details>
            </>
          )}
        </div>
      </section>

      <section className="rsa__section panel" aria-labelledby="rsa-number-title">
        <div className="panel__header">
          <h2 id="rsa-number-title">Mã hóa và giải mã một khối số</h2>
          <code>0 ≤ P &lt; n</code>
        </div>
        <div className="rsa__section-body">
          <p className="rsa__help">
            Alice tính C = Pᵉ mod n. Bob dùng khóa riêng để tính P′ = Cᵈ mod n.
          </p>
          <div className="rsa__action-line">
            <label className="rsa__field">
              <span>Bản rõ P (số)</span>
              <input
                value={draft.plaintext}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(fieldErrors.plaintext)}
                onChange={(event) => cipher.setPlaintext(event.target.value)}
              />
              {fieldErrors.plaintext && <small role="alert">{fieldErrors.plaintext}</small>}
            </label>
            <button
              className="button button--primary"
              type="button"
              disabled={numberDisabled}
              onClick={cipher.processNumber}
            >
              Mã hóa rồi giải mã
            </button>
          </div>
          {!key && cipher.hasGateway && (
            <p className="rsa__help">Hãy sinh khóa trước khi xử lý một khối số.</p>
          )}
          <TaskMessage cipher={cipher} task="number" />
          {numberResult && (
            <>
              <dl className="rsa__facts rsa__facts--three">
                <div>
                  <dt>Bản rõ P</dt>
                  <dd>{numberResult.plaintext}</dd>
                </div>
                <div className="rsa__fact--public">
                  <dt>Bản mã C</dt>
                  <dd>{numberResult.ciphertext}</dd>
                </div>
                <div className="rsa__fact--private">
                  <dt>Giải mã P′</dt>
                  <dd>{numberResult.decrypted}</dd>
                </div>
              </dl>
              <p
                className={`rsa__message ${numberRecovered ? "rsa__message--success" : "rsa__message--error"}`}
                role="status"
              >
                {numberRecovered
                  ? `Giải mã khôi phục đúng P = ${numberResult.plaintext}.`
                  : numberResult.plaintextInRange
                    ? "Kết quả giải mã không khớp P. Hãy thử lại."
                    : `P ≥ n nên chỉ khôi phục được P mod n = ${numberResult.decrypted}.`}
              </p>
              <details className="rsa__details" open>
                <summary>Bảng tính C = Pᵉ mod n</summary>
                <ModPowTable rows={numberResult.encryptRows} title="Các bước mã hóa" />
              </details>
              <details className="rsa__details">
                <summary>Bảng tính P′ = Cᵈ mod n</summary>
                <ModPowTable rows={numberResult.decryptRows} title="Các bước giải mã" />
              </details>
            </>
          )}
        </div>
      </section>

      <section className="rsa__section panel" aria-labelledby="rsa-text-title">
        <div className="panel__header">
          <h2 id="rsa-text-title">Văn bản: mỗi ký tự là một khối</h2>
        </div>
        <div className="rsa__section-body">
          <p className="rsa__help">
            Mỗi Unicode code point được đổi thành một số P. Để khôi phục đúng, mã của từng ký tự
            phải nhỏ hơn n.
          </p>
          <label className="rsa__field rsa__field--text">
            <span>Thông điệp</span>
            <textarea
              value={draft.text}
              rows={3}
              aria-invalid={Boolean(fieldErrors.text)}
              onChange={(event) => cipher.setText(event.target.value)}
            />
            {fieldErrors.text && <small role="alert">{fieldErrors.text}</small>}
          </label>
          <button
            className="button button--primary"
            type="button"
            disabled={textDisabled}
            onClick={cipher.processText}
          >
            Mã hóa văn bản
          </button>
          {!key && cipher.hasGateway && <p className="rsa__help">Hãy sinh khóa trước.</p>}
          <TaskMessage cipher={cipher} task="text" />
          {textResult && (
            <>
              <p
                className={`rsa__message ${textResult.invalidCount ? "rsa__message--error" : "rsa__message--success"}`}
                role="status"
              >
                {textResult.invalidCount
                  ? `${textResult.invalidCount} ký tự có mã ≥ n nên không khôi phục được. Hãy dùng n lớn hơn.`
                  : `Bản mã gửi đi: ${textResult.rows.map((row) => row.ciphertext).join(" ")}`}
              </p>
              <div className="rsa__table-wrap">
                <table className="rsa__table">
                  <caption>Kết quả mã hóa từng ký tự</caption>
                  <thead>
                    <tr>
                      <th scope="col">Ký tự</th>
                      <th scope="col">P (mã)</th>
                      <th scope="col">C</th>
                      <th scope="col">Cᵈ mod n</th>
                      <th scope="col">Giải ra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {textResult.rows.map((row, index) => (
                      <tr key={index} className={!row.recovered ? "rsa__table-row--error" : ""}>
                        <td>{row.character === " " ? "␣" : row.character}</td>
                        <td>{row.plaintext}</td>
                        <td>{row.ciphertext}</td>
                        <td>{row.decrypted}</td>
                        <td>
                          {row.recovered ? (row.character === " " ? "␣" : row.character) : "✗ sai"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rsa__explanation" aria-labelledby="rsa-why-title">
        <div>
          <h2 id="rsa-why-title">Vì sao giải mã đúng?</h2>
          <p>
            Vì e·d ≡ 1 (mod φ(n)), ta có e·d = 1 + k·φ(n). Khi P nguyên tố cùng nhau với n, định lý
            Euler cho P<sup>φ(n)</sup> ≡ 1 (mod n), nên Cᵈ ≡ P (mod n). Trường hợp P chia hết cho p
            hoặc q cần xét riêng theo từng số nguyên tố. Điều kiện P &lt; n giúp lấy lại đúng P.
          </p>
        </div>
        <div>
          <h2>Giới hạn của ví dụ</h2>
          <p>
            Các số nguyên tố ở đây rất nhỏ và phép mã hóa không có padding. Mã hóa từng ký tự luôn
            cho cùng một kết quả với cùng khóa. Đây là bài minh họa, không dùng để bảo vệ thông tin
            nhạy cảm.
          </p>
        </div>
      </section>
    </div>
  );
}
