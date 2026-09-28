import { expect, test } from "@playwright/test";

test("shows a persisted cipher request in the shared history", async ({ page, request }) => {
  const health = await request.get("/api/health");
  const body = health.ok() ? await health.json() : null;
  const available = body?.result?.database === "ok" && body?.result?.history === "enabled";
  if (process.env.REQUIRE_SERVER_HISTORY === "1") {
    expect(available, "Internal history acceptance requires an enabled BE history API").toBe(true);
  } else {
    test.skip(!available, "Server history is not enabled");
  }

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
});
