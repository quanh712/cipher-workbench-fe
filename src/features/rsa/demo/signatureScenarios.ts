import type { RsaSignatureScenario } from "../types/signature";

// Explicit, fixed educational fixtures. These are not a gateway or RSA implementation.
const key = { n: "187", e: "7", d: "23" };
const verificationSteps = [
  "Khóa công khai: n = 187, e = 7.",
  "Khôi phục thông điệp: m′ = 11⁷ mod 187 = 88.",
];

export const rsaSignatureScenarios: readonly RsaSignatureScenario[] = [
  {
    id: "sign-success",
    label: "Ký thành công",
    mode: "sign",
    message: "88",
    signature: "",
    key,
    result: {
      kind: "signed",
      signature: "11",
      message: "Đã tạo chữ ký minh họa.",
      steps: [
        "Thông điệp m = 88, thỏa 0 ≤ m < 187.",
        "Khóa riêng: n = 187, d = 23.",
        "Ký: s = 88²³ mod 187 = 11.",
      ],
    },
  },
  {
    id: "verify-valid",
    label: "Chữ ký hợp lệ",
    mode: "verify",
    message: "88",
    signature: "11",
    key,
    result: {
      kind: "valid",
      recoveredMessage: "88",
      message: "Chữ ký hợp lệ: thông điệp khôi phục khớp thông điệp gốc.",
      steps: [...verificationSteps, "So sánh: m′ = 88 = m. Chữ ký hợp lệ."],
    },
  },
  {
    id: "verify-invalid",
    label: "Chữ ký không hợp lệ",
    mode: "verify",
    message: "89",
    signature: "11",
    key,
    result: {
      kind: "invalid",
      recoveredMessage: "88",
      message: "Chữ ký không hợp lệ: thông điệp khôi phục khác thông điệp gốc.",
      steps: [...verificationSteps, "So sánh: m′ = 88 ≠ m = 89. Chữ ký không hợp lệ."],
    },
  },
  {
    id: "service-error",
    label: "Lỗi dịch vụ",
    mode: "verify",
    message: "88",
    signature: "11",
    key,
    result: {
      kind: "error",
      message: "Minh họa lỗi dịch vụ: chưa thể kiểm tra chữ ký. Vui lòng thử lại.",
      steps: [],
    },
  },
];
