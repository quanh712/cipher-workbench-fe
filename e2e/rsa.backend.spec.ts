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
    .getByText("Khóa riêng", { exact: true })
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

test("backend signs arbitrary numbers and verifies valid/invalid signatures with public half-key", async ({
  page,
}) => {
  const requests: { url: string; payload: Record<string, unknown> }[] = [];
  page.on("request", (request) => {
    if (/\/api\/rsa\/(sign|verify)\/raw$/.test(request.url()))
      requests.push({ url: request.url(), payload: request.postDataJSON() });
  });
  await page.getByRole("tab", { name: "Chữ ký số" }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  expect(requests).toHaveLength(0);
  await page.getByRole("textbox", { name: "n · modulo" }).fill("3233");
  await page.getByRole("textbox", { name: "e · khóa công khai" }).fill("17");
  await page.getByRole("textbox", { name: "d · khóa riêng" }).fill("2753");
  await page.getByRole("textbox", { name: "Thông điệp gốc m (số)" }).fill("65");
  await page.getByRole("button", { name: "Ký", exact: true }).click();
  const outcome = page.locator(".rsa__signature-result");
  await expect(outcome.getByRole("definition").filter({ hasText: /^588$/ })).toBeVisible();
  expect(requests[0].payload).toEqual({ m: "65", d: "2753", e: "17", n: "3233" });
  await page.getByText("Xem từng bước ký", { exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Các bước chữ ký RSA" }).getByRole("row"),
  ).toHaveCount(13);
  await page.getByRole("radio", { name: /Kiểm tra/ }).click();
  await page.getByRole("textbox", { name: "d · khóa riêng" }).fill("");
  await page.getByRole("textbox", { name: "Chữ ký s (số)" }).fill("588");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(outcome.getByText("Chữ ký hợp lệ", { exact: true })).toBeVisible();
  expect(requests[1].payload).toEqual({ m: "65", signature: "588", e: "17", n: "3233" });
  await page.getByRole("textbox", { name: "Thông điệp gốc m (số)" }).fill("66");
  await expect(outcome.getByText("Chữ ký hợp lệ", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(outcome.getByText("Chữ ký không hợp lệ", { exact: true })).toBeVisible();
  await expect(outcome.getByRole("definition").filter({ hasText: /^65$/ })).toBeVisible();
  await page.getByRole("textbox", { name: "Thông điệp gốc m (số)" }).fill("3233");
  await expect(page.getByRole("button", { name: "Kiểm tra", exact: true })).toBeDisabled();
  expect(requests).toHaveLength(3);
  await page.getByRole("textbox", { name: "Thông điệp gốc m (số)" }).fill("0");
  await page.getByRole("textbox", { name: "Chữ ký s (số)" }).fill("0");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(outcome.getByText("Chữ ký hợp lệ", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("rsa-signature-backend.png"),
    fullPage: true,
  });
});

test("signature service failure clears results and permits retry", async ({ page }) => {
  await page.getByRole("tab", { name: "Chữ ký số" }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.route("**/api/rsa/sign/raw", (route) => route.abort(), { times: 1 });
  await page.getByRole("button", { name: "Ký", exact: true }).click();
  await expect(
    page.locator(".rsa__signature-result").getByText("Lỗi dịch vụ", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ký", exact: true }).click();
  await expect(page.getByText("Đã ký", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đặt lại" }).click();
  await expect(page.getByRole("textbox", { name: "Thông điệp gốc m (số)" })).toHaveValue("");
  await expect(page.getByText("Đã ký", { exact: true })).toHaveCount(0);
});

test("private signature history survives reload, reuses without submitting, deletes and isolates profiles", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.getByRole("tab", { name: "Chữ ký số" }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  const responsePromise = page.waitForResponse(/\/api\/rsa\/sign\/raw$/);
  await page.getByRole("button", { name: "Ký", exact: true }).click();
  const body = await (await responsePromise).json();
  expect(body.history.saved).toBe(true);
  const id = body.history.id;
  await page.reload();
  await page.getByRole("button", { name: "Lịch sử thao tác", exact: true }).click();
  await page.getByRole("combobox", { name: "Thao tác", exact: true }).selectOption("sign");
  const row = page.locator(".history__item").first();
  await row.getByRole("button", { name: "Xem chi tiết" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Đã ký", exact: true })).toBeVisible();
  await expect(
    dialog.locator(".history__facts > div").filter({ hasText: "Thông điệp gốc m" }).locator("dd"),
  ).toHaveText("88");
  await expect(dialog.getByRole("heading", { name: "Khóa công khai", exact: true })).toBeVisible();
  await expect(dialog.locator("pre")).toHaveCount(0);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("signature-history-detail.png") });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.screenshot({ path: test.info().outputPath("signature-history-detail-dark.png") });
  let verifies = 0;
  page.on("request", (request) => {
    if (/\/api\/rsa\/verify\/raw$/.test(request.url())) verifies++;
  });
  await dialog.getByRole("button", { name: "Dùng lại để kiểm tra chữ ký" }).click();
  await expect(page.getByRole("textbox", { name: "Thông điệp gốc m (số)" })).toHaveValue("88");
  await expect(page.getByRole("textbox", { name: "d · khóa riêng" })).toHaveValue("");
  expect(verifies).toBe(0);
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(
    page.locator(".rsa__signature-result").getByText("Chữ ký hợp lệ", { exact: true }),
  ).toBeVisible();
  expect(verifies).toBe(1);
  const other = await browser.newContext({ baseURL });
  try {
    const isolated = await other.newPage();
    await isolated.goto("/");
    expect(
      await isolated.evaluate(async (id) => (await fetch(`/api/rsa/history/${id}`)).status, id),
    ).toBe(404);
  } finally {
    await other.close();
  }
  await page.getByRole("button", { name: "Lịch sử thao tác", exact: true }).click();
  await page.getByRole("combobox", { name: "Thao tác", exact: true }).selectOption("sign");
  await page
    .locator(".history__item")
    .first()
    .getByRole("button", { name: "Xem chi tiết" })
    .click();
  await expect(dialog).toContainText(`Chi tiết chữ ký #${id}`);
  await dialog.getByRole("button", { name: "Xóa bản ghi" }).click();
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  expect(
    await page.evaluate(async (id) => (await fetch(`/api/rsa/history/${id}`)).status, id),
  ).toBe(200);
  await dialog.getByRole("button", { name: "Xóa bản ghi" }).click();
  await dialog.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(async (id) => (await fetch(`/api/rsa/history/${id}`)).status, id),
  ).toBe(404);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("signature-history.png"), fullPage: true });
});

test("verification history retains valid and invalid outcomes after reload", async ({ page }) => {
  await page.getByRole("tab", { name: "Chữ ký số" }).click();
  await page.getByRole("radio", { name: /Kiểm tra/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("textbox", { name: "d · khóa riêng" }).fill("");
  const ids: number[] = [];
  for (const [message, valid] of [
    ["88", true],
    ["89", false],
  ] as const) {
    await page.getByRole("textbox", { name: "Thông điệp gốc m (số)" }).fill(message);
    const responsePromise = page.waitForResponse(/\/api\/rsa\/verify\/raw$/);
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.result.valid).toBe(valid);
    expect(body.history.saved).toBe(true);
    ids.push(body.history.id);
    await expect(
      page
        .locator(".rsa__signature-result")
        .getByText(valid ? "Chữ ký hợp lệ" : "Chữ ký không hợp lệ", { exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await page.getByRole("button", { name: "Lịch sử thao tác", exact: true }).click();
  await page.getByRole("combobox", { name: "Thao tác", exact: true }).selectOption("verify");
  const rows = page.locator(".history__item");
  await expect(rows).toHaveCount(2);
  for (const [index, valid] of [
    [0, false],
    [1, true],
  ] as const) {
    const row = rows.nth(index);
    await expect(row).toContainText("Thành công");
    await expect(
      row.getByText(valid ? "Chữ ký hợp lệ" : "Chữ ký không hợp lệ", { exact: true }),
    ).toBeVisible();
    await row.getByRole("button", { name: "Xem chi tiết" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Chi tiết chữ ký #${ids[valid ? 0 : 1]}`);
    const payload = dialog.getByLabel("Dữ liệu chữ ký");
    await expect(
      payload.getByRole("heading", {
        name: valid ? "Chữ ký hợp lệ" : "Chữ ký không hợp lệ",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      payload
        .locator(".history__facts > div")
        .filter({ hasText: "Thông điệp khôi phục m′" })
        .locator("dd"),
    ).toHaveText("88");
    await expect(payload).toContainText(valid ? "(m′ = m)" : "(m′ ≠ m)");
    await expect(payload.locator("pre")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("history source failures keep the other source visible and permit retry", async ({ page }) => {
  await page.getByRole("tab", { name: "Chữ ký số" }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "Ký", exact: true }).click();
  await expect(page.getByText("Đã ký", { exact: true })).toBeVisible();
  await page.route("**/api/health", (route) => route.abort(), { times: 1 });
  await page.getByRole("button", { name: "Lịch sử thao tác", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Lịch sử chung");
  await expect(page.getByRole("button", { name: "Xem chi tiết" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.locator(".history__item").filter({ hasText: "Lịch sử chung" }).first(),
  ).toBeVisible();
  await page.route("**/api/rsa/history?**", (route) => route.abort());
  await page.getByRole("button", { name: "Làm mới lịch sử" }).click();
  await expect(page.getByRole("alert")).toHaveCount(2);
  await expect(
    page.locator(".history__item").filter({ hasText: "Lịch sử chung" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Chưa có thao tác nào khớp bộ lọc.")).toHaveCount(0);
  await page.unroute("**/api/rsa/history?**");
  await page.getByRole("button", { name: "Làm mới lịch sử" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Xem chi tiết" })).toBeVisible();
});
