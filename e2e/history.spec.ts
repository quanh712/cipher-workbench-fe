import { expect, test } from "@playwright/test";

test("persists, inspects and deletes owner-scoped cipher history", async ({ page, request }) => {
  const health = await request.get("/api/health");
  const body = health.ok() ? await health.json() : null;
  const available = body?.result?.database === "ok" && body?.result?.history === "enabled";
  if (process.env.REQUIRE_SERVER_HISTORY === "1") {
    expect(available, "Internal history acceptance requires an enabled BE history API").toBe(true);
  } else {
    test.skip(!available, "Server history is not enabled");
  }

  const historyPaths: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/history")) historyPaths.push(path);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByText("Mã hóa thành công.")).toBeVisible();
  await page.getByRole("button", { name: "Lịch sử thao tác" }).click();
  await expect(page.getByRole("heading", { name: "Lịch sử thao tác" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Các thao tác gần đây" }).getByText("Caesar").first(),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Lịch sử thao tác" }).click();
  await expect(
    page.getByRole("list", { name: "Các thao tác gần đây" }).getByText("Caesar").first(),
  ).toBeVisible();
  const rows = page.locator(".history__item");
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole("button", { name: "Xem chi tiết" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Chi tiết thao tác #/ })).toBeVisible();
  await expect(dialog.getByText("Thành công", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tải nội dung" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await rows.first().getByRole("button", { name: "Xóa bản ghi" }).click();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole("button", { name: "Xóa bản ghi" }).click();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.getByText("Chưa có thao tác nào khớp bộ lọc.")).toBeVisible();
  expect(historyPaths.length).toBeGreaterThanOrEqual(3);
  expect(historyPaths.every((path) => path === "/api/history")).toBe(true);
});

test("bulk deletion includes records outside the active filter", async ({ page }) => {
  const health = await page.request.get("/api/health");
  const status = health.ok() ? await health.json() : null;
  const available = status?.result?.database === "ok" && status?.result?.history === "enabled";
  if (process.env.REQUIRE_SERVER_HISTORY === "1") expect(available).toBe(true);
  else test.skip(!available, "Server history is not enabled");
  for (const operation of ["encrypt", "decrypt"]) {
    const response = await page.request.post(`/api/caesar/${operation}`, {
      data: { text: "HELLO", key: 3 },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Lịch sử thao tác", exact: true }).click();
  await expect(page.locator(".history__item")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Thao tác", exact: true }).selectOption("encrypt");
  await expect(page.locator(".history__item")).toHaveCount(1);
  await page.getByRole("button", { name: "Xóa toàn bộ lịch sử" }).click();
  await expect(page.getByText(/kể cả các bản ghi ngoài bộ lọc hiện tại/)).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(page.getByText("Chưa có thao tác nào khớp bộ lọc.")).toBeVisible();
  await page.getByRole("combobox", { name: "Thao tác", exact: true }).selectOption("");
  await expect(page.getByText("Chưa có thao tác nào khớp bộ lọc.")).toBeVisible();
  const history = await page.request.get("/api/history");
  expect((await history.json()).result.items).toEqual([]);
});
