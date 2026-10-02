import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const key = "133457799BBCDFF1";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /DES.*Khả dụng/ }).click();
  await page.getByLabel("Khóa DES").fill(key);
});

test("real controls validate raw key, IV and file metadata in dark theme", async ({
  page,
}, info) => {
  await page.getByLabel("Nội dung đầu vào DES").fill("Hello World");
  await page.getByLabel("Khóa DES").fill("bad-key");
  await expect(page.getByRole("button", { name: "Mã hóa", exact: true })).toBeDisabled();
  await page.getByLabel("Khóa DES").fill("13345779 9bbcdff1");
  await page.getByLabel("Chế độ mã khối DES").selectOption("CBC");
  await page.getByLabel("IV DES").fill("bad");
  await expect(page.getByRole("button", { name: "Mã hóa", exact: true })).toBeDisabled();
  await page.getByLabel("IV DES").fill("00000000 00000000");
  await page.getByRole("button", { name: "Chuyển sang nền tối" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/des-real-dark-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "File .txt", exact: true }).click();
  await page
    .getByLabel("Chọn file DES")
    .setInputFiles({ name: "bad.des", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.getByText("Chỉ chấp nhận file .txt.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mã hóa", exact: true })).toBeDisabled();
});

for (const vector of [
  { text: "Hello World", format: "text", expected: "B1CA74BB3514268701A9ACC3E4E69FAA" },
  { text: "Xin chào DES!", format: "text", expected: "06602CF53D9AD6AAC800F8D8643F636C" },
  { text: "0123456789ABCDEF", format: "hex", expected: "85E813540F0AB405" },
]) {
  test(`real ${vector.format} round trip ${vector.text}`, async ({ page }) => {
    await expect(page.getByRole("note")).toHaveCount(0);
    await page.getByLabel("Định dạng DES").selectOption(vector.format);
    await page.getByLabel("Nội dung đầu vào DES").fill(vector.text);
    await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
    await expect(page.getByLabel("Nội dung kết quả DES")).toHaveText(vector.expected);
    await page.getByRole("radio", { name: /Giải mã/ }).click();
    await page
      .getByLabel("Nội dung đầu vào DES")
      .fill(vector.expected.toLowerCase().replace(/(.{16})/g, "$1\r\n"));
    await page.getByRole("button", { name: "Giải mã", exact: true }).click();
    await expect(page.getByLabel("Nội dung kết quả DES")).toHaveText(vector.text);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("CBC requires IV, keeps it beside output and round trips", async ({ page }) => {
  await page.getByLabel("Chế độ mã khối DES").selectOption("CBC");
  await page.getByLabel("Nội dung đầu vào DES").fill("Hello World");
  await expect(page.getByRole("button", { name: "Mã hóa", exact: true })).toBeDisabled();
  await page.getByLabel("IV DES").fill("0000000000000000");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  const expected = "B1CA74BB351426875F9A5BCA734D9EF4";
  await expect(page.getByLabel("Nội dung kết quả DES")).toHaveText(expected);
  await expect(page.getByRole("region", { name: "Kết quả DES" })).toContainText("0000000000000000");
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByLabel("Nội dung đầu vào DES").fill(expected);
  await page.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(page.getByLabel("Nội dung kết quả DES")).toHaveText("Hello World");
  await page.getByLabel("Chế độ mã khối DES").selectOption("ECB");
  await expect(page.getByLabel("IV DES")).toHaveCount(0);
});

test("server warnings remain visible and do not block result", async ({ page }) => {
  await page.getByLabel("Định dạng DES").selectOption("hex");
  await page.getByLabel("Nội dung đầu vào DES").fill("00000000000000000000000000000000");
  await page.getByLabel("Khóa DES").fill("0000000000000000");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByLabel("Nội dung kết quả DES")).toBeVisible();
  await expect(
    page.getByText("Khóa yếu: mã hóa hai lần sẽ trả lại bản rõ. Không nên dùng.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Chế độ ECB: có khối bản mã lặp lại/)).toBeVisible();
  await page.getByLabel("Khóa DES").fill("011F011F010E010E");
  await page.getByLabel("Nội dung đầu vào DES").fill("0123456789ABCDEF");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByText(/Khóa nửa yếu: tồn tại khóa khác/)).toBeVisible();
});

test("file preview/download use original file, server filename and BOM", async ({ page }, info) => {
  const responseModes: string[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/api/des/file")) {
      responseModes.push(
        response.headers()["content-type"]?.startsWith("text/plain") ? "file" : "content",
      );
    }
  });
  await page.getByRole("button", { name: "File .txt", exact: true }).click();
  await page.getByLabel("Chọn file DES").setInputFiles({
    name: "bai.tap.TXT",
    mimeType: "text/plain",
    buffer: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Hello World")]),
  });
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByLabel("Nội dung kết quả DES")).toHaveText(
    "B1CA74BB3514268701A9ACC3E4E69FAA",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("bai.tap.encrypted.txt");
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  expect(bytes.subarray(3).toString()).toBe("B1CA74BB3514268701A9ACC3E4E69FAA");
  expect(responseModes).toEqual(["content", "file"]);
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByLabel("Chọn file DES").setInputFiles({
    name: "cipher.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("B1CA74BB35142687\r\n01A9ACC3E4E69FAA\r\n"),
  });
  await page.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(page.getByLabel("Nội dung kết quả DES")).toHaveText("Hello World");
  await page.screenshot({ path: `/tmp/des-real-${info.project.name}.png`, fullPage: true });
});

test("invalid UTF-8 and padding show exact server errors; network retry works", async ({
  page,
}) => {
  await page.getByRole("button", { name: "File .txt", exact: true }).click();
  await page
    .getByLabel("Chọn file DES")
    .setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from([0xff]) });
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByText("File phải sử dụng UTF-8.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Văn bản", exact: true }).click();
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByLabel("Nội dung đầu vào DES").fill("85E813540F0AB405");
  await page.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(
    page.getByText("Padding không hợp lệ: sai khóa hoặc bản mã bị hỏng.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Mã hóa/ }).click();
  await page.getByLabel("Nội dung đầu vào DES").fill("Hello World");
  await page.route("**/api/des/encrypt", (route) => route.abort());
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(
    page.getByText("Không thể xử lý yêu cầu. Vui lòng thử lại.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/des/encrypt");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByLabel("Nội dung kết quả DES")).toHaveText(
    "B1CA74BB3514268701A9ACC3E4E69FAA",
  );
});

test("analysis displays real DES rounds and padding filters use the new contract", async ({
  page,
}, info) => {
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByLabel("Nội dung kết quả DES")).toHaveText("85E813540F0AB405");
  await page.getByRole("tab", { name: "Phân tích", exact: true }).click();
  await expect(page.getByText("CC00CCFFF0AAF0AA", { exact: true })).toBeVisible();
  await expect(
    page
      .locator(".des-trace table")
      .filter({ hasText: "Giá trị sau từng vòng" })
      .locator("tbody tr"),
  ).toHaveCount(16);
  await expect(page.getByText("Phân biệt ECB và CBC", { exact: true })).toHaveCount(0);
  await page.getByText("1. Sinh 16 khóa con", { exact: false }).click();
  await expect(page.getByText("1B02EFFC7072", { exact: true })).toBeVisible();
  await page.getByText("4. Chi tiết hàm f", { exact: false }).click();
  await page.getByLabel("Vòng phân tích").selectOption("16");
  await expect(page.getByText("Vòng 16", { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/des-trace-${info.project.name}.png`, fullPage: true });

  await page.getByRole("tab", { name: /Hill.*Khả dụng/ }).click();
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByRole("textbox", { name: "Văn bản đầu vào" }).fill("DPDKK!B");
  await page.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect
    .poll(async () =>
      (await page.locator(".hill-result__text .character").allTextContents()).join(""),
    )
    .toBe("HELLO!");
  const filter = page.getByRole("checkbox", {
    name: "Tự động lọc ký tự đệm (Playfair/Hill padding)",
  });
  await filter.uncheck();
  await expect
    .poll(async () =>
      (await page.locator(".hill-result__text .character").allTextContents()).join(""),
    )
    .toBe("HELLO!X");
  await filter.check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString("utf8")).toBe("HELLO!");

  await page.getByRole("tab", { name: /Playfair.*Khả dụng/ }).click();
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("PDGW");
  await page.getByRole("textbox", { name: "Khóa Playfair" }).fill("PLAYFAIR EXAMPLE");
  await page.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Văn bản", exact: true })).toHaveText("ABX");
  await filter.uncheck();
  await expect(page.getByRole("tabpanel", { name: "Văn bản", exact: true })).toHaveText("ABXQ");
  await filter.check();
  await page.getByRole("button", { name: "File .txt", exact: true }).click();
  await page
    .getByLabel("Chọn file văn bản")
    .setInputFiles({ name: "playfair.txt", mimeType: "text/plain", buffer: Buffer.from("PDGW") });
  await page.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Văn bản", exact: true })).toHaveText("ABX");
  const fileDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả", exact: true }).click();
  const fileStream = await (await fileDownload).createReadStream();
  const fileChunks: Buffer[] = [];
  for await (const chunk of fileStream!) fileChunks.push(Buffer.from(chunk));
  expect(Buffer.concat(fileChunks).toString("utf8")).toBe("ABX");
  await page.screenshot({ path: `/tmp/padding-filter-${info.project.name}.png`, fullPage: true });
});

test("CBC trace prepares UTF-8 text and decrypt trace uses reversed subkeys", async ({ page }) => {
  await page.getByLabel("Nội dung đầu vào DES").fill("Hello World");
  await page.getByLabel("Chế độ mã khối DES").selectOption("CBC");
  await page.getByLabel("IV DES").fill("1234567890ABCDEF");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.getByLabel("Nội dung kết quả DES")).toContainText("FE6885B7E58524D4");
  const ciphertext = await page.getByLabel("Nội dung kết quả DES").textContent();
  await page.getByRole("tab", { name: "Phân tích", exact: true }).click();
  await expect(page.locator(".des-trace")).toContainText("5A513A14FF8B9A80");
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByLabel("Nội dung đầu vào DES").fill(ciphertext!);
  await page.getByRole("button", { name: "Giải mã", exact: true }).click();
  await expect(page.locator(".des-trace")).toContainText("Giải mã dùng khóa con K₁₆ → K₁.");
  await expect(page.locator(".des-trace")).toContainText("FE6885B7E58524D4");
  await expect(page.locator(".des-trace")).toContainText("5A513A14FF8B9A80");
});
