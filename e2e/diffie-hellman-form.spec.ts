import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`DH form: keyboard, validation and layout in ${theme}`, async ({ page }, testInfo) => {
    const apiRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
    });
    await page.goto("/e2e/fixtures/diffie-hellman/");
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const q = page.getByRole("textbox", { name: "Số nguyên tố q" });
    await expect(q).toHaveValue("");
    await expect(
      page.getByRole("form", { name: "Thiết lập Diffie–Hellman" }).getByRole("textbox"),
    ).toHaveCount(4);
    await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath("form.png"),
      fullPage: true,
      animations: "disabled",
    });

    // Form actions and field order are reachable by keyboard.
    await page.getByRole("button", { name: "Đặt lại", exact: true }).focus();
    for (const label of [
      "Số nguyên tố q",
      "Căn nguyên thủy α",
      "Số mũ riêng X_A",
      "Số mũ riêng X_B",
    ]) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("textbox", { name: label })).toBeFocused();
    }
    await q.fill("1".repeat(40));
    await q.press("Enter");
    await expect(page.getByRole("alert")).toContainText("39 chữ số");
    await expect(q).toBeFocused();
    await expect(q).toHaveAttribute("aria-invalid", "true");

    await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await q.focus();
    await q.press("Enter");
    await expect(page.getByRole("status", { name: "Trạng thái trao đổi DH" })).toContainText(
      "Hai bên đã thiết lập cùng bí mật chung.",
    );
    const result = page.getByRole("region", { name: "Kết quả thiết lập bí mật chung" });
    const a = result.getByRole("region", { name: "Kết quả bên A" });
    const b = result.getByRole("region", { name: "Kết quả bên B" });
    const exchange = result.getByRole("region", { name: "Trao đổi khóa công khai" });
    await expect(a.getByText("8", { exact: true })).toBeVisible();
    await expect(a.getByText("2", { exact: true })).toBeVisible();
    await expect(b.getByText("19", { exact: true })).toBeVisible();
    await expect(b.getByText("2", { exact: true })).toBeVisible();
    await expect(exchange).toContainText("A → BY_A = 8");
    await expect(exchange).toContainText("B → AY_B = 19");
    const boxes = await Promise.all([a.boundingBox(), exchange.boundingBox(), b.boundingBox()]);
    const axis = testInfo.project.name === "375px" ? "y" : "x";
    expect(boxes[0]![axis]).toBeLessThan(boxes[1]![axis]);
    expect(boxes[1]![axis]).toBeLessThan(boxes[2]![axis]);

    const analysis = page.getByRole("region", { name: "Phân tích Diffie–Hellman" });
    await expect(analysis.locator("details")).toHaveCount(4);
    for (const symbol of ["Y_A", "Y_B", "K_A", "K_B"]) {
      const summary = analysis.locator("summary").filter({ hasText: `Trace ${symbol}` });
      await expect(summary.locator("..")).not.toHaveAttribute("open", "");
      await summary.focus();
      await summary.press("Enter");
      const scroll = analysis.getByRole("region", { name: `Bảng trace ${symbol}` });
      await expect(scroll.getByRole("table")).toBeVisible();
      await scroll.focus();
      await expect(scroll).toBeFocused();
      if (testInfo.project.name === "375px") {
        expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
          true,
        );
        await scroll.press("ArrowRight");
        await expect
          .poll(() => scroll.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
      }
      await summary.focus();
      await summary.press("Space");
      await expect(scroll).not.toBeVisible();
      await summary.press("Space");
      await expect(scroll).toBeVisible();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await analysis.screenshot({
      path: testInfo.outputPath("analysis.png"),
      animations: "disabled",
    });

    // Test-only clipboard stub: validate exact payload without touching the system clipboard.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            document.documentElement.dataset.copied = value;
          },
        },
      });
    });
    for (const [symbol, value] of [
      ["Y_A", "8"],
      ["Y_B", "19"],
      ["K_A", "2"],
      ["K_B", "2"],
    ]) {
      const copy = result.getByRole("button", { name: `Sao chép ${symbol}` });
      await copy.focus();
      await copy.press("Enter");
      await expect(result.getByRole("status")).toHaveText(`Đã sao chép ${symbol}.`);
      await expect(page.locator("html")).toHaveAttribute("data-copied", value);
    }
    await result.screenshot({ path: testInfo.outputPath("result.png"), animations: "disabled" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Clipboard denied");
          },
        },
      });
    });
    await result.getByRole("button", { name: "Sao chép Y_A" }).click();
    await expect(result.getByRole("status")).toContainText(
      "Hãy chọn giá trị và sao chép thủ công.",
    );
    await page.getByRole("button", { name: "Sinh số mũ ngẫu nhiên" }).click();
    await expect(page.getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("15");
    await expect(page.getByRole("textbox", { name: "Số mũ riêng X_B" })).toHaveValue("6");
    await expect(page.getByRole("status", { name: "Trạng thái trao đổi DH" })).toContainText(
      "Đã điền hai số mũ riêng",
    );
    await expect(result).toHaveCount(0);
    await expect(analysis).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(apiRequests).toEqual([]);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`DH app: selector, retained draft and header reset in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.route("**/api/health", (route) =>
      route.fulfill({ json: { database: "ok", history: "disabled" } }),
    );
    await page.goto("/e2e/fixtures/diffie-hellman/app.html");
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const caesar = page.getByRole("tab", { name: /Caesar/ });
    const dh = page.getByRole("tab", { name: /Diffie–Hellman minh họa/ });
    await caesar.focus();
    await caesar.press("End");
    await expect(dh).toBeFocused();
    await expect(dh).toHaveAttribute("aria-selected", "true");
    await dh.press("ArrowRight");
    await expect(caesar).toBeFocused();
    await caesar.press("ArrowLeft");
    await expect(dh).toBeFocused();
    await dh.press("Home");
    await expect(caesar).toBeFocused();
    await caesar.press("End");
    await expect(dh).toBeFocused();
    await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
    const q = page.getByRole("textbox", { name: "Số nguyên tố q" });
    await q.fill(" 00023 ");
    await page.getByRole("button", { name: "Thiết lập bí mật chung" }).click();
    const analysis = page.getByRole("region", { name: "Phân tích Diffie–Hellman" });
    await expect(analysis).toBeVisible();
    await analysis.locator("summary").first().click();
    await caesar.click();
    await dh.click();
    await expect(q).toHaveValue(" 00023 ");
    await expect(analysis).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("app-dh.png"),
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Làm mới", exact: true }).click();
    await expect(caesar).toHaveAttribute("aria-selected", "true");
    await dh.click();
    await expect(q).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Căn nguyên thủy α" })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Số mũ riêng X_B" })).toHaveValue("");
  });
}
