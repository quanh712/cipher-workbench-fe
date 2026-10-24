import { createHash, generateKeyPairSync } from "node:crypto";
import { expect, test } from "@playwright/test";

// Throwaway keys generated in test memory; never use real user key material in fixtures.
const passphrase = "rsa-pss-test-only";
const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase },
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /RSA.*Khả dụng/ }).click();
  await page.getByRole("tab", { name: "Chữ ký số", exact: true }).click();
  await page.getByLabel("Loại chữ ký").selectOption("standard");
});

for (const source of ["text", "file"] as const) {
  test(`RSA-PSS ${source}: PEM sign, valid and invalid verify, owned history original content`, async ({
    page,
  }) => {
    const text = "  Tiếng Việt 😀\nDòng 2 \t ";
    const bytes =
      source === "file" ? Buffer.from("\uFEFF  Tiếng Việt 😀\r\nDòng 2 \t \r") : Buffer.from(text);
    if (source === "file") {
      await page.getByLabel("Nguồn nội dung chữ ký").selectOption("file");
      await page
        .getByLabel("Tệp nội dung .txt")
        .setInputFiles({ name: "exact.TXT", mimeType: "text/plain", buffer: bytes });
    } else await page.getByLabel("Nội dung ký / kiểm tra").fill(text);
    await page.getByLabel("Private key PEM", { exact: true }).fill(keys.privateKey);
    await page.getByLabel("Passphrase (nếu khóa được mã hóa)").fill(passphrase);
    const signResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/rsa/sign") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Ký nội dung", exact: true }).click();
    const signedHttp = await signResponse;
    expect(signedHttp.status()).toBe(200);
    const signed = await signedHttp.json();
    expect(signed.result).toMatchObject({
      mode: "standard",
      source,
      contentBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(signed.history.saved).toBe(true);
    await expect(page.getByText("Đã ký nội dung.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Private key PEM", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Passphrase (nếu khóa được mã hóa)")).toHaveValue("");
    await expect(page.getByText("Đã lưu kết quả vào lịch sử trình duyệt này.")).toBeVisible();

    const detailHttp = await page.request.get(`/api/history/${signed.history.id}`);
    expect(detailHttp.ok()).toBe(true);
    const detail = await detailHttp.json();
    expect(detail.result).toMatchObject({
      cipher: "rsa",
      operation: "sign",
      source,
      contentAvailable: true,
    });
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain(keys.privateKey);
    expect(serialized).not.toContain(passphrase);
    expect(serialized).not.toContain("privateKeyPem");
    const original = await page.request.get(`/api/history/${signed.history.id}/content`);
    expect(original.ok()).toBe(true);
    expect(await original.body()).toEqual(bytes);

    await page.getByRole("button", { name: "Dùng kết quả để kiểm tra" }).click();
    await expect(page.getByRole("textbox", { name: "Public key PEM", exact: true })).toHaveValue(
      keys.publicKey,
    );
    const validHttp = page.waitForResponse((response) =>
      response.url().endsWith("/api/rsa/verify"),
    );
    await page.getByRole("button", { name: "Kiểm tra nội dung", exact: true }).click();
    expect((await (await validHttp).json()).result.valid).toBe(true);
    await expect(page.getByText("Chữ ký nội dung hợp lệ.", { exact: true })).toBeVisible();

    if (source === "file")
      await page.getByLabel("Tệp nội dung .txt").setInputFiles({
        name: "changed.txt",
        mimeType: "text/plain",
        buffer: Buffer.concat([bytes, Buffer.from("!")]),
      });
    else await page.getByLabel("Nội dung ký / kiểm tra").fill(text + "!");
    const invalidHttp = page.waitForResponse((response) =>
      response.url().endsWith("/api/rsa/verify"),
    );
    await page.getByRole("button", { name: "Kiểm tra nội dung", exact: true }).click();
    const invalid = await invalidHttp;
    expect(invalid.status()).toBe(200);
    expect((await invalid.json()).result.valid).toBe(false);
    await expect(
      page.getByText("Chữ ký nội dung không hợp lệ: nội dung hoặc khóa công khai không khớp."),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
