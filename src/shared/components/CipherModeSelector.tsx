import { useId, useRef, type KeyboardEvent } from "react";
import type { CipherMode } from "../types/cipher";

interface CipherModeSelectorProps {
  value: CipherMode;
  disabled: boolean;
  onChange: (mode: CipherMode) => void;
}

export function CipherModeSelector({ value, disabled, onChange }: CipherModeSelectorProps) {
  const titleId = useId();
  const modes: CipherMode[] = ["encrypt", "decrypt"];
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % modes.length;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + modes.length) % modes.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = modes.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    onChange(modes[nextIndex]);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="mode-section" aria-labelledby={titleId}>
      <div className="section-label" id={titleId}>
        Chế độ
      </div>
      <div className="mode-selector" role="radiogroup" aria-labelledby={titleId}>
        {modes.map((mode, index) => (
          <button
            ref={(button) => {
              buttonRefs.current[index] = button;
            }}
            className={value === mode ? "mode-button mode-button--active" : "mode-button"}
            key={mode}
            onClick={() => onChange(mode)}
            onKeyDown={(event) => selectWithKeyboard(event, index)}
            role="radio"
            aria-checked={value === mode}
            tabIndex={value === mode ? 0 : -1}
            type="button"
            disabled={disabled}
          >
            <span aria-hidden="true">{mode === "encrypt" ? "🔒" : "🔓"}</span>
            <span>
              <small>Chế độ</small>
              {mode === "encrypt" ? "Mã hóa" : "Giải mã"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
