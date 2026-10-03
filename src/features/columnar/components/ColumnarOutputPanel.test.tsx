import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ColumnarResultSnapshot } from "../types/cipher";
import { parseColumnarKey } from "../utils/validation";
import { ColumnarOutputPanel } from "./ColumnarOutputPanel";

describe("ColumnarOutputPanel", () => {
  it("labels the actual number of preview rows when a wide key produces fewer than ten", async () => {
    const rawKey = Array.from({ length: 23 }, (_, index) => index + 1).join(",");
    const parsedKey = parseColumnarKey(rawKey);
    if (!parsedKey.ok) throw new Error(parsedKey.error);
    const text = "A".repeat(201);
    const result: ColumnarResultSnapshot = {
      text,
      source: text,
      mode: "encrypt",
      inputType: "text",
      key: parsedKey.value,
    };

    render(
      <ColumnarOutputPanel
        result={result}
        mode="encrypt"
        processingStatus="success"
        disabled={false}
        onClear={vi.fn()}
        onCopy={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("tab", { name: "Phân tích" }));

    expect(
      within(screen.getByRole("table", { name: "Ma trận Hệ mã hàng" })).getAllByRole("row"),
    ).toHaveLength(10);
    expect(screen.getByText("Bản xem trước: 9 / 9 hàng")).toBeInTheDocument();
    expect(screen.getByText(/xem trước 80\/201 ký tự/)).toBeInTheDocument();
    expect(screen.getByText(/Hiện đủ 9 hàng; chỉ rút gọn phần Đầu vào/)).toBeInTheDocument();
  });
});
