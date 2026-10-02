import { DraftKeyConfig } from "../../../shared/components/DraftKeyConfig";

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
  return (
    <DraftKeyConfig
      algorithmName="DES"
      keyLabel="Khóa HEX"
      value={value}
      error={error ?? null}
      showErrorWithoutValue
      placeholder="Ví dụ: 133457799BBCDFF1"
      description="Khóa DES gồm 16 ký tự HEX: 64 bit, với 56 bit hiệu dụng."
      hint={
        isDemo
          ? "Định dạng khóa sẽ được xác nhận theo API DES; demo chỉ kiểm tra đã nhập."
          : "Cho phép khoảng trắng ASCII; không tự sửa bit chẵn lẻ của khóa."
      }
      disabled={disabled}
      onChange={onChange}
    />
  );
}
