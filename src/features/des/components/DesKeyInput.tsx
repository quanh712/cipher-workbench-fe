import { useId } from "react";

export function DesKeyInput({
  isDemo,
  value,
  error,
  disabled,
  onChange,
}: {
  isDemo: boolean;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <section className="config-section">
      <h2>Khóa DES</h2>
      <div className="panel">
        <div className="key-control key-control--text">
          <input
            aria-label="Khóa DES"
            value={value}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={id}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <div id={id} className="key-note">
          {isDemo
            ? "Định dạng khóa sẽ được xác nhận theo API DES; demo chỉ kiểm tra đã nhập."
            : "Khóa gồm 16 ký tự HEX (64 bit), cho phép khoảng trắng. Không tự sửa bit chẵn lẻ."}
          {!error && (
            <p className={`status ${value ? "status--success" : ""}`} role="status">
              {value ? "✓ Khóa hợp lệ ở mức sơ bộ." : "Chưa nhập khóa"}
            </p>
          )}
          {error && (
            <p className="status status--error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
