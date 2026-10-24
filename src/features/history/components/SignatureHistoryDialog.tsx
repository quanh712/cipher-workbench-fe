import { useEffect, useRef, useState } from "react";
import {
  deleteSignature,
  getSignatureDetail,
  verificationDraft,
  type SignatureHistoryDetail,
  type VerificationDraft,
} from "../services/signatureHistoryApi";

import { HistoryContentButton } from "./HistoryContentButton";

function fields(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function Fact({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{typeof value === "string" && value.length > 0 ? value : "Không có dữ liệu"}</dd>
    </div>
  );
}

function SignatureDetails({ detail }: { detail: SignatureHistoryDetail }) {
  const input = fields(detail.payload.numeric_input);
  const key = fields(detail.payload.public_key);
  const result = fields(detail.payload.result);
  const standard = result.mode === "standard";
  const raw = result.mode === "raw-integer";
  const verifying = detail.operation === "verify";
  const outcome = !detail.succeeded
    ? "Xử lý thất bại"
    : !verifying
      ? "Đã ký"
      : detail.valid === true
        ? "Chữ ký hợp lệ"
        : detail.valid === false
          ? "Chữ ký không hợp lệ"
          : "Chưa có kết quả kiểm tra";
  const tone =
    !detail.succeeded || (verifying && detail.valid === false)
      ? "error"
      : !verifying || detail.valid === true
        ? "success"
        : "neutral";
  return (
    <div className="history__signature-details" aria-label="Dữ liệu chữ ký">
      <section className={`history__outcome history__outcome--${tone}`} aria-label="Kết quả">
        <h3>{outcome}</h3>
        <p>
          {!detail.succeeded
            ? "Thao tác chưa hoàn tất. Không thể kết luận về tính hợp lệ của chữ ký."
            : !verifying
              ? "Chữ ký đã được tạo thành công."
              : raw && detail.valid !== null
                ? detail.valid
                  ? "Thông điệp khôi phục khớp với thông điệp gốc (m′ = m)."
                  : "Thông điệp khôi phục không khớp với thông điệp gốc (m′ ≠ m)."
                : detail.valid === true
                  ? "Chữ ký khớp với nội dung được kiểm tra."
                  : detail.valid === false
                    ? "Chữ ký không khớp với nội dung được kiểm tra."
                    : "Bản ghi chưa có kết luận về tính hợp lệ của chữ ký."}
        </p>
      </section>
      <section className="history__detail-section" aria-labelledby="signature-message-title">
        <h3 id="signature-message-title">Thông điệp và chữ ký</h3>
        <dl className="history__facts">
          {standard ? (
            <>
              <Fact label="Loại nội dung" value={detail.source === "file" ? "Tệp" : "Văn bản"} />
              <Fact
                label="Kích thước nội dung"
                value={
                  detail.inputLength === null
                    ? null
                    : `${detail.inputLength.toLocaleString("vi-VN")} byte`
                }
              />
              <Fact label="Mã băm SHA-256" value={result.sha256} />
            </>
          ) : (
            <Fact label="Thông điệp gốc m" value={input.m} />
          )}
          <Fact label={standard ? "Chữ ký" : "Chữ ký s"} value={detail.payload.signature} />
          {verifying && !standard && (
            <Fact label="Thông điệp khôi phục m′" value={result.recoveredMessage} />
          )}
        </dl>
      </section>
      <section className="history__detail-section" aria-labelledby="signature-key-title">
        <h3 id="signature-key-title">Khóa công khai</h3>
        <dl className="history__facts">
          {standard ? (
            <Fact label="Khóa công khai PEM" value={detail.payload.public_key} />
          ) : (
            <>
              <Fact label="Số mũ công khai e" value={key.e} />
              <Fact label="Mô-đun n" value={key.n} />
            </>
          )}
        </dl>
      </section>
      <section className="history__detail-section" aria-labelledby="signature-operation-title">
        <h3 id="signature-operation-title">Thông tin thao tác</h3>
        <dl className="history__facts history__facts--metadata">
          <Fact label="Thao tác" value={verifying ? "Kiểm tra chữ ký" : "Ký"} />
          <Fact
            label="Chế độ"
            value={raw ? "RSA số nguyên" : standard ? "RSA-PSS / SHA-256" : null}
          />
          <Fact label="Thời điểm" value={new Date(detail.createdAt).toLocaleString("vi-VN")} />
          <Fact label="Thời gian xử lý" value={`${detail.durationMs.toLocaleString("vi-VN")} ms`} />
          <Fact label="Trạng thái xử lý" value={detail.succeeded ? "Thành công" : "Thất bại"} />
        </dl>
      </section>
    </div>
  );
}

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
          <SignatureDetails detail={detail} />
          {detail.contentAvailable && <HistoryContentButton id={id} />}
          {!draft && <p>Bản ghi này không hỗ trợ điền vào chế độ kiểm tra số nguyên.</p>}
          <div className="history__dialog-actions">
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
            {!confirm && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setConfirm(true)}
              >
                Xóa bản ghi
              </button>
            )}
          </div>
          {confirm && (
            <div role="group" aria-label="Xác nhận xóa">
              <p>Xóa bản ghi này? Thao tác không thể hoàn tác.</p>
              <div className="history__dialog-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  {busy ? "Đang xóa…" : "Xác nhận xóa"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
