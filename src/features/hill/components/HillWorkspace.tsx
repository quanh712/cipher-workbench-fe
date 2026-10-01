import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { ColorizedText } from "../../../shared/components/ColorizedText";
import { CipherModeSelector } from "../../../shared/components/CipherModeSelector";
import { CipherInputPanel } from "../../../shared/components/CipherInputPanel";
import { Notification } from "../../../shared/components/Notification";
import type { HillKeyAnalysis, HillMatrix, HillResultSnapshot } from "../types/cipher";
import { hillTextClusters, isHillLetter } from "../utils/textClusters";
import { mod26 } from "../utils/validation";
import { useHillCipher } from "../hooks/useHillCipher";

type Controller = ReturnType<typeof useHillCipher>;

function MatrixView({ matrix, label }: { matrix: HillMatrix | null; label: string }) {
  if (!matrix) return null;
  return (
    <div className="hill-matrix-view" aria-label={label}>
      {matrix.map((row, rowIndex) => (
        <div key={rowIndex} className="hill-matrix-view__row">
          {row.map((value, columnIndex) => (
            <span key={columnIndex}>{value}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function KeyFacts({ data }: { data: HillKeyAnalysis }) {
  return (
    <div className="hill-facts">
      <div>
        <span>Cấp ma trận</span>
        <strong>
          {data.m} × {data.m}
        </strong>
      </div>
      <div>
        <span>det K mod 26</span>
        <strong>{data.det}</strong>
      </div>
      <div>
        <span>ƯCLN(det K, 26)</span>
        <strong>{data.gcd}</strong>
      </div>
      <div>
        <span>(det K)⁻¹ mod 26</span>
        <strong>{data.detInverse ?? "Không có"}</strong>
      </div>
      <div className="hill-facts__matrices">
        <div>
          <span>Ma trận phụ hợp K*</span>
          <MatrixView matrix={data.adjugate} label="Ma trận phụ hợp" />
        </div>
        <div>
          <span>Ma trận nghịch đảo K⁻¹</span>
          <MatrixView matrix={data.inverse} label="Ma trận nghịch đảo" />
        </div>
      </div>
    </div>
  );
}

function KeyPanel({ cipher }: { cipher: Controller }) {
  const matrixRefs = useRef<Array<Array<HTMLInputElement | null>>>([]);
  const validation = cipher.keyValidation;
  const serverError = cipher.analysis.error;
  const keyError =
    validation.error ??
    (serverError && ["E03", "E08", "E09"].includes(serverError.code) ? serverError.message : null);
  const badCell =
    validation.badCell ??
    (serverError?.code === "E03" &&
    typeof serverError.details?.row === "number" &&
    typeof serverError.details?.column === "number"
      ? [serverError.details.row - 1, serverError.details.column - 1]
      : null);

  function moveCell(event: KeyboardEvent<HTMLInputElement>, row: number, column: number) {
    const directions: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    const next = matrixRefs.current[row + direction[0]]?.[column + direction[1]];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.select();
  }

  return (
    <section className="panel hill-key" aria-labelledby="hill-key-title">
      <div className="panel__header">
        <h2 id="hill-key-title">Khóa Hill</h2>
        <span className="hill-key__badge">K</span>
      </div>
      <div className="hill-panel-body">
        <div className="hill-key__toolbar">
          <label>
            Cấp ma trận
            <select
              aria-invalid={serverError?.code === "E08"}
              aria-describedby={serverError?.code === "E08" ? "hill-key-error" : undefined}
              value={cipher.m}
              disabled={cipher.isBusy}
              onChange={(event) => cipher.setSize(Number(event.target.value) as 2 | 3 | 4)}
            >
              <option value={2}>2 × 2</option>
              <option value={3}>3 × 3</option>
              <option value={4}>4 × 4</option>
            </select>
          </label>
          <button
            type="button"
            className="button button--secondary"
            disabled={cipher.isBusy}
            onClick={() => void cipher.randomKey()}
          >
            {cipher.isRandomizing ? "Đang tạo…" : "Khóa ngẫu nhiên"}
          </button>
        </div>
        <div className="hill-key__mode" role="group" aria-label="Cách nhập khóa">
          <button
            type="button"
            aria-pressed={cipher.keyInputMode === "grid"}
            disabled={cipher.isBusy}
            onClick={() => cipher.setInputMode("grid")}
          >
            Ma trận
          </button>
          <button
            type="button"
            aria-pressed={cipher.keyInputMode === "keyword"}
            disabled={cipher.isBusy}
            onClick={() => cipher.setInputMode("keyword")}
          >
            Từ khóa
          </button>
        </div>
        {cipher.keyInputMode === "keyword" && (
          <>
            <label className="hill-key__keyword">
              Từ khóa ({cipher.m * cipher.m} chữ A–Z)
              <input
                value={cipher.keyword}
                disabled={cipher.isBusy}
                spellCheck={false}
                aria-invalid={Boolean(keyError)}
                aria-describedby={keyError ? "hill-key-error" : undefined}
                onChange={(event) => cipher.setKeyword(event.target.value)}
                placeholder={cipher.m === 2 ? "Ví dụ: HILL" : "Nhập từ khóa"}
              />
            </label>
            {keyError && (
              <p id="hill-key-error" className="hill-error" role="alert">
                {keyError}
              </p>
            )}
          </>
        )}
        <div
          className="hill-key__grid"
          style={{ "--hill-size": cipher.m } as CSSProperties}
          aria-label="Lưới ma trận khóa"
        >
          {cipher.matrix.flatMap((row, rowIndex) =>
            row.map((value, columnIndex) => (
              <input
                key={`${rowIndex}-${columnIndex}`}
                ref={(node) => {
                  (matrixRefs.current[rowIndex] ??= [])[columnIndex] = node;
                }}
                type="text"
                inputMode="numeric"
                value={value}
                aria-label={`Khóa hàng ${rowIndex + 1} cột ${columnIndex + 1}`}
                aria-invalid={badCell?.[0] === rowIndex && badCell[1] === columnIndex}
                aria-describedby={keyError ? "hill-key-error" : undefined}
                readOnly={cipher.keyInputMode === "keyword"}
                disabled={cipher.isBusy}
                onKeyDown={(event) => moveCell(event, rowIndex, columnIndex)}
                onChange={(event) =>
                  cipher.setMatrixCell(rowIndex, columnIndex, event.target.value)
                }
              />
            )),
          )}
        </div>
        {validation.matrix && cipher.keyInputMode === "grid" && (
          <p className="hill-muted">
            Giá trị mod 26:{" "}
            {validation.matrix.map((row) => `[${row.map(mod26).join(", ")}]`).join(" ")}
          </p>
        )}
        {keyError && cipher.keyInputMode === "grid" && (
          <p id="hill-key-error" className="hill-error" role="alert">
            {keyError}
          </p>
        )}
      </div>
    </section>
  );
}

function InputPanel({ cipher }: { cipher: Controller }) {
  async function pasteInput() {
    try {
      const text = await navigator.clipboard.readText();
      if (cipher.setText(text))
        cipher.setNotice({ kind: "success", message: "Đã dán nội dung từ clipboard." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể đọc nội dung clipboard." });
    }
  }
  async function copyInput() {
    try {
      await navigator.clipboard.writeText(
        cipher.inputType === "file" ? cipher.fileText : cipher.text,
      );
      cipher.setNotice({ kind: "success", message: "Đã sao chép đầu vào." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể sao chép đầu vào." });
    }
  }
  const error =
    cipher.inputType === "file"
      ? (cipher.fileError ?? (cipher.file ? cipher.inputError : null))
      : cipher.text
        ? cipher.inputError
        : null;
  return (
    <div className="hill-input">
      <CipherInputPanel
        ariaLabel={
          cipher.inputType === "file"
            ? "Tệp văn bản"
            : cipher.mode === "encrypt"
              ? "Bản rõ"
              : "Bản mã"
        }
        textAriaLabel="Văn bản đầu vào"
        showErrorWithoutInput={cipher.inputType === "file" && Boolean(cipher.fileError)}
        inputType={cipher.inputType}
        mode={cipher.mode}
        text={cipher.text}
        file={cipher.file}
        fileText={cipher.fileText}
        error={error}
        disabled={cipher.isBusy}
        isReadingFile={cipher.isReadingFile}
        onInputTypeChange={cipher.setInputType}
        onTextChange={cipher.setText}
        onFileChange={(file) => (file ? void cipher.loadFile(file) : cipher.removeFile())}
        onClear={cipher.clearInput}
        onPaste={() => void pasteInput()}
        onCopy={() => void copyInput()}
      />
    </div>
  );
}

function ResultBlocks({ result }: { result: HillResultSnapshot }) {
  function positionTooltip(event: SyntheticEvent<HTMLSpanElement>) {
    const block = event.currentTarget;
    const tooltip = block.querySelector<HTMLElement>(".hill-result__tooltip");
    if (!tooltip) return;
    const bounds = block.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(bounds.left, window.innerWidth - tooltip.offsetWidth - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(bounds.bottom + 7, window.innerHeight - tooltip.offsetHeight - 12))}px`;
  }

  const lettersPerBlock = result.key.m;
  const pieces: ReactNode[] = [];
  let pending = "";
  let letters = 0;
  let blockIndex = 0;
  for (const character of hillTextClusters(result.result)) {
    pending += character;
    if (isHillLetter(character)) letters += 1;
    if (letters === lettersPerBlock) {
      const block = result.blocks[blockIndex];
      const applied = result.mode === "encrypt" ? "K" : "K⁻¹";
      const detail = block
        ? `${block.input.join(", ")} · ${applied} → ${block.output.join(", ")}`
        : "";
      const appliedMatrix = result.mode === "encrypt" ? result.key.matrix : result.key.inverse;
      const matrixDetail = appliedMatrix
        ? ` ${applied}=${appliedMatrix.map((row) => `[${row.join(", ")}]`).join(" ")}`
        : "";
      pieces.push(
        <span
          className="hill-result__block"
          tabIndex={0}
          key={blockIndex}
          aria-label={`Khối ${blockIndex + 1}: ${detail}${matrixDetail}`}
          onMouseEnter={positionTooltip}
          onFocus={positionTooltip}
        >
          <ColorizedText text={pending} />
          <span className="hill-result__tooltip" aria-hidden="true">
            {detail}
            {matrixDetail}
          </span>
        </span>,
      );
      pending = "";
      letters = 0;
      blockIndex += 1;
    }
  }
  if (pending) pieces.push(<ColorizedText key="tail" text={pending} />);
  return (
    <pre className="output hill-result__text" aria-label="Kết quả">
      {pieces}
    </pre>
  );
}

function ResultPanel({ cipher }: { cipher: Controller }) {
  const result = cipher.result;
  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.result);
      cipher.setNotice({ kind: "success", message: "Đã sao chép kết quả." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể sao chép kết quả." });
    }
  }
  return (
    <section className="hill-result" aria-labelledby="hill-result-title">
      <div className="section-label">Kết quả</div>
      <div className="panel">
        <div className="panel__header">
          <h2 id="hill-result-title">{cipher.mode === "encrypt" ? "Bản mã" : "Bản rõ"}</h2>
          <div className="button-group">
            <button
              type="button"
              className="button button--secondary"
              disabled={cipher.isBusy || !result}
              onClick={cipher.downloadResult}
            >
              Tải kết quả
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={cipher.isBusy || !result}
              onClick={() => void copyResult()}
            >
              Sao chép
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={cipher.isBusy || !result}
              onClick={cipher.clearResult}
            >
              Xóa
            </button>
          </div>
        </div>
        {result ? (
          <ResultBlocks result={result} />
        ) : (
          <pre className="output output--empty hill-result__text">
            Kết quả sẽ hiển thị ở đây sau khi xử lý.
          </pre>
        )}
        <div
          className={`status ${cipher.isProcessing ? "" : cipher.resultError ? "status--error" : result ? "status--success" : ""}`}
          role="status"
          aria-live="polite"
        >
          {cipher.isProcessing
            ? "Đang gửi yêu cầu…"
            : cipher.resultError
              ? "! Xử lý thất bại"
              : result
                ? `✓ Xử lý thành công · ${result.result.length} ký tự`
                : "Chưa xử lý"}
        </div>
        {(Boolean(result?.warnings.length) ||
          (cipher.resultError && !["E01", "E06", "E10"].includes(cipher.resultError.code))) && (
          <div className="hill-panel-body">
            {cipher.resultError && !["E01", "E06", "E10"].includes(cipher.resultError.code) && (
              <div className="hill-error" role="alert">
                {cipher.resultError.message}{" "}
                {["NETWORK", "SYSTEM"].includes(cipher.resultError.code) && (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void cipher.processCipher()}
                  >
                    Thử lại
                  </button>
                )}
              </div>
            )}
            {result?.warnings.map((warning) => (
              <div className="hill-warning" role="status" key={warning.code}>
                {warning.message}{" "}
                {warning.code === "W02" && !cipher.stripDiacritics && (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={cipher.enableStripAndRetry}
                  >
                    Bỏ dấu và thử lại
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AnalysisPanel({ cipher }: { cipher: Controller }) {
  const analysis = cipher.analysis;
  const result = cipher.result;
  const data = result?.key ?? (analysis.status === "valid" ? analysis.data?.result : null);
  return (
    <section className="panel hill-analysis" aria-labelledby="hill-analysis-title">
      <div className="panel__header">
        <h2 id="hill-analysis-title">Phân tích khóa</h2>
      </div>
      <div className="hill-panel-body">
        {analysis.status === "loading" && (
          <p role="status" className="hill-muted">
            Đang phân tích khóa…
          </p>
        )}
        {analysis.status === "invalid" && analysis.error?.code === "E04" && (
          <p role="alert" className="hill-error">
            {analysis.message}
          </p>
        )}
        {analysis.status === "error" && (
          <div role="alert" className="hill-error">
            {analysis.message}{" "}
            <button
              type="button"
              className="button button--secondary"
              onClick={cipher.retryKeyRequest}
            >
              Thử lại
            </button>
          </div>
        )}
        {data && (
          <p role="status" className="hill-valid">
            ✓ Khóa khả nghịch modulo 26
          </p>
        )}
        {data ? (
          <KeyFacts data={data} />
        ) : analysis.status === "idle" ? (
          <p className="hill-muted">Nhập khóa hợp lệ để xem định thức và ma trận nghịch đảo.</p>
        ) : null}
        {analysis.status === "valid" &&
          analysis.data?.warnings.map((warning) => (
            <p key={warning.code} className="hill-warning" role="status">
              {warning.message}
            </p>
          ))}
        {result && (
          <details className="hill-steps">
            <summary>Xem từng bước ({result.blocks.length} khối)</summary>
            <ol>
              {result.blocks.map((block, index) => (
                <li key={index}>
                  <strong>Khối {index + 1}</strong> [{block.input.join(", ")}] ·{" "}
                  {result.mode === "encrypt" ? "K" : "K⁻¹"} = [{block.output.join(", ")}] (mod 26)
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </section>
  );
}

export function HillWorkspace({ cipher }: { cipher: Controller }) {
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const workspace = workspaceRef.current;
    const input = workspace?.querySelector(
      ".hill-input .highlighted-input, .hill-input .file-picker, .hill-input .file-card",
    );
    if (!workspace || !input) return;

    const observer = new ResizeObserver(() => {
      workspace.style.setProperty(
        "--hill-result-height",
        `${input.getBoundingClientRect().height}px`,
      );
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [cipher.inputType, cipher.file]);

  return (
    <div ref={workspaceRef} className="cipher-workspace hill-workspace">
      <CipherModeSelector value={cipher.mode} disabled={cipher.isBusy} onChange={cipher.setMode} />
      <div className="helper-row">
        <span>
          Hill biến đổi các nhóm chữ A–Z bằng ma trận modulo 26; dấu câu và khoảng trắng được giữ
          nguyên.
        </span>
        <button
          className="button button--secondary"
          type="button"
          disabled={cipher.isBusy}
          onClick={cipher.loadExample}
        >
          Tạo ví dụ
        </button>
      </div>
      <div className="workspace__columns hill-columns">
        <div className="hill-column">
          <InputPanel cipher={cipher} />
          <KeyPanel cipher={cipher} />
          <label className="hill-strip">
            <input
              type="checkbox"
              aria-invalid={cipher.resultError?.code === "E10"}
              aria-describedby={
                cipher.resultError?.code === "E10" ? "hill-options-error" : undefined
              }
              checked={cipher.stripDiacritics}
              disabled={cipher.isBusy}
              onChange={(event) => cipher.setStripDiacritics(event.target.checked)}
            />{" "}
            Bỏ dấu tiếng Việt trước khi xử lý
          </label>
          {cipher.resultError?.code === "E10" && (
            <p id="hill-options-error" className="hill-error" role="alert">
              {cipher.resultError.message}
            </p>
          )}
          <button
            className="button button--primary hill-submit"
            type="button"
            disabled={!cipher.canSubmit}
            onClick={() => void cipher.processCipher()}
          >
            {cipher.isProcessing ? "Đang xử lý…" : cipher.mode === "encrypt" ? "Mã hóa" : "Giải mã"}
          </button>
        </div>
        <div className="hill-column">
          <ResultPanel cipher={cipher} />
          <AnalysisPanel cipher={cipher} />
        </div>
      </div>
      {cipher.notice && (
        <Notification notice={cipher.notice} onClose={() => cipher.setNotice(null)} />
      )}
    </div>
  );
}
