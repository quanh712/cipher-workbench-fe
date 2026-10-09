import { useId, useLayoutEffect, useRef, useState } from "react";
import type { DhExchangeResult, DhParameters } from "../types/cipher";

type CopyLabel = "Y_A" | "Y_B" | "K_A" | "K_B";

function ResultValue({
  label,
  symbol,
  value,
  shared = false,
  copying,
  onCopy,
}: {
  label: string;
  symbol: CopyLabel;
  value: string;
  shared?: boolean;
  copying: CopyLabel | null;
  onCopy: (symbol: CopyLabel, value: string) => void;
}) {
  return (
    <div className={`dh__result-value${shared ? " dh__result-value--shared" : ""}`}>
      <dt>
        {label} {symbol}
      </dt>
      <dd>
        <span className="dh__value">{value}</span>
        <button
          className="button button--secondary"
          type="button"
          disabled={copying !== null}
          aria-label={`Sao chép ${symbol}`}
          onClick={() => onCopy(symbol, value)}
        >
          {copying === symbol ? "Đang sao chép…" : "Sao chép"}
        </button>
      </dd>
    </div>
  );
}

/** Display only: every value and substituted formula comes from a successful snapshot. */
export function DiffieHellmanResult({
  snapshot,
  result,
}: {
  snapshot: DhParameters;
  result: DhExchangeResult;
}) {
  const prefix = useId();
  const [copying, setCopying] = useState<CopyLabel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [context, setContext] = useState({ snapshot, result });
  const copyRevision = useRef(0);
  const copyPending = useRef(false);

  if (context.snapshot !== snapshot || context.result !== result) {
    setContext({ snapshot, result });
    setCopying(null);
    setNotice(null);
  }

  useLayoutEffect(() => {
    copyPending.current = false;
    copyRevision.current += 1;
    return () => {
      copyRevision.current += 1;
      copyPending.current = false;
    };
  }, [snapshot, result]);

  async function copy(symbol: CopyLabel, value: string) {
    if (copyPending.current) return;
    copyPending.current = true;
    const revision = ++copyRevision.current;
    setCopying(symbol);
    setNotice(null);
    try {
      await navigator.clipboard.writeText(value);
      if (revision === copyRevision.current) setNotice(`Đã sao chép ${symbol}.`);
    } catch {
      if (revision === copyRevision.current) {
        setNotice(`Không thể sao chép ${symbol}. Hãy chọn giá trị và sao chép thủ công.`);
      }
    } finally {
      if (revision === copyRevision.current) {
        copyPending.current = false;
        setCopying(null);
      }
    }
  }

  const copyProps = {
    copying,
    onCopy: (symbol: CopyLabel, value: string) => void copy(symbol, value),
  };

  return (
    <section className="dh__result" aria-labelledby={`${prefix}-title`}>
      <header className="dh__result-heading">
        <h2 id={`${prefix}-title`}>Kết quả thiết lập bí mật chung</h2>
        <p className="dh__help">
          Tham số đã xử lý: q={snapshot.q}, α={snapshot.alpha}.
        </p>
      </header>
      <p className="dh__notice">{result.warning.message}</p>
      <div className="dh__result-grid">
        <section className="panel dh__result-card" aria-labelledby={`${prefix}-a-title`}>
          <div className="panel__header">
            <h2 id={`${prefix}-a-title`}>Kết quả bên A</h2>
          </div>
          <div className="dh__result-body">
            <p className="dh__help">Số mũ riêng X_A = {snapshot.privateA}</p>
            <dl className="dh__result-values">
              <ResultValue
                label="Khóa công khai"
                symbol="Y_A"
                value={result.publicA}
                {...copyProps}
              />
              <ResultValue
                label="Bí mật chung"
                symbol="K_A"
                value={result.sharedA}
                shared
                {...copyProps}
              />
            </dl>
            <p className="dh__formula">{`Y_A = ${snapshot.alpha}^${snapshot.privateA} mod ${snapshot.q} = ${result.publicA}`}</p>
            <p className="dh__formula">{`K_A = ${result.publicB}^${snapshot.privateA} mod ${snapshot.q} = ${result.sharedA}`}</p>
          </div>
        </section>
        <section className="dh__exchange" aria-labelledby={`${prefix}-exchange-title`}>
          <h3 id={`${prefix}-exchange-title`}>Trao đổi khóa công khai</h3>
          <ol className="dh__exchange-steps">
            <li>
              <strong>A → B</strong>
              <span>Y_A = {result.publicA}</span>
              <small>B nhận khóa công khai của A.</small>
            </li>
            <li>
              <strong>B → A</strong>
              <span>Y_B = {result.publicB}</span>
              <small>A nhận khóa công khai của B.</small>
            </li>
          </ol>
          <p className="dh__help">
            Chỉ Y_A và Y_B được trao đổi. Số mũ riêng và bí mật chung không gửi trên kênh này.
          </p>
        </section>
        <section className="panel dh__result-card" aria-labelledby={`${prefix}-b-title`}>
          <div className="panel__header">
            <h2 id={`${prefix}-b-title`}>Kết quả bên B</h2>
          </div>
          <div className="dh__result-body">
            <p className="dh__help">Số mũ riêng X_B = {snapshot.privateB}</p>
            <dl className="dh__result-values">
              <ResultValue
                label="Khóa công khai"
                symbol="Y_B"
                value={result.publicB}
                {...copyProps}
              />
              <ResultValue
                label="Bí mật chung"
                symbol="K_B"
                value={result.sharedB}
                shared
                {...copyProps}
              />
            </dl>
            <p className="dh__formula">{`Y_B = ${snapshot.alpha}^${snapshot.privateB} mod ${snapshot.q} = ${result.publicB}`}</p>
            <p className="dh__formula">{`K_B = ${result.publicA}^${snapshot.privateB} mod ${snapshot.q} = ${result.sharedB}`}</p>
          </div>
        </section>
      </div>
      {notice && (
        <p className="dh__message" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
