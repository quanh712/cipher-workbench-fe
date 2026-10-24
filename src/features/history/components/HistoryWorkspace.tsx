import { useEffect, useRef, useState } from "react";
import { getCipherAlgorithms } from "../../../shared/config/cipherAlgorithms";
import type { CipherAlgorithm } from "../../../shared/types/cipher";
import {
  canShowServerHistory,
  getHealthStatus,
  getHistory,
  deleteHistoryItem,
  deleteAllHistory,
  type HistoryItem,
  HistoryApiError,
  dhHistoryOperations,
  type HistoryOperation,
} from "../services/historyApi";

import { type VerificationDraft } from "../services/signatureHistoryApi";
import { SignatureHistoryDialog } from "./SignatureHistoryDialog";
import { HistoryDetailDialog } from "./HistoryDetailDialog";

function errorMessage(error: unknown): string {
  return error instanceof HistoryApiError
    ? error.message
    : "Không thể tải lịch sử. Vui lòng thử lại.";
}

function lengthLabel(value: number | null, source: HistoryItem["source"]): string {
  if (value === null) return "—";
  return `${value.toLocaleString("vi-VN")} ${source === "text" ? "ký tự" : "byte"}`;
}

function timeLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}

type Operation = "" | HistoryOperation | "sign" | "verify";
const operationLabels = {
  encrypt: "Mã hóa",
  decrypt: "Giải mã",
  sign: "Ký",
  verify: "Kiểm tra chữ ký",
  ...dhHistoryOperations,
};

function operationsFor(cipher: CipherAlgorithm | "", includeDh: boolean) {
  return (Object.keys(operationLabels) as Exclude<Operation, "">[]).filter((value) => {
    if (value === "encrypt" || value === "decrypt") return true;
    if (value === "sign" || value === "verify") return !cipher || cipher === "rsa";
    return includeDh && (!cipher || cipher === "diffie-hellman");
  });
}

type HistoryState = {
  items: HistoryItem[];
  cursor: string | null;
  error: string | null;
  loading: boolean;
};
const emptyHistory: HistoryState = { items: [], cursor: null, error: null, loading: true };

export function HistoryWorkspace({
  onReuse,
}: { onReuse?: (draft: VerificationDraft) => void } = {}) {
  const [cipher, setCipher] = useState<CipherAlgorithm | "">("");
  const [operation, setOperation] = useState<Operation>("");
  const [history, setHistory] = useState<HistoryState>(emptyHistory);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | "all" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const controllers = useRef<AbortController[]>([]);
  const cipherAlgorithms = getCipherAlgorithms();
  const includeDh = cipherAlgorithms.some(({ value }) => value === "diffie-hellman");
  const operations = operationsFor(cipher, includeDh);
  async function load(cursor?: string, signal?: AbortSignal) {
    setHistory((current) => ({ ...current, loading: true, error: null }));
    try {
      if (!cursor) {
        const health = await getHealthStatus(signal);
        if (!canShowServerHistory(health))
          throw new Error(
            health.database === "unavailable"
              ? "Cơ sở dữ liệu tạm thời không khả dụng. Hãy thử lại sau."
              : "Lịch sử chưa được bật trên máy chủ.",
          );
      }
      const page = await getHistory(
        {
          cipher: cipher || undefined,
          operation: operation || undefined,
          ...(cursor ? { cursor } : {}),
        },
        signal,
      );
      if (signal?.aborted) return;
      setHistory((current) => {
        const previous = cursor ? current.items : [];
        const ids = new Set(previous.map((item) => item.id));
        return {
          items: [
            ...previous,
            ...page.items.filter((item) => {
              if (ids.has(item.id)) return false;
              ids.add(item.id);
              return true;
            }),
          ],
          cursor: page.nextCursor,
          error: null,
          loading: false,
        };
      });
    } catch (error) {
      if (!signal?.aborted)
        setHistory((current) => ({
          ...current,
          error: error instanceof Error ? error.message : errorMessage(error),
          loading: false,
          ...(error instanceof HistoryApiError && error.status === 404
            ? { items: [], cursor: null }
            : {}),
        }));
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    controllers.current.forEach((value) => value.abort());
    controllers.current = [controller];
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setHistory(emptyHistory);
      setSelected(null);
      setPendingDelete(null);
      setDeleteError("");
      void load(undefined, controller.signal);
    });
    return () => controllers.current.forEach((value) => value.abort());
    // Filters start a fresh server snapshot with one shared cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cipher, operation, retry]);
  const { items, loading } = history;
  function loadMore() {
    if (loading) return;
    const controller = new AbortController();
    controllers.current.push(controller);
    void load(history.cursor || undefined, controller.signal);
  }
  async function remove() {
    if (pendingDelete === null) return;
    setDeleting(true);
    setDeleteError("");
    try {
      if (pendingDelete === "all") await deleteAllHistory();
      else await deleteHistoryItem(pendingDelete);
      // Restart pagination: deleting rows can change the server's current snapshot.
      setRetry((value) => value + 1);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Không thể xóa lịch sử. Vui lòng thử lại.",
      );
    } finally {
      setDeleting(false);
    }
  }
  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history__heading">
        <div>
          <h2 id="history-title">Lịch sử thao tác</h2>
          <p>
            Lịch sử thuộc hồ sơ trình duyệt này, lưu tối đa 5 giờ và có thể bị xóa sớm khi vượt hạn
            mức. Diffie–Hellman chỉ lưu thông tin thao tác, không lưu tham số, khóa hay trace.
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          disabled={deleting}
          onClick={() => setRetry((n) => n + 1)}
        >
          Làm mới lịch sử
        </button>
      </div>

      {items.length > 0 && (
        <button
          type="button"
          className="button button--secondary"
          disabled={deleting}
          onClick={() => {
            setDeleteError("");
            setPendingDelete("all");
          }}
        >
          Xóa toàn bộ lịch sử
        </button>
      )}
      {pendingDelete !== null && (
        <div role="group" aria-label="Xác nhận xóa">
          <p>
            {pendingDelete === "all"
              ? "Xóa toàn bộ lịch sử của hồ sơ trình duyệt này, kể cả các bản ghi ngoài bộ lọc hiện tại?"
              : "Xóa bản ghi này?"}{" "}
            Thao tác không thể hoàn tác.
          </p>
          <button
            type="button"
            className="button button--secondary"
            disabled={deleting}
            onClick={() => {
              setPendingDelete(null);
              setDeleteError("");
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={deleting}
            onClick={() => void remove()}
          >
            {deleting ? "Đang xóa…" : "Xác nhận xóa"}
          </button>
          {deleteError && <p role="alert">{deleteError}</p>}
        </div>
      )}
      <div className="history__filters">
        <label>
          Thuật toán
          <select
            disabled={deleting}
            value={cipher}
            onChange={(event) => {
              const nextCipher = event.target.value as CipherAlgorithm | "";
              setCipher(nextCipher);
              if (operation && !operationsFor(nextCipher, includeDh).includes(operation))
                setOperation("");
            }}
          >
            <option value="">Tất cả</option>
            {cipherAlgorithms.map(({ value, name }) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Thao tác
          <select
            disabled={deleting}
            value={operation}
            onChange={(event) => setOperation(event.target.value as Operation)}
          >
            <option value="">Tất cả</option>
            {operations.map((value) => (
              <option key={value} value={value}>
                {operationLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <p className="history__message" role="status">
          Đang tải lịch sử…
        </p>
      )}
      {history.error && (
        <p className="history__message history__message--error" role="alert">
          {history.error}{" "}
          <button type="button" disabled={loading} onClick={loadMore}>
            Thử lại
          </button>
        </p>
      )}
      {!loading && !history.error && items.length === 0 && (
        <p className="history__message">Chưa có thao tác nào khớp bộ lọc.</p>
      )}

      {items.length > 0 && (
        <ol className="history__list" aria-label="Các thao tác gần đây">
          {items.map((item) => (
            <li className="history__item" key={item.id}>
              <div className="history__item-main">
                <span
                  className={`history__status ${item.succeeded ? "history__status--ok" : "history__status--error"}`}
                >
                  {item.succeeded ? "Thành công" : `Lỗi ${item.httpStatus}`}
                </span>
                <strong>
                  {item.cipher === "diffie-hellman"
                    ? "Diffie–Hellman"
                    : (cipherAlgorithms.find(({ value }) => value === item.cipher)?.name ??
                      item.cipher)}
                </strong>
                <span>
                  {item.operation === "encrypt"
                    ? "Mã hóa"
                    : item.operation === "decrypt"
                      ? "Giải mã"
                      : item.operation === "sign"
                        ? "Ký"
                        : item.operation === "verify"
                          ? "Kiểm tra chữ ký"
                          : item.operation && item.operation in dhHistoryOperations
                            ? dhHistoryOperations[
                                item.operation as keyof typeof dhHistoryOperations
                              ]
                            : "Chưa xác định"}
                </span>
                <span className="history__status">
                  {item.operation === "sign" || item.operation === "verify"
                    ? "Chữ ký riêng"
                    : item.cipher === "diffie-hellman"
                      ? "Lịch sử Diffie–Hellman"
                      : "Lịch sử chung"}
                </span>
                <time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time>
              </div>
              <div className="history__item-details">
                {item.valid !== null && typeof item.valid === "boolean" && (
                  <span>{item.valid ? "Chữ ký hợp lệ" : "Chữ ký không hợp lệ"}</span>
                )}
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={deleting}
                  onClick={() => setSelected(item)}
                >
                  Xem chi tiết
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteError("");
                    setPendingDelete(item.id);
                  }}
                >
                  Xóa bản ghi
                </button>
              </div>
              <div className="history__item-details">
                <span>
                  {item.operation === "sign" || item.operation === "verify"
                    ? "Chữ ký RSA"
                    : item.cipher === "diffie-hellman" &&
                        item.operation &&
                        item.operation in dhHistoryOperations
                      ? "Thông tin thao tác"
                      : item.source === "text"
                        ? "Văn bản"
                        : item.responseMode === "file"
                          ? "Tải file"
                          : item.responseMode === "content"
                            ? "Xem trước file"
                            : "File"}
                </span>
                {!(
                  item.cipher === "diffie-hellman" &&
                  item.operation &&
                  item.operation in dhHistoryOperations
                ) && (
                  <>
                    <span>Đầu vào: {lengthLabel(item.inputLength, item.source)}</span>
                    <span>Đầu ra: {lengthLabel(item.outputLength, item.source)}</span>
                  </>
                )}
                <span>{item.durationMs.toLocaleString("vi-VN")} ms</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {history.cursor && (
        <button
          className="button button--secondary history__more"
          type="button"
          disabled={loading || deleting}
          onClick={() => void loadMore()}
        >
          {loading ? "Đang tải…" : "Tải thêm"}
        </button>
      )}
      {selected !== null &&
        (selected.operation === "sign" || selected.operation === "verify" ? (
          <SignatureHistoryDialog
            key={selected.id}
            id={selected.id}
            onClose={() => setSelected(null)}
            onDeleted={() => setRetry((n) => n + 1)}
            onReuse={onReuse}
          />
        ) : (
          <HistoryDetailDialog
            key={selected.id}
            id={selected.id}
            onClose={() => setSelected(null)}
          />
        ))}
    </section>
  );
}
