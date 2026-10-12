import { useEffect, useRef, useState } from "react";
import { cipherAlgorithms } from "../../../shared/config/cipherAlgorithms";
import type { CipherAlgorithm } from "../../../shared/types/cipher";
import {
  canShowServerHistory,
  getHealthStatus,
  getHistory,
  type HistoryItem,
  HistoryApiError,
} from "../services/historyApi";

import {
  getSignatureHistory,
  type SignatureHistoryItem,
  type VerificationDraft,
} from "../services/signatureHistoryApi";
import { SignatureHistoryDialog } from "./SignatureHistoryDialog";

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

type Operation = "" | "encrypt" | "decrypt" | "sign" | "verify";
type Row = (HistoryItem | SignatureHistoryItem) & { origin: "common" | "private" };
type Stream = { items: Row[]; cursor: string | null; error: string | null; loading: boolean };
const emptyStream: Stream = { items: [], cursor: null, error: null, loading: true };

export function HistoryWorkspace({
  onReuse,
}: { onReuse?: (draft: VerificationDraft) => void } = {}) {
  const [cipher, setCipher] = useState<CipherAlgorithm | "">("");
  const [operation, setOperation] = useState<Operation>("");
  const [streams, setStreams] = useState<Record<string, Stream>>({
    common: emptyStream,
    sign: emptyStream,
    verify: emptyStream,
  });
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const controllers = useRef<AbortController[]>([]);
  const commonEnabled = operation !== "sign" && operation !== "verify";
  const signatureEnabled =
    (!cipher || cipher === "rsa") && operation !== "encrypt" && operation !== "decrypt";
  const keys = [
    ...(commonEnabled ? ["common"] : []),
    ...(signatureEnabled
      ? operation === "sign"
        ? ["sign"]
        : operation === "verify"
          ? ["verify"]
          : ["sign", "verify"]
      : []),
  ];
  async function load(key: string, cursor?: string, signal?: AbortSignal) {
    setStreams((current) => ({
      ...current,
      [key]: { ...current[key], loading: true, error: null },
    }));
    try {
      if (key === "common" && !cursor) {
        const health = await getHealthStatus(signal);
        if (!canShowServerHistory(health))
          throw new Error(
            health.database === "unavailable"
              ? "Cơ sở dữ liệu tạm thời không khả dụng. Hãy thử lại sau."
              : "Lịch sử chưa được bật trên máy chủ.",
          );
      }
      const page =
        key === "common"
          ? await getHistory(
              {
                cipher: cipher || undefined,
                operation:
                  operation === "encrypt" || operation === "decrypt" ? operation : undefined,
                ...(cursor ? { cursor } : {}),
              },
              signal,
            )
          : await getSignatureHistory(key as "sign" | "verify", cursor, signal);
      if (signal?.aborted) return;
      setStreams((current) => {
        const previous = cursor ? current[key].items : [];
        const ids = new Set(previous.map((item) => item.id));
        const incoming = page.items
          .filter((item) => !ids.has(item.id))
          .map((item) => ({
            ...item,
            origin: key === "common" ? ("common" as const) : ("private" as const),
          }));
        return {
          ...current,
          [key]: {
            items: [...previous, ...incoming],
            cursor: page.nextCursor,
            error: null,
            loading: false,
          },
        };
      });
    } catch (error) {
      if (!signal?.aborted)
        setStreams((current) => ({
          ...current,
          [key]: {
            ...current[key],
            error: error instanceof Error ? error.message : errorMessage(error),
            loading: false,
            ...(error instanceof HistoryApiError && error.status === 404
              ? { items: [], cursor: null }
              : {}),
          },
        }));
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    controllers.current.forEach((value) => value.abort());
    controllers.current = [controller];
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setStreams({ common: emptyStream, sign: emptyStream, verify: emptyStream });
      keys.forEach((key) => void load(key, undefined, controller.signal));
    });
    return () => controllers.current.forEach((value) => value.abort());
    // Each filter change starts a fresh snapshot of all relevant sources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cipher, operation, retry]);
  const loading = keys.some((key) => streams[key].loading);
  // Hold rows below the oldest loaded row of an unfinished stream. This avoids
  // showing older records before newer records still waiting on another cursor.
  const boundary = Math.max(
    ...keys
      .filter((key) => !streams[key].error && streams[key].cursor && streams[key].items.length)
      .map((key) => Date.parse(streams[key].items.at(-1)!.createdAt)),
    -Infinity,
  );
  const items = keys
    .flatMap((key) => streams[key].items)
    .filter((item) => Date.parse(item.createdAt) >= boundary)
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        b.id - a.id ||
        a.origin.localeCompare(b.origin),
    );
  const hasMore = keys.some((key) => streams[key].cursor);
  function loadMore() {
    const controller = new AbortController();
    controllers.current.push(controller);
    keys
      .filter((key) => streams[key].cursor && !streams[key].loading)
      .forEach((key) => void load(key, streams[key].cursor!, controller.signal));
  }
  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history__heading">
        <div>
          <h2 id="history-title">Lịch sử thao tác</h2>
          <p>
            Lịch sử mã hóa và giải mã dùng chung trên trang. Chữ ký chỉ thuộc hồ sơ trình duyệt này,
            lưu tối đa 5 giờ và có thể bị xóa sớm khi vượt hạn mức.
          </p>
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
            {cipherAlgorithms
              .filter(({ value }) => value !== "diffie-hellman")
              .map(({ value, name }) => (
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
            onChange={(event) => setOperation(event.target.value as Operation)}
          >
            <option value="">Tất cả</option>
            <option value="encrypt">Mã hóa</option>
            <option value="decrypt">Giải mã</option>
            <option value="sign">Ký</option>
            <option value="verify">Kiểm tra chữ ký</option>
          </select>
        </label>
      </div>

      {loading && (
        <p className="history__message" role="status">
          Đang tải lịch sử…
        </p>
      )}
      {keys.map(
        (key) =>
          streams[key].error && (
            <p key={key} className="history__message history__message--error" role="alert">
              {key === "common" ? "Lịch sử chung" : "Lịch sử chữ ký riêng"}: {streams[key].error}{" "}
              <button
                type="button"
                disabled={streams[key].loading}
                onClick={() => {
                  const controller = new AbortController();
                  controllers.current.push(controller);
                  void load(key, streams[key].cursor || undefined, controller.signal);
                }}
              >
                Thử lại
              </button>
            </p>
          ),
      )}
      {!loading && keys.every((key) => !streams[key].error) && items.length === 0 && (
        <p className="history__message">Chưa có thao tác nào khớp bộ lọc.</p>
      )}

      {items.length > 0 && (
        <ol className="history__list" aria-label="Các thao tác gần đây">
          {items.map((item) => (
            <li className="history__item" key={`${item.origin}-${item.id}`}>
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
                      : item.operation === "sign"
                        ? "Ký"
                        : item.operation === "verify"
                          ? "Kiểm tra chữ ký"
                          : "Chưa xác định"}
                </span>
                <span className="history__status">
                  {item.origin === "private" ? "Chữ ký riêng" : "Lịch sử chung"}
                </span>
                <time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time>
              </div>
              {item.origin === "private" && (
                <div className="history__item-details">
                  {"valid" in item && item.valid !== null && (
                    <span>{item.valid ? "Chữ ký hợp lệ" : "Chữ ký không hợp lệ"}</span>
                  )}
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setSelected(item.id)}
                  >
                    Xem chi tiết
                  </button>
                </div>
              )}
              <div className="history__item-details">
                <span>
                  {item.origin === "private"
                    ? "Chữ ký RSA"
                    : item.source === "text"
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

      {hasMore && (
        <button
          className="button button--secondary history__more"
          type="button"
          disabled={loading}
          onClick={() => void loadMore()}
        >
          {loading ? "Đang tải…" : "Tải thêm"}
        </button>
      )}
      {selected !== null && (
        <SignatureHistoryDialog
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => setRetry((n) => n + 1)}
          onReuse={onReuse}
        />
      )}
    </section>
  );
}
