import { useState } from "react";
import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { saveBlob } from "../../../shared/utils/download";
import type { RsaCipherController } from "../hooks/useRsaCipher";
import type { EuclidRow, ModPowRow, RsaInputType, RsaTask } from "../types/cipher";
import "./rsa.css";

function TaskMessage({ cipher, task }: { cipher: RsaCipherController; task: RsaTask }) {
  if (cipher.taskErrors[task])
    return (
      <p className="rsa__message rsa__message--error" role="alert">
        {cipher.taskErrors[task]}
      </p>
    );
  if (cipher.statuses[task] === "loading")
    return (
      <p className="rsa__message" role="status">
        Đang xử lý…
      </p>
    );
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

function TransformPanel({ cipher, task }: { cipher: RsaCipherController; task: RsaInputType }) {
  const [notice, setNotice] = useState("");
  const mode = cipher.modes[task];
  const encrypt = mode === "encrypt";
  const input = cipher.inputs[task][mode];
  const result = cipher.results[task];
  const busy = cipher.statuses[task] === "loading";
  const characters = Array.from(encrypt ? input : (result?.output ?? ""));
  const inputLabel = encrypt
    ? task === "number"
      ? "Bản rõ P (số)"
      : "Thông điệp"
    : "Bản mã (JSON)";
  const ready = cipher.hasGateway && (cipher.keySource === "manual" || Boolean(cipher.key));
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Đã sao chép.");
    } catch {
      setNotice("Không thể sao chép. Hãy chọn nội dung và sao chép thủ công.");
    }
  }
  async function paste() {
    try {
      const value = await navigator.clipboard.readText();
      cipher.setInput(task, value);
      setNotice("Đã dán.");
    } catch {
      setNotice("Không thể đọc clipboard. Hãy dán trực tiếp vào ô nhập.");
    }
  }
  return (
    <section className="rsa__section panel" aria-labelledby={`rsa-${task}-title`}>
      <div className="panel__header">
        <h2 id={`rsa-${task}-title`}>
          {task === "number" ? "Mã hóa và giải mã một khối số" : "Văn bản: mỗi ký tự là một khối"}
        </h2>
      </div>
      <form
        className="rsa__section-body"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !busy) cipher.process(task);
        }}
      >
        <CipherModeSelector
          value={mode}
          disabled={false}
          onChange={(value) => {
            setNotice("");
            cipher.setMode(task, value);
          }}
        />
        <p className="rsa__help rsa__mode-help">
          <span>{encrypt ? "Dùng khóa công khai {e, n}." : "Dùng khóa riêng {d, n}."}</span>
          <span>
            {task === "number"
              ? "Mỗi số phải thỏa 0 ≤ P < n."
              : "Chế độ char: mỗi Unicode code point là một khối và phải nhỏ hơn n."}
          </span>
        </p>
        <label className="rsa__field rsa__field--text">
          <span>{inputLabel}</span>
          <textarea
            value={input}
            rows={task === "number" ? 2 : 4}
            spellCheck={false}
            placeholder={encrypt ? undefined : '["11","76"]'}
            onChange={(event) => {
              setNotice("");
              cipher.setInput(task, event.target.value);
            }}
          />
        </label>
        <div className="button-group" role="group" aria-label="Thao tác đầu vào">
          <button
            className="button button--secondary"
            type="button"
            disabled={busy}
            onClick={() => void paste()}
          >
            Dán
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={!input}
            onClick={() => void copy(input)}
          >
            Sao chép
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              setNotice("");
              cipher.setInput(task, "");
            }}
          >
            Xóa
          </button>
        </div>
        <button className="button button--primary" type="submit" disabled={!ready || busy}>
          {busy ? "Đang xử lý…" : encrypt ? "Mã hóa" : "Giải mã"}
        </button>
        {!ready && <p className="rsa__help">Hãy sinh khóa hoặc chọn nhập khóa trước khi xử lý.</p>}
        <TaskMessage cipher={cipher} task={task} />
        <label className="rsa__field rsa__field--text">
          <span>Kết quả {encrypt ? "bản mã (JSON)" : "bản rõ"}</span>
          <textarea
            readOnly
            rows={3}
            value={result?.output ?? ""}
            placeholder="Kết quả sẽ hiển thị tại đây"
          />
        </label>
        <div className="button-group" role="group" aria-label="Thao tác kết quả">
          <button
            className="button button--secondary"
            type="button"
            disabled={!result}
            onClick={() => void copy(result!.output)}
          >
            Sao chép
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={!result}
            onClick={() =>
              saveBlob(
                new Blob([result!.output], {
                  type: encrypt ? "application/json;charset=utf-8" : "text/plain;charset=utf-8",
                }),
                `rsa-${task}-${mode}.${encrypt ? "json" : "txt"}`,
              )
            }
          >
            Tải kết quả
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              setNotice("");
              cipher.clearTask(task);
            }}
          >
            Xóa
          </button>
        </div>
        {notice && (
          <p role="status" className="rsa__help">
            {notice}
          </p>
        )}
        {result && (
          <>
            <p className="status status--success" role="status">
              ✓ Xử lý thành công · {result.blocks.length} khối
            </p>
            <details className="rsa__details">
              <summary>
                {encrypt ? "Bảng tính C = Pᵉ mod n" : "Bảng tính P = Cᵈ mod n"}
                {task === "text" ? " · khối đầu tiên" : ""}
              </summary>
              <ModPowTable
                rows={result.rows}
                title={encrypt ? "Các bước mã hóa" : "Các bước giải mã"}
              />
            </details>
            {task === "text" && (
              <details className="rsa__details">
                <summary>Xem từng khối ký tự</summary>
                <div className="rsa__table-wrap">
                  <table className="rsa__table">
                    <caption>Kết quả từng khối ký tự</caption>
                    <thead>
                      <tr>
                        <th scope="col">Khối</th>
                        <th scope="col">Ký tự</th>
                        <th scope="col">P (mã)</th>
                        <th scope="col">C</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.blocks.map((block, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{characters[index] === " " ? "␣" : characters[index]}</td>
                          <td>{block}</td>
                          <td>{result.cipher[index]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </form>
    </section>
  );
}

export function RsaWorkspace({ cipher }: { cipher: RsaCipherController }) {
  const { draft, key, fieldErrors } = cipher;
  return (
    <div className="cipher-workspace rsa" aria-busy={cipher.isBusy}>
      <header className="rsa__intro">
        <div>
          <h2>RSA từng bước</h2>
          <p>Sinh khóa hoặc nhập khóa có sẵn, rồi chọn mã hóa hay giải mã cho số và văn bản.</p>
        </div>
      </header>
      <details className="rsa__details">
        <summary>Luồng mã hóa RSA · Alice và Bob</summary>
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
      </details>
      <div className="helper-row">
        <span>RSA biến đổi từng khối số bằng lũy thừa modulo n.</span>
        <div className="button-group">
          <button className="button button--secondary" type="button" onClick={cipher.loadExample}>
            Tạo ví dụ
          </button>
          <button className="button button--secondary" type="button" onClick={cipher.resetAll}>
            Đặt lại
          </button>
        </div>
      </div>
      <section className="rsa__section panel" aria-labelledby="rsa-key-title">
        <div className="panel__header">
          <h2 id="rsa-key-title">Khóa RSA</h2>
        </div>
        <div className="rsa__section-body">
          <div className="rsa__presets" role="group" aria-label="Cách nhập khóa RSA">
            {(["generate", "manual"] as const).map((source) => (
              <button
                className="button button--secondary"
                type="button"
                key={source}
                aria-pressed={cipher.keySource === source}
                onClick={() => cipher.setKeySource(source)}
              >
                {source === "generate" ? "Sinh khóa" : "Nhập khóa"}
              </button>
            ))}
          </div>
          {cipher.keySource === "generate" ? (
            <form
              className="rsa__key-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void cipher.generateKey();
              }}
            >
              <p className="rsa__help">
                Chọn hai số nguyên tố khác nhau. n = p·q, φ(n) = (p−1)(q−1), d là nghịch đảo của e
                modulo φ(n).
              </p>
              <div className="rsa__presets" role="group" aria-label="Bộ tham số mẫu RSA">
                {[
                  { label: "Giáo trình · 17, 11, 7", p: "17", q: "11", e: "7" },
                  { label: "61, 53, 17", p: "61", q: "53", e: "17" },
                  { label: "Tiếng Việt · 101, 113, 3533", p: "101", q: "113", e: "3533" },
                ].map((preset) => (
                  <button
                    className="button button--secondary"
                    type="button"
                    key={preset.label}
                    onClick={() => cipher.choosePreset(preset)}
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
                      aria-describedby={fieldErrors[field] ? `rsa-${field}-error` : undefined}
                      onChange={(event) => cipher.setParameter(field, event.target.value)}
                    />
                    {fieldErrors[field] && (
                      <small id={`rsa-${field}-error`} role="alert">
                        {fieldErrors[field]}
                      </small>
                    )}
                  </label>
                ))}
              </div>
              <button
                className="button button--primary"
                type="submit"
                disabled={!cipher.hasGateway || cipher.statuses.key === "loading"}
              >
                Tạo khóa
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
                    <div>
                      <dt>Khóa công khai của Bob</dt>
                      <dd>{`{${key.e}, ${key.n}}`}</dd>
                    </div>
                    <div>
                      <dt>Khóa riêng của Bob</dt>
                      <dd>{`{${key.d}, ${key.n}}`}</dd>
                    </div>
                  </dl>
                  <details className="rsa__details">
                    <summary>Xem từng bước Euclid mở rộng tìm d</summary>
                    <EuclidTable rows={key.euclidRows} />
                  </details>
                </>
              )}
            </form>
          ) : (
            <>
              <p className="rsa__help">Mã hóa chỉ cần e và n; giải mã chỉ cần d và n.</p>
              <div className="rsa__fields">
                {(["n", "e", "d"] as const).map((field) => (
                  <label className="rsa__field" key={field}>
                    <span>
                      {field === "n"
                        ? "n · modulo"
                        : field === "e"
                          ? "e · khóa công khai"
                          : "d · khóa riêng"}
                    </span>
                    <input
                      value={cipher.manualKey[field]}
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => cipher.setManualKey(field, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
      <TransformPanel key={`number-${cipher.resetVersion}`} cipher={cipher} task="number" />
      <TransformPanel key={`text-${cipher.resetVersion}`} cipher={cipher} task="text" />
      <details className="rsa__details">
        <summary>Vì sao giải mã đúng?</summary>
        <div className="rsa__explanation">
          <div>
            <p>Vì e·d ≡ 1 (mod φ(n)), ta có e·d = 1 + k·φ(n).</p>
            <p>
              Khi P nguyên tố cùng nhau với n, định lý Euler cho P<sup>φ(n)</sup> ≡ 1 (mod n), nên
              Cᵈ ≡ P (mod n).
            </p>
            <p>
              Trường hợp P chia hết cho p hoặc q cần xét riêng theo từng số nguyên tố. Điều kiện P
              &lt; n giúp lấy lại đúng P.
            </p>
          </div>
          <div>
            <h2>Giới hạn của ví dụ</h2>
            <p>
              Các số nguyên tố ở đây rất nhỏ và phép mã hóa không có padding. Mỗi ký tự luôn cho
              cùng một kết quả với cùng khóa. Đây là bài minh họa, không dùng để bảo vệ thông tin
              nhạy cảm.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
