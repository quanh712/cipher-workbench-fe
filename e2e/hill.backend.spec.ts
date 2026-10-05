import { expect, test, type Page } from "@playwright/test";

async function openHill(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: /Hill/ }).click();
  await expect(page.getByRole("region", { name: "Khóa Hill", exact: true })).toContainText(
    "Khóa khả nghịch",
  );
}
async function process(page: Page, mode: "encrypt" | "decrypt", text: string) {
  await page.getByRole("radio", { name: mode === "encrypt" ? /Mã hóa/ : /Giải mã/ }).click();
  await page.getByRole("textbox", { name: "Văn bản đầu vào" }).fill(text);
  const response = page.waitForResponse((r) => r.url().endsWith(`/api/hill/${mode}`));
  await page
    .getByRole("button", { name: mode === "encrypt" ? "Mã hóa" : "Giải mã", exact: true })
    .click();
  return (await response).json();
}

test("default matrix, punctuation padding, decrypt, tooltip and full download", async ({
  page,
}) => {
  await openHill(page);
  const encrypted = await process(page, "encrypt", "HELLO!");
  expect(encrypted.result).toBe("DPDKK!B");
  await expect(page.locator(".hill-result__text")).toContainText("K!B");
  await expect(page.locator(".hill-result__block")).toHaveCount(3);
  await expect(page.getByLabel(/Khối 1: 7, 4 · K → 3, 15/)).toHaveAttribute(
    "aria-label",
    /K=\[3, 3\] \[2, 5\]/,
  );
  await expect(page.getByText(encrypted.warnings[0].message, { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString("utf8")).toBe("DPDKK!B");
  expect((await process(page, "decrypt", "DPDKK!B")).result).toBe("HELLO!X");
});

test("keyword sends m, renders normalized matrix, and has the row-vector result", async ({
  page,
}) => {
  await openHill(page);
  await page.getByRole("button", { name: "Từ khóa", exact: true }).click();
  await page.getByRole("textbox", { name: /Từ khóa/ }).fill("HIL");
  await expect(page.getByText("Từ khóa cần đúng 4 chữ cái, hiện có 3.")).toBeVisible();
  const response = page.waitForResponse((r) => r.url().endsWith("/api/hill/key/analyze"));
  await page.getByRole("textbox", { name: /Từ khóa/ }).fill("HILL");
  const analyzed = await response;
  expect(analyzed.request().postDataJSON()).toEqual({ keyword: "HILL", m: 2 });
  expect((await analyzed.json()).result.matrix).toEqual([
    [7, 8],
    [11, 11],
  ]);
  const request = page.waitForRequest((r) => r.url().endsWith("/api/hill/encrypt"));
  expect((await process(page, "encrypt", "HILLCIPHER")).result).toBe("HOQBYAAPHL");
  expect((await request).postDataJSON()).toMatchObject({ keyword: "HILL", m: 2 });
  await expect(page.getByRole("textbox", { name: "Khóa hàng 1 cột 1" })).toHaveValue("7");
});

test("shows E04 and E05 messages verbatim and validates matrix input locally", async ({ page }) => {
  await openHill(page);
  const cell = page.getByRole("textbox", { name: "Khóa hàng 1 cột 1" });
  await cell.fill("a");
  await expect(cell).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Ô hàng 1 cột 1 phải là số nguyên.")).toBeVisible();
  await cell.fill("2");
  const response = page.waitForResponse((r) => r.url().endsWith("/api/hill/key/analyze"));
  await page.getByRole("textbox", { name: "Khóa hàng 1 cột 2" }).fill("4");
  await page.getByRole("textbox", { name: "Khóa hàng 2 cột 1" }).fill("1");
  await page.getByRole("textbox", { name: "Khóa hàng 2 cột 2" }).fill("3");
  const error = await (await response).json();
  expect(error.code).toBe("E04");
  await expect(page.getByRole("region", { name: "Phân tích khóa" })).toContainText(error.message);
  await expect(page.getByRole("button", { name: "Mã hóa", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  const decryptError = await process(page, "decrypt", "DPL");
  expect(decryptError.code).toBe("E05");
  await expect(page.getByRole("region", { name: "Bản rõ" })).toContainText(decryptError.message);
});

test("NFD Vietnamese stays outside blocks, and W02 retry sends stripDiacritics", async ({
  page,
}) => {
  await openHill(page);
  const text = "HELP A\u0301!";
  const encrypted = await process(page, "encrypt", text);
  expect(encrypted.result).toBe("DPLE A\u0301!");
  expect(encrypted.blocks).toHaveLength(2);
  await expect(page.locator(".hill-result__block")).toHaveCount(2);
  await expect(page.locator(".hill-result__text")).toContainText("A\u0301!");
  const response = page.waitForResponse((r) => r.url().endsWith("/api/hill/encrypt"));
  await page.getByRole("button", { name: "Bỏ dấu và thử lại" }).click();
  const retry = await response;
  expect(retry.request().postDataJSON().options.stripDiacritics).toBe(true);
  expect((await retry.json()).warnings.every((w: { code: string }) => w.code !== "W02")).toBe(true);
  await expect(page.getByRole("button", { name: "Bỏ dấu và thử lại" })).toHaveCount(0);
});

test("random m=3/4 returns full analysis without a second analyze request", async ({ page }) => {
  await openHill(page);
  let analyzes = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/hill/key/analyze")) analyzes += 1;
  });
  for (const m of [3, 4]) {
    const response = page.waitForResponse((r) => r.url().endsWith(`/api/hill/key/random?m=${m}`));
    await page.getByRole("combobox", { name: /Cấp ma trận/ }).selectOption(String(m));
    const generated = await (await response).json();
    expect(generated.result.m).toBe(m);
    await expect(page.getByRole("textbox", { name: `Khóa hàng ${m} cột ${m}` })).toHaveValue(
      String(generated.result.matrix[m - 1][m - 1]),
    );
    await expect(page.getByRole("region", { name: "Phân tích khóa" })).toContainText(
      "Khóa khả nghịch",
    );
    const plain = "HELP TEST";
    const encrypted = await process(page, "encrypt", plain);
    expect((await process(page, "decrypt", encrypted.result)).result).toBe(
      plain + "X".repeat((m - (8 % m)) % m),
    );
  }
  expect(analyzes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("file picker uses JSON, strips one BOM, rejects invalid files and preserves drafts", async ({
  page,
}, testInfo) => {
  await openHill(page);
  await page.getByRole("textbox", { name: "Văn bản đầu vào" }).fill("Typed draft");
  await page.getByRole("button", { name: "File .txt", exact: true }).click();
  await expect(page.getByText("Kéo thả file .txt vào đây")).toBeVisible();
  const fileInput = page.getByLabel("Chọn file văn bản");
  await page.locator(".hill-input .file-picker").evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["\uFEFFHELP"], "hill.txt", { type: "text/plain" }));
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });
  await expect(page.getByLabel("Xem trước nội dung file")).toHaveText("HELP");
  await page.screenshot({ path: testInfo.outputPath("hill-file-picker.png"), fullPage: true });
  const response = page.waitForResponse((r) => r.url().endsWith("/api/hill/encrypt"));
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  const encrypted = await response;
  expect(encrypted.request().postDataJSON().text).toBe("HELP");
  expect(encrypted.request().headers()["content-type"]).toBe("application/json");
  expect((await encrypted.json()).result).toBe("DPLE");
  await fileInput.setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from([0xff]),
  });
  await expect(page.getByText("Không đọc được file. Lưu lại file với mã hóa UTF-8.")).toBeVisible();
  await expect(page.getByLabel("Xem trước nội dung file")).toHaveText("HELP");
  await fileInput.setInputFiles({
    name: "large.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(5_242_881, 65),
  });
  await expect(page.getByText("Văn bản vượt quá giới hạn 5 MiB.")).toBeVisible();
  await expect(page.getByLabel("Xem trước nội dung file")).toHaveText("HELP");
  await fileInput.setInputFiles({
    name: "changed.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("DPLE"),
  });
  await expect(page.getByText("changed.txt", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Xem trước nội dung file")).toHaveText("DPLE");
  await page.getByRole("button", { name: "Gỡ file", exact: true }).click();
  await expect(page.getByText("Kéo thả file .txt vào đây")).toBeVisible();
  await page.getByRole("button", { name: "Văn bản", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Văn bản đầu vào" })).toHaveValue("Typed draft");
});

test("Backend text boundary is exactly 5 MiB before normalization", async ({ request }) => {
  const payload = {
    text: " ".repeat(5_242_880),
    key: [
      [3, 3],
      [2, 5],
    ],
  };
  const atLimit = await request.post("/api/hill/encrypt", { data: payload });
  expect(atLimit.status()).toBe(422);
  expect((await atLimit.json()).code).toBe("E01");
  const over = await request.post("/api/hill/encrypt", {
    data: { ...payload, text: payload.text + " " },
  });
  expect(over.status()).toBe(413);
  expect(await over.json()).toMatchObject({
    success: false,
    code: "E06",
    details: { actualBytes: 5_242_881, maxBytes: 5_242_880 },
  });
});

test("rapid key edits debounce and a disconnected transform can retry against the real API", async ({
  page,
}) => {
  await openHill(page);
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/hill/key/analyze")) calls += 1;
  });
  const analyzed = page.waitForResponse((r) => r.url().endsWith("/api/hill/key/analyze"));
  for (const value of ["31", "312", "3123", "31234", "312345"]) {
    await page.getByRole("textbox", { name: "Khóa hàng 1 cột 1" }).fill(value);
  }
  expect((await (await analyzed).json()).success).toBe(true);
  await expect(page.getByRole("region", { name: "Phân tích khóa" })).toContainText(
    "Khóa khả nghịch",
  );
  expect(calls).toBe(1);
  await page.getByRole("textbox", { name: "Văn bản đầu vào" }).fill("HELP");
  await page.route("**/api/hill/encrypt", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  const resultPanel = page.getByRole("region", { name: "Bản mã" });
  await expect(resultPanel).toContainText("Không kết nối được máy chủ. Thử lại.");
  await page.unroute("**/api/hill/encrypt");
  const retried = page.waitForResponse((r) => r.url().endsWith("/api/hill/encrypt"));
  await resultPanel.getByRole("button", { name: "Thử lại", exact: true }).click();
  expect((await (await retried).json()).success).toBe(true);
  await expect(page.locator(".hill-result__block")).toHaveCount(2);
});

for (const vector of [
  {
    m: 3,
    key: [
      [6, 24, 1],
      [13, 16, 10],
      [20, 17, 15],
    ],
    text: "ACT",
    expected: "QRT",
  },
  {
    m: 4,
    key: [
      [3, 1, 2, 0],
      [0, 5, 1, 4],
      [0, 0, 7, 2],
      [0, 0, 0, 9],
    ],
    text: "TEST",
    expected: "FNMP",
  },
]) {
  test(`matrix m=${vector.m} matches the official row-vector oracle`, async ({ page }) => {
    await openHill(page);
    const random = page.waitForResponse((r) =>
      r.url().endsWith(`/api/hill/key/random?m=${vector.m}`),
    );
    await page.getByRole("combobox", { name: /Cấp ma trận/ }).selectOption(String(vector.m));
    await random;
    await expect(page.getByRole("button", { name: "Khóa ngẫu nhiên" })).toBeEnabled();
    for (let row = 0; row < vector.m; row += 1) {
      for (let column = 0; column < vector.m; column += 1) {
        await page
          .getByRole("textbox", { name: `Khóa hàng ${row + 1} cột ${column + 1}` })
          .fill(String(vector.key[row][column]));
      }
    }
    expect((await process(page, "encrypt", vector.text)).result).toBe(vector.expected);
    await expect(page.locator(".hill-result__block")).toHaveCount(1);
    expect((await process(page, "decrypt", vector.expected)).result).toBe(vector.text);
  });
}
