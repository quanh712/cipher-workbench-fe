import type { PaddingInfo } from "../utils/padding";

export function PaddingResult({
  raw,
  padding,
  enabled,
  disabled,
  onChange,
  size,
  showDetails = true,
}: {
  raw: string;
  padding?: PaddingInfo;
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  size?: number;
  showDetails?: boolean;
}) {
  return (
    <div className="padding-result">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled || !padding}
          onChange={(event) => onChange(event.target.checked)}
        />
        Tự động lọc ký tự đệm (Playfair/Hill padding)
      </label>
      <p>
        {padding
          ? `Backend nhận diện ${padding.count} ký tự đệm.`
          : "Backend chưa trả thông tin ký tự đệm; đang giữ bản thô."}
        {padding && " Chữ thật trùng mẫu đệm có thể bị lọc nhầm. Tắt lọc để giữ chúng."}
      </p>
      {showDetails && <PaddingDetails raw={raw} padding={padding} size={size} />}
    </div>
  );
}

export function PaddingDetails({
  raw,
  padding,
  size,
}: {
  raw: string;
  padding?: PaddingInfo;
  size?: number;
}) {
  let letter = 0;
  const positions = new Set(padding?.positions);
  return (
    <div className="padding-result padding-result--details">
      <details>
        <summary>Xem bản thô và bản đã lọc</summary>
        <strong>Bản thô (ký tự đệm được đánh dấu)</strong>
        <pre>
          {Array.from(raw).map((char, i) =>
            /[A-Za-z]/.test(char) && positions.has(letter++) ? <mark key={i}>{char}</mark> : char,
          )}
        </pre>
        <strong>Bản đã lọc</strong>
        <pre>{padding?.filtered ?? raw}</pre>
        {size && padding && (
          <p>
            Ký tự đệm X:{" "}
            {padding.positions
              .map((p) => `khối ${Math.floor(p / size) + 1}, ô ${(p % size) + 1}`)
              .join("; ") || "không có"}
            .
          </p>
        )}
      </details>
    </div>
  );
}
