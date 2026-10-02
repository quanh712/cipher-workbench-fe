import type { ReactNode } from "react";

export function CipherActions({
  children,
  disabled,
  onReset,
}: {
  children: ReactNode;
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <div className="workspace__actions">
      {children}
      <button
        className="button button--secondary"
        type="button"
        disabled={disabled}
        onClick={onReset}
      >
        Đặt lại
      </button>
    </div>
  );
}
