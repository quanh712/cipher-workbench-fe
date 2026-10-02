import { useId } from "react";
import type { ColumnarKeyParseResult } from "../utils/validation";

interface ColumnarKeyConfigProps {
  keyValue: string;
  validation: ColumnarKeyParseResult;
  disabled: boolean;
  onKeyChange: (value: string) => void;
}

export function ColumnarKeyConfig(props: ColumnarKeyConfigProps) {
  const id = useId();
  const hasKey = props.keyValue.length > 0;
  const error = !props.validation.ok && hasKey ? props.validation.error : null;
  const readOrder = props.validation.ok ? props.validation.value.readOrder : null;
  const permutation = props.validation.ok ? props.validation.value.permutation : null;

  return (
    <section className="config-section config-section--compact-key" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Khóa Hệ mã hàng</h2>
      <p>Nhập hoán vị số hoặc từ khóa ASCII. Hệ thống tự nhận dạng khóa từ 2 đến 256 cột.</p>
      <div className="panel">
        <div className="panel__header">
          <h2>Khóa cột</h2>
        </div>

        <div className="key-control key-control--text columnar-key-control">
          <label className="visually-hidden" htmlFor={`${id}-key`}>
            Khóa cột
          </label>
          <input
            id={`${id}-key`}
            value={props.keyValue}
            type="text"
            placeholder="Ví dụ: 3,6,2,1,5,4 hoặc BALLOON"
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            disabled={props.disabled}
            onChange={(event) => props.onKeyChange(event.target.value)}
          />
        </div>
        <div className="key-note" id={`${id}-hint`}>
          Khóa gồm 2 đến 256 cột. Hoán vị: 1 đến m, cách bằng dấu phẩy hoặc khoảng trắng, có thể bọc
          trong ngoặc nhọn. Từ khóa: chỉ A–Z, không tự bỏ dấu; chữ lặp xếp từ trái sang phải. Chỉ bỏ
          khoảng trắng ASCII ở hai đầu khóa (SP, tab, CR, LF, FF, VT).
        </div>
        {error && (
          <div className="key-note columnar-key-error" id={`${id}-error`}>
            {error}
          </div>
        )}
        {readOrder && permutation && (
          <div className="columnar-key-order" aria-label="Thứ tự cột hiệu lực">
            <span>
              {props.validation.ok && props.validation.value.kind === "keyword"
                ? "Từ khóa"
                : "Hoán vị số"}
              : {permutation.join(", ")}
            </span>
            <strong>Đọc cột: {readOrder.join(" → ")}</strong>
          </div>
        )}

        <div
          className={`status ${readOrder ? "status--success" : error ? "status--error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {readOrder
            ? `✓ Khóa hợp lệ · ${readOrder.length} cột`
            : error
              ? `! ${error}`
              : "Chưa nhập khóa"}
        </div>
      </div>
    </section>
  );
}
