import { useId } from "react";

interface DraftKeyConfigProps {
  algorithmName: string;
  keyLabel?: string;
  showErrorWithoutValue?: boolean;
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
  const id = useId();
  const error = hasValue || props.showErrorWithoutValue ? props.error : null;

  return (
    <section className="config-section config-section--compact-key">
      <h2>Khóa {props.algorithmName}</h2>
      <p>{props.description}</p>
      <div className="panel">
        <div className="panel__header">
          <h2>{props.keyLabel ?? "Khóa dạng chuỗi"}</h2>
        </div>
        <div className="key-control key-control--text">
          <input
            aria-label={`Khóa ${props.algorithmName}`}
            placeholder={props.placeholder}
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
            disabled={props.disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-hint ${id}-status`}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div id={`${id}-hint`} className="key-note">
          {props.hint}
        </div>
        <div
          id={`${id}-status`}
          className={`status ${error ? "status--error" : hasValue ? "status--success" : ""}`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {error ? `! ${error}` : hasValue ? "✓ Khóa hợp lệ ở mức sơ bộ." : "Chưa nhập khóa"}
        </div>
      </div>
    </section>
  );
}
