import { CipherAnalysisEmpty } from "../../../shared/components/CipherAnalysisEmpty";
import type { DesCipherController } from "../hooks/useDesCipher";
import { DesTracePanel } from "./DesTracePanel";
import { analyzeDesResult } from "../utils/analysis";

export function DesAnalysis({ cipher }: { cipher: DesCipherController }) {
  const request = cipher.resultOptions;
  const mode = request?.cipherMode ?? cipher.cipherMode;
  const encrypt = (request?.operation ?? cipher.mode) === "encrypt";
  const analysis =
    !cipher.isDemo && request && cipher.result?.text
      ? analyzeDesResult(request, cipher.result.text)
      : null;

  if (!cipher.result) {
    return (
      <div className="cipher-analysis des-analysis">
        <CipherAnalysisEmpty />
      </div>
    );
  }

  const overview = (
    <section className="analysis-section">
      <h3>DES · Mạng Feistel 16 vòng</h3>
      <p>
        Khối 64 bit được hoán vị IP, chia thành hai nửa 32 bit, biến đổi qua 16 vòng, ghép R₁₆L₁₆
        rồi hoán vị IP⁻¹. Khóa hiệu dụng 56 bit sinh 16 khóa con 48 bit.
      </p>
      {!cipher.isDemo && request && cipher.result && (
        <DesTracePanel
          request={request}
          ciphertext={encrypt ? (cipher.result.text ?? undefined) : undefined}
        />
      )}
    </section>
  );

  return (
    <div className="cipher-analysis des-analysis">
      {analysis && request ? (
        <>
          <dl className="stats-list">
            <div>
              <dt>Thao tác</dt>
              <dd>
                {encrypt ? "Mã hóa" : "Giải mã"} · {mode}
              </dd>
            </div>
            <div>
              <dt>Kích thước khối</dt>
              <dd>64 bit / 8 byte</dd>
            </div>
            <div>
              <dt>Số khối bản mã</dt>
              <dd>{analysis.blockCount ?? "Không đọc nội dung file đầu vào"}</dd>
            </div>
            {analysis.ciphertextBytes !== null && (
              <div>
                <dt>Dung lượng bản mã</dt>
                <dd>{analysis.ciphertextBytes} byte</dd>
              </div>
            )}
            {analysis.plaintextBytes !== null && (
              <div>
                <dt>Dung lượng bản rõ</dt>
                <dd>{analysis.plaintextBytes} byte</dd>
              </div>
            )}
            <div>
              <dt>Padding</dt>
              <dd>
                {request.format === "hex"
                  ? encrypt
                    ? "Không thêm padding"
                    : "Giữ nguyên bytes, không gỡ padding"
                  : "PKCS#7"}
                {analysis.paddingBytes !== null &&
                  ` · ${analysis.paddingBytes} byte ${encrypt ? "được thêm" : "được gỡ"}`}
              </dd>
            </div>
            {mode === "CBC" && (
              <div>
                <dt>IV đã dùng</dt>
                <dd>
                  <code>{request.iv}</code>
                </dd>
              </div>
            )}
          </dl>
          {overview}
          {analysis.blocks.length > 0 && (
            <section className="analysis-section">
              <h3>Các khối bản mã</h3>
              <p>
                {encrypt ? "Lấy từ kết quả backend." : "Lấy từ bản mã đã gửi để giải mã."}{" "}
                {analysis.blockCount! > 16 && "Hiển thị 16 khối đầu."}
              </p>
              <ol className="des-cipher-blocks">
                {analysis.blocks.map((block, index) => {
                  const repeated = analysis.blocks.indexOf(block) < index;
                  return (
                    <li key={index} className={repeated ? "des-cipher-block--repeat" : ""}>
                      <span>Khối {index + 1}</span>
                      <code>{block}</code>
                      {repeated && <small>Trùng khối {analysis.blocks.indexOf(block) + 1}</small>}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      ) : (
        <>
          {overview}
          <p className="analysis-empty">
            {cipher.isDemo
              ? "Kết quả mô phỏng không dùng để phân tích khối thực tế."
              : "Chạy mã hóa hoặc giải mã để xem thông tin và các khối của kết quả thực tế."}
          </p>
        </>
      )}
    </div>
  );
}
