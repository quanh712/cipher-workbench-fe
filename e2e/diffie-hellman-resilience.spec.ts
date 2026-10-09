import { expect, test, type Page } from "@playwright/test";
import type {} from "./fixtures/diffie-hellman/gateway";

async function openApp(page: Page, theme: "light" | "dark") {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { database: "ok", history: "disabled" } }),
  );
  await page.goto("/e2e/fixtures/diffie-hellman/app.html");
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
  }, theme);
  await page.getByRole("tab", { name: /Diffie–Hellman minh họa/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
}
const submit = (page: Page) =>
  page.getByRole("button", { name: "Thiết lập bí mật chung", exact: true });
const random = (page: Page) =>
  page.getByRole("button", { name: "Sinh số mũ ngẫu nhiên", exact: true });
const result = (page: Page) => page.getByRole("region", { name: "Kết quả thiết lập bí mật chung" });

for (const theme of ["light", "dark"] as const) {
  test(`DH errors, retry and accessible focus in ${theme}`, async ({ page }, testInfo) => {
    await openApp(page, theme);
    for (const task of ["exchange", "random"] as const) {
      for (const scenario of ["business", "network", "invalid"] as const) {
        await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
        await submit(page).click();
        await expect(result(page)).toBeVisible();
        await page.evaluate(({ task, scenario }) => window.__dhTest.enqueue(task, scenario), {
          task,
          scenario,
        });
        await (task === "exchange" ? submit(page) : random(page)).click();
        const alert = page.getByRole("alert");
        await expect(alert).toHaveText(
          scenario === "business"
            ? "Lỗi thử nghiệm <Backend> & yêu cầu thử lại."
            : scenario === "network"
              ? "Không thể xử lý yêu cầu. Vui lòng thử lại."
              : "Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.",
        );
        await expect(result(page)).toHaveCount(0);
        await expect(page.getByRole("region", { name: "Phân tích Diffie–Hellman" })).toHaveCount(0);
        await expect(submit(page)).toBeEnabled();
        await expect(random(page)).toBeEnabled();
        await expect(page.locator("backend")).toHaveCount(0);
        if (scenario === "business") {
          const alpha = page.getByRole("textbox", { name: "Căn nguyên thủy α" });
          await expect(alpha).toBeFocused();
          await expect(alpha).toHaveAttribute("aria-invalid", "true");
          await expect(alpha).toHaveAccessibleDescription(/Lỗi thử nghiệm/);
          await alert.screenshot({ path: testInfo.outputPath(`${task}-error.png`) });
        }
        await (task === "exchange" ? submit(page) : random(page)).click();
        await expect(alert).toHaveCount(0);
        await expect(page.getByRole("status", { name: "Trạng thái trao đổi DH" })).toContainText(
          task === "exchange" ? "Hai bên đã thiết lập" : "Đã điền hai số mũ riêng",
        );
      }
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  for (const task of ["exchange", "random"] as const) {
    test(`DH ${task} cancellation and late responses in ${theme}`, async ({ page }) => {
      await openApp(page, theme);
      for (const action of ["edit", "preset", "reset", "cipher", "header"] as const) {
        await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
        await page.evaluate((task) => window.__dhTest.enqueue(task, "late"), task);
        await (task === "exchange" ? submit(page) : random(page)).click();
        await expect(page.getByRole("form")).toHaveAttribute("aria-busy", "true");
        await expect(
          page.getByRole("button", {
            name: task === "exchange" ? "Đang thiết lập…" : "Đang sinh số mũ…",
          }),
        ).toBeDisabled();
        const oldId = await page.evaluate(() => window.__dhTest.pending[0]);
        if (action === "edit")
          await page.getByRole("textbox", { name: "Số nguyên tố q" }).fill(" 00023 ");
        if (action === "preset")
          await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
        if (action === "reset")
          await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
        if (action === "cipher") await page.getByRole("tab", { name: /Caesar/ }).click();
        if (action === "header")
          await page.getByRole("button", { name: "Làm mới", exact: true }).click();
        await expect
          .poll(() => page.evaluate((id) => window.__dhTest.calls[id].aborted, oldId))
          .toBe(true);
        if (action === "cipher" || action === "header")
          await page.getByRole("tab", { name: /Diffie–Hellman/ }).click();
        await expect(result(page)).toHaveCount(0);
        await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
        // Keep a new operation pending while the old success/error/finally arrives.
        await page.evaluate(() => window.__dhTest.enqueue("exchange", "late"));
        await submit(page).click();
        const newId = await page.evaluate(() => window.__dhTest.pending.at(-1)!);
        await page.evaluate(({ id, reject }) => window.__dhTest.release(id, reject), {
          id: oldId,
          reject: action === "preset" || action === "cipher",
        });
        await expect(page.getByRole("form")).toHaveAttribute("aria-busy", "true");
        await expect(page.getByRole("button", { name: "Đang thiết lập…" })).toBeDisabled();
        await expect(random(page)).toBeDisabled();
        await expect(result(page)).toHaveCount(0);
        await expect(page.getByRole("alert")).toHaveCount(0);
        await page.evaluate((id) => window.__dhTest.release(id), newId);
        await expect(result(page)).toBeVisible();
        await expect(page.getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("6");
        await expect(page.getByRole("textbox", { name: "Số mũ riêng X_B" })).toHaveValue("15");
        await expect(page.getByRole("status", { name: "Trạng thái trao đổi DH" })).toContainText(
          "Hai bên đã thiết lập",
        );
      }
    });
  }

  test(`DH timeout and late completion after retry in ${theme}`, async ({ page }) => {
    await openApp(page, theme);
    await page.clock.install();
    for (const task of ["exchange", "random"] as const) {
      await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
      await page.evaluate((task) => window.__dhTest.enqueue(task, "late"), task);
      await (task === "exchange" ? submit(page) : random(page)).click();
      const id = await page.evaluate(() => window.__dhTest.pending[0]);
      await page.clock.fastForward(15_001);
      await expect(page.getByRole("alert")).toHaveText(
        "Yêu cầu quá thời gian chờ. Vui lòng thử lại.",
      );
      expect(await page.evaluate((id) => window.__dhTest.calls[id].aborted, id)).toBe(true);
      await submit(page).click();
      await expect(result(page)).toBeVisible();
      await page.evaluate((id) => window.__dhTest.release(id), id);
      await expect(result(page)).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("6");
    }
  });

  test(`DH pending, missing and stale clipboard in ${theme}`, async ({ page }) => {
    await openApp(page, theme);
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await result(page).getByRole("button", { name: "Sao chép Y_A" }).click();
    await expect(result(page).getByRole("status")).toContainText(
      "Hãy chọn giá trị và sao chép thủ công.",
    );
    // Every invocation waits for an explicit browser event. No OS clipboard access.
    await page.evaluate(() => {
      document.documentElement.dataset.copyCount = "0";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (value: string) => {
            document.documentElement.dataset.copyCount = String(
              Number(document.documentElement.dataset.copyCount) + 1,
            );
            document.documentElement.dataset.copied = value;
            return new Promise<void>((resolve, reject) => {
              window.addEventListener(
                "dh-test:copy",
                (event) => {
                  if ((event as CustomEvent<boolean>).detail)
                    reject(new Error("Clipboard rejected"));
                  else resolve();
                },
                { once: true },
              );
            });
          },
        },
      });
    });
    const copy = result(page).getByRole("button", { name: "Sao chép K_B" });
    await copy.focus();
    await copy.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-copied", "2");
    for (const button of await result(page).getByRole("button").all())
      await expect(button).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("data-copy-count", "1");
    await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
    await page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
    await random(page).click();
    await expect(page.getByRole("textbox", { name: "Số mũ riêng X_A" })).toHaveValue("15");
    await submit(page).click();
    await expect(result(page)).toBeVisible();
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("dh-test:copy", { detail: true })),
    );
    await expect(result(page).getByRole("status")).toHaveCount(0);
    const newCopy = result(page).getByRole("button", { name: "Sao chép Y_A" });
    await newCopy.click();
    await expect(page.locator("html")).toHaveAttribute("data-copied", "19");
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("dh-test:copy", { detail: false })),
    );
    await expect(result(page).getByRole("status")).toHaveText("Đã sao chép Y_A.");
    await expect(newCopy).toBeEnabled();
    await expect(page.locator("html")).toHaveAttribute("data-copy-count", "2");
  });
}
