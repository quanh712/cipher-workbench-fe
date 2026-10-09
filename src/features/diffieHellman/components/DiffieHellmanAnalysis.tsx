import { useId } from "react";
import type { DhExchangeResult, DhParameters, DhTrace, DhTraceKey } from "../types/cipher";

const calculations: { key: DhTraceKey; symbol: string; formula: string; explanation: string }[] = [
  {
    key: "publicA",
    symbol: "Y_A",
    formula: "α^X_A mod q",
    explanation: "A tạo khóa công khai từ số mũ riêng của mình và gửi cho B.",
  },
  {
    key: "publicB",
    symbol: "Y_B",
    formula: "α^X_B mod q",
    explanation: "B tạo khóa công khai từ số mũ riêng của mình và gửi cho A.",
  },
  {
    key: "sharedA",
    symbol: "K_A",
    formula: "Y_B^X_A mod q",
    explanation: "A dùng khóa công khai nhận từ B với số mũ riêng của A.",
  },
  {
    key: "sharedB",
    symbol: "K_B",
    formula: "Y_A^X_B mod q",
    explanation: "B dùng khóa công khai nhận từ A với số mũ riêng của B.",
  },
];

export function TraceTable({ symbol, trace }: { symbol: string; trace: DhTrace }) {
  const id = useId();
  return (
    <details className="dh__trace">
      <summary>
        Trace {symbol} · {trace.steps.length} bước
      </summary>
      <div className="dh__trace-body">
        <p id={`${id}-hint`} className="dh__help">
          Đọc bit số mũ từ trái sang phải. Mỗi dòng bình phương kết quả rồi nhân với cơ số nếu bit
          là 1. Nếu bảng rộng hơn màn hình, chọn vùng bảng và dùng phím mũi tên để cuộn.
        </p>
        <div
          className="dh__trace-scroll"
          role="region"
          aria-label={`Bảng trace ${symbol}`}
          aria-describedby={`${id}-hint`}
          tabIndex={0}
        >
          <table>
            <caption>
              Bình phương và nhân: {symbol} = {trace.base}^{trace.exponent} mod {trace.modulus} ={" "}
              {trace.result}
            </caption>
            <thead>
              <tr>
                <th scope="col">Bước (từ 0)</th>
                <th scope="col">Bit</th>
                <th scope="col">Tiền tố số mũ</th>
                <th scope="col">Sau bình phương</th>
                <th scope="col">Sau nhân cơ số</th>
                <th scope="col">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {trace.steps.map((row) => (
                <tr key={row.index}>
                  <th scope="row">{row.index}</th>
                  <td>{row.bit}</td>
                  <td>{row.exponentPrefix}</td>
                  <td>{row.squared}</td>
                  <td>{row.multiplied ?? "—"}</td>
                  <td>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function AnalysisContent({
  snapshot,
  result,
}: {
  snapshot: DhParameters;
  result: DhExchangeResult;
}) {
  const id = useId();
  return (
    <section className="panel dh__analysis" aria-labelledby={`${id}-title`}>
      <div className="panel__header">
        <h2 id={`${id}-title`}>Phân tích Diffie–Hellman</h2>
      </div>
      <div className="dh__analysis-body">
        <p className="dh__help">
          Công thức dùng tham số của lần thiết lập thành công: q={snapshot.q}, α={snapshot.alpha},
          X_A={snapshot.privateA}, X_B={snapshot.privateB}. Phép mod q lấy phần dư khi chia cho q.
        </p>
        <ol className="dh__calculations">
          {calculations.map(({ key, symbol, formula, explanation }) => {
            const base =
              key === "sharedA"
                ? result.publicB
                : key === "sharedB"
                  ? result.publicA
                  : snapshot.alpha;
            const exponent =
              key === "publicA" || key === "sharedA" ? snapshot.privateA : snapshot.privateB;
            return (
              <li key={key}>
                <p className="dh__formula">{`${symbol} = ${formula} = ${base}^${exponent} mod ${snapshot.q} = ${result[key]}`}</p>
                <p className="dh__help">{explanation}</p>
              </li>
            );
          })}
        </ol>
        <h3>Vì sao hai bí mật chung bằng nhau?</h3>
        <p className="dh__formula">K_A = (α^X_B)^X_A mod q = α^(X_B·X_A) mod q</p>
        <p className="dh__formula">K_B = (α^X_A)^X_B mod q = α^(X_A·X_B) mod q</p>
        <p className="dh__help">
          Phép nhân có tính giao hoán: X_A·X_B = X_B·X_A. Vì vậy α^(X_A·X_B) mod q = α^(X_B·X_A) mod
          q, nên K_A = K_B.
        </p>
        <p className="dh__formula">{`${snapshot.alpha}^(${snapshot.privateA}·${snapshot.privateB}) mod ${snapshot.q} = ${snapshot.alpha}^(${snapshot.privateB}·${snapshot.privateA}) mod ${snapshot.q} = ${result.sharedA}`}</p>
        <h3>Các bước bình phương và nhân</h3>
        <p className="dh__help">
          Khởi tạo r=1 và đọc bit số mũ từ trái sang phải. Mỗi bước tính r ← r² mod q; nếu bit=1,
          tiếp tục tính r ← (r·base) mod q. Tiền tố số mũ ghi phần đã xử lý; r cuối là kết quả. Bảng
          hiển thị nguyên dữ liệu trace từ Backend.
        </p>
        {result.traces ? (
          calculations.map(({ key, symbol }) => (
            <TraceTable key={key} symbol={symbol} trace={result.traces![key]} />
          ))
        ) : (
          <p className="dh__help">Kết quả này không có dữ liệu trace.</p>
        )}
      </div>
    </section>
  );
}

/** Remount disclosures for each snapshot/result so a new run always starts collapsed. */
export function DiffieHellmanAnalysis(props: { snapshot: DhParameters; result: DhExchangeResult }) {
  return <AnalysisContent key={JSON.stringify([props.snapshot, props.result])} {...props} />;
}
