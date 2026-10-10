import { CipherIntro } from "../../../shared/components/CipherIntro";
import { CipherAnalysisEmpty } from "../../../shared/components/CipherAnalysisEmpty";
import { KeyAlignedColumns } from "../../../shared/components/KeyAlignedColumns";
import { CipherActions } from "../../../shared/components/CipherActions";
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { PaddingDetails, PaddingResult } from "../../../shared/components/PaddingResult";
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
      <dl className="stats-list">
        <div>
          <dt>Cấp ma trận</dt>
          <dd>
            {data.m} × {data.m}
          </dd>
        </div>
        <div>
          <dt>det K mod 26</dt>
          <dd>{data.det}</dd>
        </div>
        <div>
          <dt>ƯCLN(det K, 26)</dt>
          <dd>{data.gcd}</dd>
        </div>
        <div>
          <dt>(det K)⁻¹ mod 26</dt>
          <dd>{data.detInverse ?? "Không có"}</dd>
        </div>
      </dl>
      <div className="hill-facts__matrices">
        <div className="analysis-section">
          <strong>Ma trận phụ hợp K*</strong>
          <MatrixView matrix={data.adjugate} label="Ma trận phụ hợp" />
        </div>
        <div className="analysis-section">
          <strong>Ma trận nghịch đảo K⁻¹</strong>
          <MatrixView matrix={data.inverse} label="Ma trận nghịch đảo" />
        </div>
      </div>
    </div>
  );
}

function KeyPanel({ cipher }: { cipher: Controller }) {
  const matrixRefs = useRef<Array<Array<HTMLInputElement | null>>>([]);
  const validation = cipher.keyValidation;
  const analysis = cipher.analysis;
  const serverError = analysis.error;
  const data = analysis.status === "valid" ? analysis.data?.result : null;
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
    <section className="config-section hill-key" aria-labelledby="hill-key-title">
      <h2 id="hill-key-title">Khóa Hill</h2>
      <p>Nhập trực tiếp ma trận khả nghịch modulo 26 hoặc tạo ma trận từ một từ khóa A–Z.</p>
      <div className="panel">
        <div className="panel__header">
          <h2>{cipher.keyInputMode === "grid" ? "Ma trận khóa" : "Khóa dạng từ"}</h2>
        </div>
        <div className="hill-panel-body">
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
          {cipher.keyInputMode === "grid" ? (
            <>
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
                      disabled={cipher.isBusy}
                      onKeyDown={(event) => moveCell(event, rowIndex, columnIndex)}
                      onChange={(event) =>
                        cipher.setMatrixCell(rowIndex, columnIndex, event.target.value)
                      }
                    />
                  )),
                )}
              </div>
              {validation.matrix && (
                <p className="hill-muted">
                  Giá trị mod 26:{" "}
                  {validation.matrix.map((row) => `[${row.map(mod26).join(", ")}]`).join(" ")}
                </p>
              )}
              {keyError && (
                <p id="hill-key-error" className="hill-error" role="alert">
                  {keyError}
                </p>
              )}
            </>
          ) : (
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
        </div>
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
        <div
          className={`status ${analysis.status === "valid" || data ? "status--success" : analysis.status === "invalid" || analysis.status === "error" || keyError ? "status--error" : ""}`}
          role={
            analysis.status === "invalid" || analysis.status === "error" || keyError
              ? "alert"
              : "status"
          }
          aria-live="polite"
        >
          {analysis.status === "loading"
            ? "Đang phân tích khóa…"
            : analysis.status === "invalid" || analysis.status === "error"
              ? "! Không thể phân tích khóa. Kiểm tra thông tin lỗi bên trên."
              : keyError
                ? "! Khóa chưa hợp lệ. Kiểm tra trường được đánh dấu."
                : data
                  ? "✓ Khóa khả nghịch modulo 26."
                  : "Nhập khóa hợp lệ để kiểm tra."}
        </div>
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
  const [view, setView] = useState<"text" | "analysis">("text");
  const id = useId();
  const views = ["text", "analysis"] as const;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? views.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % views.length
            : event.key === "ArrowLeft"
              ? (currentIndex - 1 + views.length) % views.length
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    setView(views[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(cipher.displayResult);
      cipher.setNotice({ kind: "success", message: "Đã sao chép kết quả." });
    } catch {
      cipher.setNotice({ kind: "error", message: "Không thể sao chép kết quả." });
    }
  }
  return (
    <section className="hill-result cipher-output-panel" aria-labelledby={`${id}-title`}>
      <div className="section-label">Kết quả</div>
      <div className="panel">
        <div className="panel__header">
          <h2 id={`${id}-title`}>{cipher.mode === "encrypt" ? "Bản mã" : "Bản rõ"}</h2>
          <div className="panel-tabs" role="tablist" aria-label="Kiểu hiển thị kết quả Hill">
            {views.map((nextView, index) => (
              <button
                key={nextView}
                ref={(button) => {
                  tabRefs.current[index] = button;
                }}
                id={`${id}-${nextView}-tab`}
                type="button"
                role="tab"
                aria-controls={`${id}-${nextView}-panel`}
                aria-selected={view === nextView}
                tabIndex={view === nextView ? 0 : -1}
                disabled={cipher.isBusy}
                onClick={() => setView(nextView)}
                onKeyDown={(event) => selectTab(event, index)}
              >
                {nextView === "text" ? "Văn bản" : "Phân tích"}
              </button>
            ))}
          </div>
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
        <div
          id={`${id}-text-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-text-tab`}
          hidden={view !== "text"}
        >
          {result ? (
            <ResultBlocks result={{ ...result, result: cipher.displayResult }} />
          ) : (
            <pre className="output output--empty hill-result__text">
              Kết quả sẽ hiển thị ở đây sau khi xử lý.
            </pre>
          )}
        </div>
        <div
          id={`${id}-analysis-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-analysis-tab`}
          hidden={view !== "analysis"}
        >
          <AnalysisPanel cipher={cipher} />
        </div>
        {result?.mode === "decrypt" && (
          <PaddingResult
            raw={result.result}
            padding={result.padding}
            enabled={cipher.filterPadding}
            onChange={cipher.setFilterPadding}
            disabled={cipher.isBusy}
            showDetails={false}
          />
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
                ? `✓ Xử lý thành công · ${cipher.displayResult.length} ký tự`
                : "Chưa xử lý"}
        </div>
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
    </section>
  );
}

function AnalysisPanel({ cipher }: { cipher: Controller }) {
  const analysis = cipher.analysis;
  const result = cipher.result;
  if (!result) {
    return (
      <section className="cipher-analysis hill-analysis" aria-label="Phân tích khóa">
        <CipherAnalysisEmpty />
      </section>
    );
  }
  const data = result.key;
  return (
    <section
      className="cipher-analysis hill-analysis"
      aria-label="Phân tích khóa"
      style={result ? { minHeight: 0 } : undefined}
    >
      <div className="hill-panel-body">
        {analysis.status === "loading" && (
          <p role="status" className="hill-muted">
            Đang phân tích khóa…
          </p>
        )}
        <KeyFacts data={data} />
        {analysis.status === "valid" &&
          analysis.data?.warnings.map((warning) => (
            <p key={warning.code} className="hill-warning" role="status">
              {warning.message}
            </p>
          ))}
        {result && (
          <details className="hill-steps analysis-section">
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
        {result?.mode === "decrypt" && (
          <PaddingDetails raw={result.result} padding={result.padding} size={result.key.m} />
        )}
      </div>
    </section>
  );
}

export function HillWorkspace({ cipher }: { cipher: Controller }) {
  return (
    <div className="cipher-workspace hill-workspace">
      <CipherIntro
        title="Hill"
        description="Mã hóa và giải mã các khối chữ cái bằng ma trận khóa."
      />
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
      <KeyAlignedColumns>
        <div className="workspace__input-column">
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
          <CipherActions disabled={cipher.isBusy} onReset={cipher.resetAll}>
            <button
              className="button button--primary"
              type="button"
              disabled={!cipher.canSubmit}
              onClick={() => void cipher.processCipher()}
            >
              {cipher.isProcessing
                ? "Đang xử lý…"
                : cipher.mode === "encrypt"
                  ? "Mã hóa"
                  : "Giải mã"}
            </button>
          </CipherActions>
        </div>
        <ResultPanel cipher={cipher} />
      </KeyAlignedColumns>
      {cipher.notice && (
        <Notification notice={cipher.notice} onClose={() => cipher.setNotice(null)} />
      )}
    </div>
  );
}
