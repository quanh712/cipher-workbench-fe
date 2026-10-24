import { expect, test, type Page } from "@playwright/test";

async function generate(page: Page) {
  await page.getByRole("textbox", { name: "p · số nguyên tố" }).fill("1009");
  await page.getByRole("textbox", { name: "q · số nguyên tố" }).fill("1013");
  await page.getByRole("textbox", { name: "e · số mũ công khai" }).fill("17");
  await page.getByRole("button", { name: "Tạo khóa", exact: true }).click();
  await expect(page.getByText("{17, 1022117}", { exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /RSA.*Khả dụng/ }).click();
});

test("random key generation uses the server and never auto-runs", async ({ page }) => {
  const requests: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/rsa/keys/random")) requests.push(request.postDataJSON());
  });
  await page.getByRole("combobox", { name: "Phương pháp sinh khóa" }).selectOption("random");
  await page.getByRole("combobox", { name: "Độ dài khóa RSA" }).selectOption("128");
  expect(requests).toHaveLength(0);
  const pending = page.waitForResponse(/\/api\/rsa\/keys\/random$/);
  await page.getByRole("button", { name: "Tạo khóa", exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(requests).toEqual([{ bits: 128 }]);
  await expect(page.getByText(`{${body.e}, ${body.n}}`, { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Độ dài khóa RSA" }).selectOption("64");
  await expect(page.getByText(`{${body.e}, ${body.n}}`, { exact: true })).toHaveCount(0);
});

test("block Unicode roundtrip keeps original bytes and uses a selected trace block", async ({
  page,
}) => {
  await generate(page);
  const panel = page.getByRole("region", { name: /^Văn bản:/ });
  await panel.getByRole("combobox", { name: "Cách đóng khối văn bản" }).selectOption("block");
  const message = "\uFEFFTiếng Việt 😀\r\n\0";
  await panel.getByRole("textbox", { name: "Thông điệp" }).fill(message);
  await panel.getByRole("textbox", { name: "Chỉ số khối trace (từ 0)" }).fill("1");
  await panel.getByRole("button", { name: "Mã hóa", exact: true }).click();
  const output = panel.getByRole("textbox", { name: "Kết quả bản mã (JSON)" });
  await expect(output).not.toHaveValue("");
  const ciphertext = await output.inputValue();
  const bundle = JSON.parse(ciphertext);
  // Textareas normalize CRLF to LF before submission; keep exactly the submitted content.
  const submitted = await panel.getByRole("textbox", { name: "Thông điệp" }).inputValue();
  expect(bundle.originalUtf8ByteLength).toBe(Buffer.byteLength(submitted));
  await panel.getByText("Bảng tính C = Pᵉ mod n · khối 2", { exact: true }).click();
  await expect(panel.getByRole("table", { name: /Các bước mã hóa/ })).toBeVisible();
  await panel.getByRole("radio", { name: /Giải mã/ }).click();
  await panel.getByRole("textbox", { name: "Bản mã (JSON)" }).fill(ciphertext);
  await panel.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(panel.getByRole("textbox", { name: "Kết quả bản rõ" })).toHaveValue(submitted);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("file encryption preserves BOM and CRLF in block metadata", async ({ page }) => {
  await generate(page);
  const panel = page.getByRole("region", { name: /^Văn bản:/ });
  await panel.getByRole("combobox", { name: "Cách đóng khối văn bản" }).selectOption("block");
  await panel.getByRole("combobox", { name: "Nguồn văn bản RSA" }).selectOption("file");
  const content = Buffer.from("\uFEFFA\r\n😀\0", "utf8");
  await panel
    .getByLabel("File văn bản RSA (.txt)")
    .setInputFiles({ name: "utf8.txt", mimeType: "text/plain", buffer: content });
  const pending = page.waitForResponse(/\/api\/rsa\/encrypt$/);
  await panel.getByRole("button", { name: "Mã hóa", exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  expect((await response.json()).originalUtf8ByteLength).toBe(content.length);
  const output = panel.getByRole("textbox", { name: "Kết quả bản mã (JSON)" });
  await expect(output).not.toHaveValue("");
  const ciphertext = await output.inputValue();
  await panel.getByRole("radio", { name: /Giải mã/ }).click();
  await panel.getByRole("textbox", { name: "Bản mã (JSON)" }).fill(ciphertext);
  const decrypted = page.waitForResponse(/\/api\/rsa\/decrypt$/);
  await panel.getByRole("button", { name: "Giải mã", exact: true }).click();
  const raw = await (await decrypted).json();
  expect(Buffer.from(raw.plaintext)).toEqual(content);
  await expect(panel.getByRole("textbox", { name: "Kết quả bản rõ" })).not.toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
