interface DraftKeyConfigProps {
  algorithmName: string;
  value: string;
  error: string | null;
  placeholder: string;
  description: string;
  hint: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function DraftKeyConfig(props: DraftKeyConfigProps) {
  const hasValue = props.value.length > 0;

  return (
    <section className="config-section config-section--compact-key">
      <h2>Khóa {props.algorithmName}</h2>
      <p>{props.description}</p>
      <div className="panel">
        <div className="panel__header">
          <h2>Khóa dạng chuỗi</h2>
        </div>
        <div className="key-control key-control--text">
          <input
            aria-label={`Khóa ${props.algorithmName}`}
            placeholder={props.placeholder}
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
            disabled={props.disabled}
          />
        </div>
        <div className="key-note">{props.hint}</div>
        <div
          className={`status ${!hasValue ? "" : props.error ? "status--error" : "status--success"}`}
          role="status"
          aria-live="polite"
        >
          {!hasValue
            ? "Chưa nhập khóa"
            : props.error
              ? `! ${props.error}`
              : "✓ Khóa hợp lệ ở mức sơ bộ."}
        </div>
      </div>
    </section>
  );
}
