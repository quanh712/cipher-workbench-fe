import type { DesGateway } from "../services/desGateway";

function delay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 500);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// These fixtures deliberately do not depend on the entered text, bytes or key.
export function createDesDemoGateway(): DesGateway {
  return {
    async process(request, signal) {
      await delay(signal);
      const operation = request.operation === "encrypt" ? "Mã hóa" : "Giải mã";
      const source = request.inputMode === "text" ? "văn bản" : "file";
      const text = `Dữ liệu mô phỏng DES — ${operation} ${source}.\nKết quả mẫu, không được tính từ nội dung hoặc khóa bạn nhập.\n`;
      return {
        text,
        attachment:
          request.inputMode === "file"
            ? {
                blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
                filename: `des-demo-${request.operation}.txt`,
              }
            : null,
      };
    },
  };
}
