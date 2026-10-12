import { useEffect, useRef, useState } from "react";
import {
  deleteSignature,
  getSignatureDetail,
  verificationDraft,
  type SignatureHistoryDetail,
  type VerificationDraft,
} from "../services/signatureHistoryApi";

export function SignatureHistoryDialog({
  id,
  onClose,
  onDeleted,
  onReuse,
}: {
  id: number;
  onClose: () => void;
  onDeleted: () => void;
  onReuse?: (draft: VerificationDraft) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<SignatureHistoryDetail | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void getSignatureDetail(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setDetail(value);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Không thể tải chi tiết.");
      });
    return () => controller.abort();
  }, [id, retry]);
  const draft = detail && verificationDraft(detail);
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteSignature(id);
      onDeleted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xóa bản ghi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="history__dialog"
      aria-labelledby="signature-history-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="history__heading">
        <h2 id="signature-history-title">Chi tiết chữ ký #{id}</h2>
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={onClose}
        >
          Đóng
        </button>
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Thử lại
          </button>
        </p>
      )}
      {!detail && !error && <p role="status">Đang tải chi tiết…</p>}
      {detail && (
        <>
          <p>
            {detail.operation === "sign" ? "Ký" : "Kiểm tra chữ ký"} ·{" "}
            {new Date(detail.createdAt).toLocaleString("vi-VN")}
          </p>
          <p>
            {detail.valid === true
              ? "Chữ ký hợp lệ"
              : detail.valid === false
                ? "Chữ ký không hợp lệ"
                : detail.succeeded
                  ? "Thành công"
                  : "Xử lý thất bại"}
          </p>
          <pre aria-label="Dữ liệu chữ ký">{JSON.stringify(detail.payload, null, 2)}</pre>
          {draft && onReuse && (
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={() => onReuse(draft)}
            >
              Dùng lại để kiểm tra chữ ký
            </button>
          )}
          {!draft && <p>Bản ghi này không hỗ trợ điền vào chế độ kiểm tra số nguyên.</p>}
          {confirm ? (
            <div role="group" aria-label="Xác nhận xóa">
              <p>Xóa bản ghi này? Thao tác không thể hoàn tác.</p>
              <button
                type="button"
                className="button button--secondary"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Hủy
              </button>{" "}
              <button
                type="button"
                className="button button--primary"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? "Đang xóa…" : "Xác nhận xóa"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setConfirm(true)}
            >
              Xóa bản ghi
            </button>
          )}
        </>
      )}
    </dialog>
  );
}
