import { useEffect, useState } from "react";
import type { DesRequest } from "../types/cipher";
import { loadDesTrace } from "../services/desTrace";

export function DesTracePanel({
  request,
  ciphertext,
}: {
  request: DesRequest;
  ciphertext?: string;
}) {
  const [state, setState] = useState<{
    data?: Awaited<ReturnType<typeof loadDesTrace>>;
    error?: string;
  }>({});
  const [retry, setRetry] = useState(0);
  const [round, setRound] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    void loadDesTrace(request, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (
          request.operation === "encrypt" &&
          ciphertext &&
          data.result !== ciphertext.slice(0, 16)
        )
          throw new Error("Trace không khớp với khối bản mã đã xử lý.");
        setState({ data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            error: error instanceof Error ? error.message : "Không tải được phân tích DES.",
          });
      });
    return () => controller.abort();
  }, [request, retry, ciphertext]);
  const data = state.data;
  const r = data?.trace.rounds[round - 1];
  return (
    <section className="des-trace">
      <h3>Phân tích thuật toán DES · Khối đầu tiên</h3>
      <p>Giá trị trung gian được tính bởi backend. Các khối còn lại dùng cùng cấu trúc 16 vòng.</p>
      {!data && !state.error && <p role="status">Đang tải 16 vòng DES…</p>}
      {state.error && (
        <div role="alert">
          {state.error}{" "}
          <button
            className="button button--secondary"
            onClick={() => {
              setState({});
              setRetry((v) => v + 1);
            }}
          >
            Thử lại phân tích
          </button>
        </div>
      )}
      {data && (
        <>
          <details>
            <summary>1. Sinh 16 khóa con (PC-1 → dịch trái → PC-2)</summary>
            <p>
              Khóa 64 bit: <code>{data.trace.key}</code>
            </p>
            <p>
              PC-1 bỏ 8 bit chẵn lẻ → 56 bit: <code>{data.trace.pc1}</code>
            </p>
            <p>
              C₀: <code>{data.trace.pc1.slice(0, 7)}</code> · D₀:{" "}
              <code>{data.trace.pc1.slice(7)}</code>
            </p>
            <div className="des-trace-table">
              <table>
                <caption>16 khóa con 48 bit</caption>
                <thead>
                  <tr>
                    <th>Vòng</th>
                    <th>Dịch</th>
                    <th>Cᵢ</th>
                    <th>Dᵢ</th>
                    <th>Kᵢ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trace.subkeys.map((k) => (
                    <tr key={k.n}>
                      <td>{k.n}</td>
                      <td>{k.shift}</td>
                      <td>
                        <code>{k.c}</code>
                      </td>
                      <td>
                        <code>{k.d}</code>
                      </td>
                      <td>
                        <code>{k.k}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details open>
            <summary>2. Hoán vị đầu IP và tách L₀ / R₀</summary>
            <p>
              Đầu vào DES: <code>{data.trace.input}</code>
              {request.operation === "encrypt" &&
                request.cipherMode === "CBC" &&
                " (khối bản rõ đầu XOR IV)"}
            </p>
            <p>
              IP: <code>{data.trace.ip}</code>
            </p>
            <p>
              L₀: <code>{data.trace.l0}</code> · R₀: <code>{data.trace.r0}</code>
            </p>
          </details>
          <details open>
            <summary>3. Mạng Feistel · 16 vòng</summary>
            <p>
              <code>Lᵢ = Rᵢ₋₁; Rᵢ = Lᵢ₋₁ ⊕ f(Rᵢ₋₁, Kᵢ)</code>
            </p>
            <p>
              {request.operation === "decrypt"
                ? "Giải mã dùng khóa con K₁₆ → K₁."
                : "Mã hóa dùng khóa con K₁ → K₁₆."}
            </p>
            <div className="des-trace-table">
              <table>
                <caption>Giá trị sau từng vòng</caption>
                <thead>
                  <tr>
                    <th>Vòng</th>
                    <th>Khóa</th>
                    <th>f</th>
                    <th>Lᵢ</th>
                    <th>Rᵢ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trace.rounds.map((r) => (
                    <tr key={r.n}>
                      <td>{r.n}</td>
                      <td>K{r.subkey}</td>
                      <td>
                        <code>{r.f}</code>
                      </td>
                      <td>
                        <code>{r.l}</code>
                      </td>
                      <td>
                        <code>{r.r}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>4. Chi tiết hàm f và 8 S-box</summary>
            <label>
              Vòng phân tích{" "}
              <select value={round} onChange={(event) => setRound(Number(event.target.value))}>
                {data.trace.rounds.map((r) => (
                  <option key={r.n} value={r.n}>
                    Vòng {r.n}
                  </option>
                ))}
              </select>
            </label>
            {r && (
              <>
                <p>
                  E mở rộng 32 → 48 bit: <code>{r.expansion}</code>
                </p>
                <p>
                  XOR với K{r.subkey}: <code>{r.xorKey}</code>
                </p>
                <div className="des-trace-table">
                  <table>
                    <caption>S-box: mỗi nhóm 6 bit → 4 bit</caption>
                    <thead>
                      <tr>
                        <th>Hộp</th>
                        <th>6 bit</th>
                        <th>Hàng</th>
                        <th>Cột</th>
                        <th>Giá trị</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.sbox.map((box, i) => (
                        <tr key={i}>
                          <td>S{i + 1}</td>
                          <td>
                            <code>
                              {BigInt(`0x${r.xorKey}`)
                                .toString(2)
                                .padStart(48, "0")
                                .slice(i * 6, i * 6 + 6)}
                            </code>
                          </td>
                          <td>{box.row}</td>
                          <td>{box.col}</td>
                          <td>{box.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  S-box ghép 32 bit: <code>{r.sboxOutput}</code>
                </p>
                <p>
                  Hoán vị P → f: <code>{r.f}</code>
                </p>
              </>
            )}
          </details>
          <details open>
            <summary>5. Đổi thứ tự R₁₆L₁₆ và hoán vị cuối IP⁻¹</summary>
            <p>
              R₁₆L₁₆: <code>{data.trace.preOutput}</code>
            </p>
            <p>
              Đầu ra DES: <code>{data.result}</code>
            </p>
            {request.operation === "decrypt" && request.cipherMode === "CBC" && (
              <p>
                Đây là đầu ra DES thô; bước tiếp theo XOR với IV để lấy khối bản rõ đầu, rồi gỡ
                PKCS#7 nếu xuất văn bản.
              </p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
