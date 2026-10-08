import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /RSA minh họa.*Khả dụng/ }).click();
});

test("explicit key generation, independent number operations and trace", async ({ page }) => {
  let calls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/rsa/")) calls++;
  });
  await expect(page.getByRole("textbox", { name: "p · số nguyên tố" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Bản rõ P (số)" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Thông điệp" })).toHaveValue("");
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "61, 53, 17" }).click();
  await expect(page.getByRole("textbox", { name: "p · số nguyên tố" })).toHaveValue("61");
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Giáo trình · 17, 11, 7" }).click();
  await page.getByRole("button", { name: "Tạo khóa", exact: true }).click();
  await expect(page.getByText("{7, 187}", { exact: true })).toBeVisible();
  const number = page.getByRole("region", { name: "Mã hóa và giải mã một khối số" });
  await number.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(number.getByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue(
    '["11"]',
  );
  expect(calls).toBe(2);
  await number.getByText("Bảng tính C = Pᵉ mod n", { exact: true }).click();
  await expect(number.getByRole("table", { name: /Các bước mã hóa/ }).getByRole("row")).toHaveCount(
    4,
  );
  await number.getByRole("radio", { name: /Giải mã/ }).click();
  await number.getByRole("textbox", { name: "Bản mã (JSON)" }).fill('["11"]');
  await number.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(number.getByRole("textbox", { name: "Kết quả bản rõ" })).toHaveValue("88");
  expect(calls).toBe(3);
  await number.getByRole("radio", { name: /Mã hóa/ }).click();
  await number.getByRole("textbox", { name: "Bản rõ P (số)" }).fill("187");
  await number.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(number.getByRole("alert")).toContainText("P = 187 ≥ n = 187");
  await number.getByRole("textbox", { name: "Bản rõ P (số)" }).fill("0");
  await number.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(number.getByRole("textbox", { name: "Kết quả bản mã (JSON)" })).toHaveValue('["0"]');
});

test("manual half-keys, Unicode JSON roundtrip, download and independent modes", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (/\/api\/rsa\/(encrypt|decrypt)$/.test(request.url())) requests.push(request.postDataJSON());
  });
  await page.getByRole("textbox", { name: "p · số nguyên tố" }).fill("1009");
  await page.getByRole("textbox", { name: "q · số nguyên tố" }).fill("1013");
  await page.getByRole("textbox", { name: "e · số mũ công khai" }).fill("17");
  await page.getByRole("button", { name: "Tạo khóa", exact: true }).click();
  await expect(page.getByText("{17, 1022117}", { exact: true })).toBeVisible();
  const privateKey = await page
    .getByText("Khóa riêng của Bob", { exact: true })
    .locator("..")
    .locator("dd")
    .innerText();
  const d = privateKey.slice(1).split(",")[0];
  await page.getByRole("button", { name: "Nhập khóa", exact: true }).click();
  await page.getByRole("textbox", { name: "n · modulo" }).fill("1022117");
  await page.getByRole("textbox", { name: "e · khóa công khai" }).fill("17");
  const text = page.getByRole("region", { name: "Văn bản: mỗi ký tự là một khối" });
  const message = "Tiếng Việt 😀<&\n";
  await text.getByRole("textbox", { name: "Thông điệp" }).fill(message);
  await text.getByRole("button", { name: "Mã hóa", exact: true }).click();
  const output = text.getByRole("textbox", { name: "Kết quả bản mã (JSON)" });
  await expect(output).not.toHaveValue("");
  const encrypted = await output.inputValue();
  expect(JSON.parse(encrypted)).toHaveLength(Array.from(message).length);
  await text.getByText("Xem từng khối ký tự", { exact: true }).click();
  await expect(text.getByRole("cell", { name: "😀", exact: true })).toBeVisible();
  await expect(text.locator("script")).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await text.getByRole("button", { name: "Tải kết quả" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("rsa-text-encrypt.json");
  const fs = await import("node:fs/promises");
  expect(await fs.readFile((await download.path())!, "utf8")).toBe(encrypted);
  await page.getByRole("textbox", { name: "e · khóa công khai" }).fill("");
  await page.getByRole("textbox", { name: "d · khóa riêng" }).fill(d);
  await text.getByRole("radio", { name: /Giải mã/ }).click();
  await text.getByRole("textbox", { name: "Bản mã (JSON)" }).fill(encrypted);
  await text.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(text.getByRole("textbox", { name: "Kết quả bản rõ" })).toHaveValue(message);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual({
    e: "17",
    n: "1022117",
    inputType: "text",
    mode: "char",
    data: message,
    traceBlockIndex: 0,
  });
  expect(requests[1]).toEqual({
    d,
    n: "1022117",
    inputType: "text",
    mode: "char",
    cipher: JSON.parse(encrypted),
    traceBlockIndex: 0,
  });
  await expect(
    page
      .getByRole("region", { name: "Mã hóa và giải mã một khối số" })
      .getByRole("radio", { name: /Mã hóa/ }),
  ).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Backend errors, input validation and reset remain usable", async ({ page }) => {
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "Tạo khóa", exact: true }).click();
  await expect(page.getByText("{7, 187}", { exact: true })).toBeVisible();
  const text = page.getByRole("region", { name: "Văn bản: mỗi ký tự là một khối" });
  await text.getByRole("textbox", { name: "Thông điệp" }).fill("à");
  await text.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(text.getByRole("alert")).toContainText("P = 224 ≥ n = 187");
  await page.getByRole("textbox", { name: "p · số nguyên tố" }).fill("15");
  await page.getByRole("button", { name: "Tạo khóa", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("p = 15 không phải số nguyên tố.");
  await page.getByRole("button", { name: "Đặt lại" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(text.getByRole("textbox", { name: "Thông điệp" })).toHaveValue("");
  await expect(text.getByRole("button", { name: "Mã hóa", exact: true })).toBeDisabled();
});
