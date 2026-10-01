import { expect, test } from "@playwright/test";

test("Hill UI uses Backend blocks and fits desktop and 375px", async ({ page }, testInfo) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const key = {
      matrix: [
        [3, 3],
        [2, 5],
      ],
      m: 2,
      det: 9,
      gcd: 1,
      detInverse: 3,
      adjugate: [
        [5, 23],
        [24, 3],
      ],
      inverse: [
        [15, 17],
        [20, 9],
      ],
    };
    const body = path.endsWith("/key/analyze")
      ? { success: true, result: key, warnings: [] }
      : path.endsWith("/encrypt")
        ? {
            success: true,
            result: "DPLE",
            key,
            blocks: [
              { input: [7, 4], output: [3, 15] },
              { input: [11, 15], output: [11, 4] },
            ],
            warnings: [],
          }
        : { database: "ok", history: "disabled" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: /Hill/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await expect(page.getByRole("button", { name: "Mã hóa" })).toBeEnabled();
  await page.getByRole("button", { name: "Mã hóa" }).click();
  await expect(page.locator(".hill-result__block")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Bản mã" })).toContainText("DP");
  await expect(page.getByRole("region", { name: "Phân tích khóa" })).toContainText("det K mod 26");
  await page.screenshot({ path: testInfo.outputPath("hill-light.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.getByRole("button", { name: "Chuyển sang nền tối" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: testInfo.outputPath("hill-dark.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});
