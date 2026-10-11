import { expect, test } from "@playwright/test";
const fixture = "/e2e/fixtures/rsa/";
for (const theme of ["light", "dark"] as const) {
  test(`vertical RSA workspace in ${theme} theme`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(fixture);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByText("{7, 187}", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "p · số nguyên tố" })).toHaveValue("");
    await page.getByRole("button", { name: "Tạo ví dụ" }).click();
    await page.getByRole("button", { name: "Tạo khóa", exact: true }).click();
    await expect(page.getByText("{7, 187}", { exact: true })).toBeVisible();
    const number = page.getByRole("region", { name: "Mã hóa và giải mã một khối số" });
    await number.getByRole("button", { name: "Mã hóa", exact: true }).click();
    await expect(number.getByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue(
      '["11"]',
    );
    await number.getByText("Bảng tính C = Pᵉ mod n", { exact: true }).click();
    await expect(number.getByRole("table", { name: /Các bước mã hóa/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const p = await page.getByRole("textbox", { name: "p · số nguyên tố" }).boundingBox();
    const q = await page.getByRole("textbox", { name: "q · số nguyên tố" }).boundingBox();
    if (info.project.name === "375px") expect(q!.y).toBeGreaterThan(p!.y + p!.height);
    else expect(q!.y).toBe(p!.y);
    await expect(page.getByText("Minh họa thuật toán", { exact: true })).toHaveCount(0);
    await page.getByText("Vì sao giải mã đúng?", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Giới hạn của ví dụ" })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`rsa-${theme}.png`), fullPage: true });
  });
}
test("keyboard modes, explicit errors and retry", async ({ page }) => {
  await page.goto(`${fixture}?failure=number`);
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "Tạo khóa", exact: true }).click();
  await expect(page.getByText("{7, 187}", { exact: true })).toBeVisible();
  const number = page.getByRole("region", { name: "Mã hóa và giải mã một khối số" });
  await number.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Lỗi thử nghiệm <Backend> & yêu cầu thử lại.");
  await expect(page.locator("backend")).toHaveCount(0);
  await number.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(number.getByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue(
    '["11"]',
  );
  await number.getByRole("radio", { name: /Mã hóa/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(number.getByRole("radio", { name: /Giải mã/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(
    page
      .getByRole("region", { name: "Văn bản: mỗi ký tự là một khối" })
      .getByRole("radio", { name: /Mã hóa/ }),
  ).toHaveAttribute("aria-checked", "true");
});

test("signature gateway, keyboard tabs and edited inputs at every viewport", async ({ page }) => {
  await page.goto(fixture);
  await page.getByRole("tab", { name: "Mã hóa", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Chữ ký số" })).toBeFocused();
  await expect(page.getByText("RSA học thuật", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "Ký", exact: true }).click();
  await expect(page.getByText("Đã ký", { exact: true })).toBeVisible();
  await page.getByText("Xem từng bước ký", { exact: true }).click();
  await expect(page.getByRole("table", { name: "Các bước chữ ký RSA" })).toBeVisible();
  await page.getByRole("radio", { name: /Kiểm tra/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(
    page.locator(".rsa__signature-result").getByText("Chữ ký hợp lệ", { exact: true }),
  ).toBeVisible();
  await page.getByText("Thử tình huống chữ ký sai", { exact: true }).click();
  await page.getByRole("button", { name: "Chữ ký không hợp lệ", exact: true }).click();
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(
    page.locator(".rsa__signature-result").getByText("Chữ ký không hợp lệ", { exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Thông điệp gốc m (số)" }).fill("42");
  await expect(page.getByRole("button", { name: "Kiểm tra", exact: true })).toBeEnabled();
  await expect(page.locator(".rsa__signature-result .status")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("rsa-signature.png"), fullPage: true });
});
