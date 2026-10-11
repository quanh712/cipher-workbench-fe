import type { RsaSignatureScenario } from "../types/signature";

// Input examples only. Results and traces always come from the backend.
const key = { n: "187", e: "7", d: "23" };
export const rsaSignatureScenarios: readonly Omit<RsaSignatureScenario, "result">[] = [
  { id: "sign-success", label: "Ký thành công", mode: "sign", message: "88", signature: "", key },
  {
    id: "verify-valid",
    label: "Chữ ký hợp lệ",
    mode: "verify",
    message: "88",
    signature: "11",
    key,
  },
  {
    id: "verify-invalid",
    label: "Chữ ký không hợp lệ",
    mode: "verify",
    message: "89",
    signature: "11",
    key,
  },
];
