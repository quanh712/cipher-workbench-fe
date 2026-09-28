import { useEffect, useRef, useState } from "react";
import { cipherAlgorithms } from "../../../shared/config/cipherAlgorithms";
import type { CipherAlgorithm, CipherMode } from "../../../shared/types/cipher";
import {
  canShowServerHistory,
  getHealthStatus,
  getHistory,
  type HistoryItem,
  HistoryApiError,
} from "../services/historyApi";

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

export function HistoryWorkspace() {
  const [cipher, setCipher] = useState<CipherAlgorithm | "">("");
  const [operation, setOperation] = useState<CipherMode | "">("");
  const [status, setStatus] = useState<"ok" | "disabled" | "unavailable" | "loading" | "error">(
    "loading",
  );
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const pageController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    pageController.current?.abort();
    async function load() {
      let readingHistory = false;
      try {
        const health = await getHealthStatus(controller.signal);
        if (controller.signal.aborted) return;
        if (health.history !== "enabled" || health.database === "disabled") {
          setStatus("disabled");
          return;
        }
        if (!canShowServerHistory(health)) {
          setStatus("unavailable");
          return;
        }
        setStatus("ok");
        readingHistory = true;
        const page = await getHistory(
          { cipher: cipher || undefined, operation: operation || undefined },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (readingHistory && caught instanceof HistoryApiError && caught.status === 404) {
          setStatus("disabled");
        } else {
          setStatus("error");
        }
        setError(errorMessage(caught));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoadingMore(false);
      setStatus("loading");
      setLoading(true);
      setError(null);
      setItems([]);
      setNextCursor(null);
      void load();
    });
    return () => {
      controller.abort();
      pageController.current?.abort();
    };
  }, [cipher, operation, retry]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const controller = new AbortController();
    pageController.current = controller;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await getHistory(
        { cipher: cipher || undefined, operation: operation || undefined, cursor: nextCursor },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setItems((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !existing.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (!controller.signal.aborted) {
        if (caught instanceof HistoryApiError && caught.status === 404) {
          setStatus("disabled");
          setItems([]);
          setNextCursor(null);
        }
        setError(errorMessage(caught));
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history__heading">
        <div>
          <h2 id="history-title">Lịch sử thao tác</h2>
          <p>Mỗi dòng là một request mã hóa hoặc giải mã. Nhật ký này dùng chung trên trang.</p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setRetry((n) => n + 1)}
        >
          Làm mới lịch sử
        </button>
      </div>

      <div className="history__filters">
        <label>
          Thuật toán
          <select
            value={cipher}
            onChange={(event) => setCipher(event.target.value as CipherAlgorithm | "")}
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
            value={operation}
            onChange={(event) => setOperation(event.target.value as CipherMode | "")}
          >
            <option value="">Tất cả</option>
            <option value="encrypt">Mã hóa</option>
            <option value="decrypt">Giải mã</option>
          </select>
        </label>
      </div>

      {loading && (
        <p className="history__message" role="status">
          Đang tải lịch sử…
        </p>
      )}
      {!loading && status === "disabled" && (
        <p className="history__message">{error ?? "Lịch sử chưa được bật trên máy chủ."}</p>
      )}
      {!loading && status === "unavailable" && (
        <p className="history__message history__message--error" role="alert">
          Cơ sở dữ liệu tạm thời không khả dụng. Hãy thử lại sau.
        </p>
      )}
      {!loading && status === "error" && (
        <p className="history__message history__message--error" role="alert">
          {error}
        </p>
      )}
      {!loading && status === "ok" && items.length === 0 && (
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
                  {cipherAlgorithms.find(({ value }) => value === item.cipher)?.name ?? item.cipher}
                </strong>
                <span>
                  {item.operation === "encrypt"
                    ? "Mã hóa"
                    : item.operation === "decrypt"
                      ? "Giải mã"
                      : "Chưa xác định"}
                </span>
                <time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time>
              </div>
              <div className="history__item-details">
                <span>
                  {item.source === "text"
                    ? "Văn bản"
                    : item.responseMode === "file"
                      ? "Tải file"
                      : item.responseMode === "content"
                        ? "Xem trước file"
                        : "File"}
                </span>
                <span>Đầu vào: {lengthLabel(item.inputLength, item.source)}</span>
                <span>Đầu ra: {lengthLabel(item.outputLength, item.source)}</span>
                <span>{item.durationMs.toLocaleString("vi-VN")} ms</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {error && status === "ok" && (
        <p className="history__message history__message--error" role="alert">
          {error}
        </p>
      )}
      {status === "ok" && nextCursor && (
        <button
          className="button button--secondary history__more"
          type="button"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Đang tải…" : "Tải thêm"}
        </button>
      )}
    </section>
  );
}
