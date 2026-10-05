import { expect, test, type Page } from "@playwright/test";

const algorithms = ["Caesar", "Vigenère", "Playfair", "Affine", "Hệ mã hàng", "Hill", "DES"];

async function expectMatchingPanels(page: Page) {
  await expect
    .poll(async () => {
      const input = (await page.locator(".workspace__input-column .panel").first().boundingBox())!;
      const output = (await page.locator(".cipher-output-panel > .panel").boundingBox())!;
      return Math.max(Math.abs(input.height - output.height), Math.abs(input.width - output.width));
    })
    .toBeLessThanOrEqual(1);
}

async function processExample(page: Page) {
  await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.locator(".cipher-output-panel .status--success")).toBeVisible();
  const closeNotice = page.getByRole("button", { name: "Đóng thông báo" });
  if (await closeNotice.isVisible()) await closeNotice.click();
  await page.getByRole("tab", { name: "Phân tích", exact: true }).click();
}

async function rowStyle(page: Page) {
  return page
    .locator(".cipher-output-panel .stats-list > div")
    .first()
    .evaluate((row) => {
      const style = getComputedStyle(row);
      const label = getComputedStyle(row.querySelector("dt")!);
      return {
        padding: style.padding,
        border: style.borderBottom,
        font: label.font,
        color: label.color,
      };
    });
}

for (const algorithm of algorithms) {
  test(`${algorithm} has the same empty analysis as Affine`, async ({ page }, info) => {
    await page.goto("/");
    await page.getByRole("tab", { name: /Affine/ }).click();
    await page.getByRole("tab", { name: "Phân tích", exact: true }).click();
    const emptyStyle = async () =>
      page.locator(".cipher-output-panel .analysis-empty").evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          font: style.font,
          padding: style.padding,
          background: style.backgroundColor,
          minHeight: style.minHeight,
          color: style.color,
        };
      });
    const affineEmptyStyle = await emptyStyle();
    await page.getByRole("tab", { name: new RegExp(algorithm) }).click();
    await page.getByRole("tab", { name: "Phân tích", exact: true }).click();
    const analysis = page.getByRole("tabpanel", { name: "Phân tích", exact: true });
    await expect(analysis).toHaveText(
      "Chạy mã hóa hoặc giải mã để xem thông tin và các khối của kết quả thực tế.",
    );
    await expect(analysis.locator(".stats-list")).toHaveCount(0);
    await expect(analysis.locator(".analysis-empty")).toBeVisible();
    expect(await emptyStyle()).toEqual(affineEmptyStyle);
    await expectMatchingPanels(page);
    await page.locator(".cipher-output-panel > .panel").screenshot({
      path: info.outputPath("analysis-empty.png"),
    });
    await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
    await page.getByRole("tab", { name: "Phân tích", exact: true }).click();
    if (algorithm === "DES") {
      await page.getByLabel("Chế độ mã khối DES").selectOption("CBC");
      await page.getByRole("button", { name: "File .txt", exact: true }).click();
      await page.getByLabel("Chọn file DES").setInputFiles({
        name: "draft.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Nội dung chưa xử lý"),
      });
      await expect(page.getByLabel("Xem trước nội dung file")).toContainText("Nội dung chưa xử lý");
      await expect(analysis.getByRole("heading")).toHaveCount(0);
    }
    await expect(analysis).toHaveText(
      "Chạy mã hóa hoặc giải mã để xem thông tin và các khối của kết quả thực tế.",
    );
    await expectMatchingPanels(page);
    await page.getByRole("tab", { name: "Văn bản", exact: true }).click();
    await expectMatchingPanels(page);
  });

  test(`${algorithm} analysis matches Affine and keeps the input panel size`, async ({
    page,
  }, info) => {
    await page.goto("/");
    if (info.project.name === "mobile") {
      await page.getByRole("button", { name: "Chuyển sang nền tối" }).click();
    }
    await page.getByRole("tab", { name: /Affine/ }).click();
    await processExample(page);
    const affineStyle = await rowStyle(page);

    await page.getByRole("tab", { name: new RegExp(algorithm) }).click();
    await expectMatchingPanels(page);
    await page.getByRole("tab", { name: "Phân tích", exact: true }).click();
    await expectMatchingPanels(page);
    await page.getByRole("tab", { name: "Văn bản", exact: true }).click();
    await processExample(page);
    await expectMatchingPanels(page);
    expect(await rowStyle(page)).toEqual(affineStyle);
    await page.locator(".cipher-output-panel > .panel").screenshot({
      path: info.outputPath("analysis-overview.png"),
    });

    const analysis = page.getByRole("tabpanel", { name: "Phân tích", exact: true });
    const summary = analysis.locator("summary").first();
    if (await summary.count()) await summary.click();
    await analysis.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expectMatchingPanels(page);
    await expect(page.locator(".cipher-output-panel > .panel > .status")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page
      .locator(".cipher-output-panel > .panel")
      .screenshot({ path: info.outputPath("analysis.png") });
    await page.getByRole("tab", { name: "Văn bản", exact: true }).click();
    await expectMatchingPanels(page);
  });
}
