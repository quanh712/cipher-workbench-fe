const allCipherAlgorithms = [
  {
    value: "caesar",
    name: "Caesar",
    description: "Dịch vòng bảng chữ cái",
    status: "Khả dụng",
    available: true,
  },
  {
    value: "vigenere",
    name: "Vigenère",
    description: "Mã hóa với khóa dạng từ",
    status: "Khả dụng",
    available: true,
  },
  {
    value: "playfair",
    name: "Playfair",
    description: "Mã hóa theo cặp ký tự",
    status: "Khả dụng",
    available: true,
  },
  {
    value: "affine",
    name: "Affine",
    description: "Biến đổi với cặp khóa a, b",
    status: "Khả dụng",
    available: true,
  },
  {
    value: "columnar",
    name: "Hệ mã hàng",
    description: "Hoán vị cột",
    status: "Khả dụng",
    available: true,
  },
  {
    value: "hill",
    name: "Hill",
    description: "Biến đổi khối bằng ma trận",
    status: "Khả dụng",
    available: true,
  },
  {
    value: "des",
    name: "DES",
    description: "Mã khối Feistel 16 vòng",
    status: "Demo",
    available: false,
  },
  {
    value: "rsa",
    name: "RSA minh họa",
    description: "Sinh khóa và xem từng bước",
    status: "Khả dụng",
    available: true,
  },
  {
    value: "diffie-hellman",
    name: "Diffie–Hellman minh họa",
    description: "Thiết lập bí mật chung giữa A và B",
    status: "Khả dụng",
    available: true,
  },
] as const;

export type CipherAlgorithm = (typeof allCipherAlgorithms)[number]["value"];

// Enable gated ciphers only with their verified Backend revision.
export const getCipherAlgorithms = () =>
  allCipherAlgorithms
    .filter(
      ({ value }) =>
        (value !== "hill" || import.meta.env.VITE_ENABLE_HILL === "true") &&
        (value !== "des" ||
          import.meta.env.VITE_ENABLE_DES === "true" ||
          import.meta.env.VITE_ENABLE_DES_DEMO === "true") &&
        (value !== "rsa" || import.meta.env.VITE_ENABLE_RSA === "true") &&
        (value !== "diffie-hellman" || import.meta.env.VITE_ENABLE_DIFFIE_HELLMAN === "true"),
    )
    .map((algorithm) =>
      algorithm.value === "des" && import.meta.env.VITE_ENABLE_DES === "true"
        ? { ...algorithm, status: "Khả dụng", available: true }
        : algorithm,
    );

export const cipherAlgorithms = getCipherAlgorithms();
