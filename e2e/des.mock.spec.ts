import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // History is unrelated to DES; no Backend is needed for this suite.
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("/");
});

test("flag off hides DES", async ({ page }, info) => {
  test.skip(info.project.name !== "disabled");
  await expect(page.getByRole("tab", { name: /DES/ })).toHaveCount(0);
});

test("demo text, validation, copy, draft and reset work without DES requests", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === "disabled");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/des")) requests.push(request.url());
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("tab", { name: /DES.*Demo/ }).click();
  await expect(page.getByRole("note")).toContainText("Dữ liệu mô phỏng");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByLabel("Nội dung đầu vào DES")).toBeFocused();
  await page.getByLabel("Nội dung đầu vào DES").fill(" Tiếng Việt\n ");
  await page.getByLabel("Khóa DES").fill("unconfirmed format");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByRole("tab", { name: /Caesar/ })).toBeDisabled();
  const output = page.getByLabel("Nội dung kết quả DES");
  await expect(output).toContainText("Mã hóa văn bản");
  const exactText = await output.textContent();
  await page
    .getByRole("region", { name: "Kết quả DES" })
    .getByRole("button", { name: "Sao chép" })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(exactText);
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await expect(output).toHaveCount(0);
  await page.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(output).toContainText("Giải mã văn bản");
  await page.getByRole("tab", { name: /Caesar/ }).click();
  await page.getByRole("tab", { name: /DES.*Demo/ }).click();
  await expect(page.getByLabel("Nội dung đầu vào DES")).toHaveValue(" Tiếng Việt\n ");
  await expect(output).toHaveCount(0);
  await page.getByRole("button", { name: "Đặt lại DES" }).click();
  await expect(page.getByLabel("Khóa DES")).toHaveValue("");
  await expect(page.getByRole("radio", { name: /Mã hóa/ })).toHaveAttribute("aria-checked", "true");
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("binary upload only shows metadata and downloads a labeled fixture", async ({
  page,
}, info) => {
  test.skip(info.project.name === "disabled");
  await page.getByRole("tab", { name: /DES.*Demo/ }).click();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByLabel("Chọn file DES").setInputFiles({
    name: "binary.des",
    mimeType: "application/octet-stream",
    buffer: Buffer.from([0xff, 0, 0xfe]),
  });
  await expect(page.getByText("binary.des", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Xem trước nội dung file")).toHaveCount(0);
  await page.getByLabel("Khóa DES").fill("demo");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByLabel("Nội dung kết quả DES")).toContainText("Mã hóa file");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("des-demo-encrypt.txt");
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(readFileSync(path!, "utf8")).toBe(
    await page.getByLabel("Nội dung kết quả DES").textContent(),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `/tmp/des-${info.project.name}.png`, fullPage: true });
});

test("keyboard navigation and dark theme keep DES usable", async ({ page }, info) => {
  test.skip(info.project.name === "disabled");
  await page.getByRole("tab", { name: /Caesar/ }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /DES.*Demo/ })).toBeFocused();
  await expect(page.getByLabel("Khóa DES")).toBeVisible();
  await page.getByRole("radio", { name: /Mã hóa/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /Giải mã/ })).toBeFocused();
  await page.getByRole("button", { name: "Chuyển sang nền tối" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: `/tmp/des-dark-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
