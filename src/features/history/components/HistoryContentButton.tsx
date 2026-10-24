import { useEffect, useRef, useState } from "react";
import { saveBlob } from "../../../shared/utils/download";
import { getHistoryContent } from "../services/historyApi";

export function HistoryContentButton({ id }: { id: number }) {
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => controller.current?.abort(), []);
  async function download() {
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    try {
      const { blob, filename } = await getHistoryContent(id, current.signal);
      if (!current.signal.aborted) saveBlob(blob, filename);
    } catch (error) {
      if (!current.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Không thể tải nội dung. Vui lòng thử lại.",
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="button button--secondary"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? "Đang tải nội dung…" : "Tải nội dung"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
