import { useRef, type KeyboardEvent } from "react";
import { getCipherAlgorithms } from "../config/cipherAlgorithms";
import type { CipherAlgorithm } from "../types/cipher";

interface CipherAlgorithmSelectorProps {
  value: CipherAlgorithm;
  disabled: boolean;
  onChange: (algorithm: CipherAlgorithm) => void;
}

export function CipherAlgorithmSelector({
  value,
  disabled,
  onChange,
}: CipherAlgorithmSelectorProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cipherAlgorithms = getCipherAlgorithms();

  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % cipherAlgorithms.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + cipherAlgorithms.length) % cipherAlgorithms.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = cipherAlgorithms.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    onChange(cipherAlgorithms[nextIndex].value);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="algorithm-section" aria-labelledby="algorithm-title">
      <div className="section-label" id="algorithm-title">
        Thuật toán
      </div>
      <div className="algorithm-selector" role="tablist" aria-label="Thuật toán mật mã">
        {cipherAlgorithms.map((algorithm, index) => (
          <button
            ref={(button) => {
              buttonRefs.current[index] = button;
            }}
            className={
              value === algorithm.value
                ? "algorithm-button algorithm-button--active"
                : "algorithm-button"
            }
            id={`algorithm-tab-${algorithm.value}`}
            key={algorithm.value}
            type="button"
            role="tab"
            aria-controls={`algorithm-panel-${algorithm.value}`}
            aria-selected={value === algorithm.value}
            tabIndex={value === algorithm.value ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(algorithm.value)}
            onKeyDown={(event) => selectWithKeyboard(event, index)}
          >
            <span className="algorithm-button__name">{algorithm.name}</span>
            <span className="algorithm-button__description">{algorithm.description}</span>
            <span
              className={
                algorithm.available
                  ? "algorithm-button__status algorithm-button__status--ready"
                  : "algorithm-button__status"
              }
            >
              {algorithm.status}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
