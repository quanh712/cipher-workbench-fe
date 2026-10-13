import { expect, test } from "@playwright/test";

test("filters DH history, paginates and retries a server error", async ({ page }) => {
  let failNextPage = true;
  const row = {
    id: 1,
    createdAt: "2026-10-13T00:00:00Z",
    cipher: "dh",
    operation: "exchange",
    source: "text",
    responseMode: null,
    inputLength: null,
    outputLength: null,
    httpStatus: 200,
    succeeded: true,
    durationMs: 4,
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/health") {
      await route.fulfill({
        json: { success: true, result: { database: "ok", history: "enabled" } },
      });
    } else if (url.pathname === "/api/dh/history") {
      expect(url.searchParams.get("cipher")).not.toBe("diffie-hellman");
      const filtered =
        url.searchParams.get("cipher") === "dh" && url.searchParams.get("operation") === "exchange";
      if (url.searchParams.has("cursor")) {
        expect(url.searchParams.get("cursor")).toBe("dh+/=");
        expect(filtered).toBe(true);
        if (failNextPage) {
          failNextPage = false;
          await route.fulfill({
            status: 503,
            json: { success: false, message: "Lịch sử tạm thời không khả dụng." },
          });
          return;
        }
        await route.fulfill({
          json: {
            success: true,
            result: {
              items: [{ ...row, id: 2, httpStatus: 422, succeeded: false }],
              nextCursor: null,
            },
          },
        });
      } else {
        await route.fulfill({
          json: {
            success: true,
            result: { items: filtered ? [row] : [], nextCursor: filtered ? "dh+/=" : null },
          },
        });
      }
    } else if (url.pathname === "/api/history") {
      await route.fulfill({ json: { success: true, result: { items: [], nextCursor: null } } });
    } else {
      expect(url.pathname).toBe("/api/rsa/history");
      await route.fulfill({ json: { success: true, result: { items: [], nextCursor: null } } });
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Lịch sử thao tác" }).click();
  await page
    .getByRole("combobox", { name: "Thuật toán", exact: true })
    .selectOption("diffie-hellman");
  await page.getByRole("combobox", { name: "Thao tác", exact: true }).selectOption("exchange");
  const list = page.getByRole("list", { name: "Các thao tác gần đây" });
  await expect(list.getByText("Diffie–Hellman minh họa")).toBeVisible();
  await expect(list.getByText("Trao đổi khóa")).toBeVisible();
  await expect(list.getByText("Thông tin thao tác")).toBeVisible();
  await expect(list.getByText(/Đầu vào:|Đầu ra:/)).toHaveCount(0);
  await page.getByRole("button", { name: "Tải thêm" }).click();
  await expect(page.getByRole("alert")).toContainText("Lịch sử tạm thời không khả dụng.");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(list.getByText("Lỗi 422")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải thêm" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
