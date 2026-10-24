import { useEffect, useRef, useState } from "react";
import { getHistoryDetail, type HistoryDetail } from "../services/historyApi";
import { HistoryContentButton } from "./HistoryContentButton";

export function HistoryDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [error, setError] = useState("");
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
    void getHistoryDetail(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setDetail(value);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Không thể tải chi tiết.");
      });
    return () => controller.abort();
  }, [id, retry]);
  return (
    <dialog
      ref={dialog}
      className="history__dialog"
      aria-labelledby="history-detail-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="history__heading">
        <h2 id="history-detail-title">Chi tiết thao tác #{id}</h2>
        <button type="button" className="button button--secondary" onClick={onClose}>
          Đóng
        </button>
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => {
              setError("");
              setRetry((value) => value + 1);
            }}
          >
            Thử lại
          </button>
        </p>
      )}
      {!detail && !error && <p role="status">Đang tải chi tiết…</p>}
      {detail && (
        <>
          <dl className="history__facts history__facts--metadata">
            <div>
              <dt>Thời điểm</dt>
              <dd>{new Date(detail.createdAt).toLocaleString("vi-VN")}</dd>
            </div>
            <div>
              <dt>Trạng thái xử lý</dt>
              <dd>{detail.succeeded ? "Thành công" : `Lỗi ${detail.httpStatus}`}</dd>
            </div>
            <div>
              <dt>Thời gian xử lý</dt>
              <dd>{detail.durationMs.toLocaleString("vi-VN")} ms</dd>
            </div>
            <div>
              <dt>Đầu vào</dt>
              <dd>
                {detail.inputLength === null
                  ? "Không có dữ liệu"
                  : detail.inputLength.toLocaleString("vi-VN")}
              </dd>
            </div>
            <div>
              <dt>Đầu ra</dt>
              <dd>
                {detail.outputLength === null
                  ? "Không có dữ liệu"
                  : detail.outputLength.toLocaleString("vi-VN")}
              </dd>
            </div>
          </dl>
          <p>
            Bản ghi chỉ hiển thị thông tin thao tác. Tham số, khóa bí mật và trace không được hiển
            thị.
          </p>
          {detail.contentAvailable && <HistoryContentButton id={id} />}
        </>
      )}
    </dialog>
  );
}
