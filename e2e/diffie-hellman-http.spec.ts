import { expect, test, type Page, type Route, type Request } from "@playwright/test";
import {
  createDhPresetWireResult,
  createDhSwappedResult,
} from "../src/features/diffieHellman/test/fixtures";

type Task = "exchange" | "random";
type Reply = "success" | "business" | "network" | "malformed" | "invalid" | "hold";
const exchangeBody = () => createDhPresetWireResult();
const randomBody = () => {
  const r = createDhSwappedResult();
  return {
    success: true,
    privateKeyA: r.privateA,
    privateKeyB: r.privateB,
    publicKeyA: r.publicA,
    publicKeyB: r.publicB,
    sharedKeyA: r.sharedA,
    sharedKeyB: r.sharedB,
    match: r.matched,
    warning: r.warning,
    steps: {
      publicKeyA: r.traces!.publicA.steps,
      publicKeyB: r.traces!.publicB.steps,
      sharedKeyA: r.traces!.sharedA.steps,
      sharedKeyB: r.traces!.sharedB.steps,
    },
  };
};
const form = (page: Page) =>
  page.getByRole("form", { name: "Thiết lập Diffie–Hellman", exact: true });
const result = (page: Page) => page.getByRole("region", { name: "Kết quả thiết lập bí mật chung" });
const analysis = (page: Page) => page.getByRole("region", { name: "Phân tích Diffie–Hellman" });
const field = (page: Page, name: string) => form(page).getByRole("textbox", { name, exact: true });
const button = (page: Page, task: Task) =>
  page.getByRole("button", {
    name: task === "exchange" ? "Thiết lập bí mật chung" : "Sinh số mũ ngẫu nhiên",
    exact: true,
  });
const example = (page: Page) =>
  page.getByRole("button", { name: "Tạo ví dụ", exact: true }).click();
async function expectIdle(page: Page) {
  await expect(form(page)).toHaveAttribute("aria-busy", "false");
  await expect(button(page, "exchange")).toBeEnabled();
  await expect(button(page, "random")).toBeEnabled();
}
async function openApp(page: Page, theme: "light" | "dark") {
  const calls: Request[] = [];
  const pending: Route[] = [];
  const failed: Request[] = [];
  const replies: Reply[] = [];
  page.on("requestfailed", (request) => failed.push(request));
  // Catch all API calls: the test never relies on a running Backend/proxy.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/health") {
      await route.fulfill({
        json: { success: true, result: { database: "ok", history: "disabled" } },
      });
      return;
    }
    expect(["/api/dh/exchange"]).toContain(path);
    calls.push(request);
    const reply = replies.shift() ?? "success";
    if (reply === "hold") {
      pending.push(route);
      return;
    }
    if (reply === "network") {
      await route.abort("failed");
      return;
    }
    if (reply === "malformed") {
      await route.fulfill({ contentType: "application/json", body: "{" });
      return;
    }
    if (reply === "business") {
      await route.fulfill({
        status: 422,
        json: {
          success: false,
          code: "NOT_PRIMITIVE_ROOT",
          message: "Lỗi Backend <b>chỉ là text</b>.",
          field: "alpha",
        },
        headers: { "Cache-Control": "no-store" },
      });
      return;
    }
    const body = request.postDataJSON().privateKeyA ? exchangeBody() : randomBody();
    await route.fulfill({
      json: reply === "invalid" ? { ...body, match: false } : body,
      headers: { "Cache-Control": "no-store" },
    });
  });
  await page.addInitScript((value) => localStorage.setItem("cipher-workbench-theme", value), theme);
  await page.goto("/e2e/fixtures/diffie-hellman/http-app.html");
  await page.getByRole("tab", { name: /Diffie–Hellman/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  return { calls, pending, failed, replies };
}
async function releaseCancelled(route: Route, task: Task) {
  // Chromium may reject fulfilling an already-cancelled request; either outcome is valid.
  try {
    await route.fulfill({ json: task === "exchange" ? exchangeBody() : randomBody() });
  } catch {
    expect(route.request().failure()).not.toBeNull();
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`DH HTTP: submit, random, trace and layout in ${theme}`, async ({ page }, testInfo) => {
    const http = await openApp(page, theme);
    await expect(field(page, "Số nguyên tố q")).toHaveValue("");
    expect(http.calls).toHaveLength(0);
    await example(page);
    expect(http.calls).toHaveLength(0);
    await field(page, "Số nguyên tố q").fill(" 00023 ");
    await field(page, "Số nguyên tố q").press("Enter");
    await expect(result(page)).toBeVisible();
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0].method()).toBe("POST");
    expect(http.calls[0].headers()["content-type"]).toBe("application/json");
    expect(http.calls[0].postDataJSON()).toEqual({
      q: "23",
      alpha: "5",
      privateKeyA: "6",
      privateKeyB: "15",
    });
    await expect(
      result(page).getByRole("region", { name: "Kết quả bên A" }).getByText("8", { exact: true }),
    ).toBeVisible();
    await expect(
      result(page).getByRole("region", { name: "Kết quả bên B" }).getByText("19", { exact: true }),
    ).toBeVisible();
    await expect(analysis(page).locator("details")).toHaveCount(4);
    for (const symbol of ["Y_A", "Y_B", "K_A", "K_B"]) {
      const summary = analysis(page)
        .locator("summary")
        .filter({ hasText: `Trace ${symbol}` });
      await expect(summary.locator("..")).not.toHaveAttribute("open", "");
      await summary.focus();
      await summary.press("Enter");
      await expect(
        analysis(page)
          .getByRole("region", { name: `Bảng trace ${symbol}` })
          .getByRole("table"),
      ).toBeVisible();
    }
    expect(http.calls).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath("http-result.png"),
      fullPage: true,
      animations: "disabled",
    });
    await button(page, "random").click();
    await expect(field(page, "Số mũ riêng X_A")).toHaveValue("15");
    await expect(field(page, "Số mũ riêng X_B")).toHaveValue("6");
    await expect(result(page)).toHaveCount(0);
    await expect(analysis(page)).toHaveCount(0);
    expect(http.calls).toHaveLength(2);
    expect(new URL(http.calls[1].url()).pathname).toBe("/api/dh/exchange");
    expect(http.calls[1].postDataJSON()).toEqual({ q: "23", alpha: "5" });
    await expectIdle(page);
  });

  test(`DH HTTP: validation, errors and retry in ${theme}`, async ({ page }) => {
    const http = await openApp(page, theme);
    await example(page);
    await field(page, "Số mũ riêng X_A").fill("x");
    await button(page, "exchange").click();
    await expect(page.getByRole("alert")).toContainText("chuỗi số nguyên");
    expect(http.calls).toHaveLength(0);
    for (const task of ["exchange", "random"] as const)
      for (const reply of ["business", "network", "malformed", "invalid"] as const) {
        await example(page);
        http.replies.push(reply);
        await button(page, task).click();
        const alert = page.getByRole("alert");
        await expect(alert).toHaveText(
          reply === "business"
            ? "Lỗi Backend <b>chỉ là text</b>."
            : reply === "network"
              ? "Không thể kết nối máy chủ. Vui lòng thử lại."
              : "Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.",
        );
        await expect(alert.locator("b")).toHaveCount(0);
        await expect(result(page)).toHaveCount(0);
        await expect(analysis(page)).toHaveCount(0);
        if (reply === "business") {
          await expect(field(page, "Căn nguyên thủy α")).toHaveAttribute("aria-invalid", "true");
          await expect(field(page, "Căn nguyên thủy α")).toBeFocused();
          await expect(field(page, "Căn nguyên thủy α")).toHaveAccessibleDescription(/Lỗi Backend/);
        }
        await expectIdle(page);
        await button(page, task).click();
        await expect(page.getByRole("status", { name: "Trạng thái trao đổi DH" })).toContainText(
          task === "exchange" ? "Hai bên đã thiết lập" : "Đã điền hai số mũ riêng",
        );
        await expect(alert).toHaveCount(0);
      }
    expect(http.calls).toHaveLength(16);
  });

  for (const task of ["exchange", "random"] as const) {
    test(`DH HTTP ${task}: cancellation and retry in ${theme}`, async ({ page }) => {
      const http = await openApp(page, theme);
      for (const action of ["edit", "reset", "cipher", "header", "example"] as const) {
        await example(page);
        http.replies.push("hold");
        await button(page, task).click();
        await expect.poll(() => http.pending.length).toBe(1);
        const old = http.pending.shift()!;
        await expect(form(page)).toHaveAttribute("aria-busy", "true");
        if (action === "edit") await field(page, "Số mũ riêng X_A").fill("9");
        if (action === "reset")
          await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
        if (action === "cipher") await page.getByRole("tab", { name: /Caesar/ }).click();
        if (action === "header")
          await page.getByRole("button", { name: "Làm mới", exact: true }).click();
        if (action === "example") await example(page);
        await expect.poll(() => http.failed.includes(old.request())).toBe(true);
        expect(old.request().failure()?.errorText).toContain("ERR_ABORTED");
        if (action === "cipher" || action === "header")
          await page.getByRole("tab", { name: /Diffie–Hellman/ }).click();
        await expectIdle(page);
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(field(page, "Số mũ riêng X_A")).toHaveValue(
          action === "edit" ? "9" : action === "reset" || action === "header" ? "" : "6",
        );
        await example(page);
        http.replies.push("hold");
        await button(page, task).click();
        await expect.poll(() => http.pending.length).toBe(1);
        const next = http.pending.shift()!;
        await releaseCancelled(old, task);
        await expect(form(page)).toHaveAttribute("aria-busy", "true");
        await expect(button(page, task === "exchange" ? "random" : "exchange")).toBeDisabled();
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(result(page)).toHaveCount(0);
        await next.fulfill({ json: task === "exchange" ? exchangeBody() : randomBody() });
        await expect(page.getByRole("status", { name: "Trạng thái trao đổi DH" })).toContainText(
          task === "exchange" ? "Hai bên đã thiết lập" : "Đã điền hai số mũ riêng",
        );
        await expectIdle(page);
      }
      expect(http.calls).toHaveLength(10);
    });
  }

  test(`DH HTTP: 15 second timeout and retry in ${theme}`, async ({ page }) => {
    const http = await openApp(page, theme);
    const now = Date.now();
    await page.clock.install({ time: new Date(now) });
    // Freeze ahead of installation so IPC delay cannot put pauseAt in the past.
    await page.clock.pauseAt(new Date(now + 60_000));
    for (const task of ["exchange", "random"] as const) {
      await example(page);
      http.replies.push("hold");
      await button(page, task).click();
      await expect.poll(() => http.pending.length).toBe(1);
      const old = http.pending.shift()!;
      await page.clock.fastForward(14999);
      await expect(form(page)).toHaveAttribute("aria-busy", "true");
      await page.clock.fastForward(1);
      await expect(page.getByRole("alert")).toHaveText(
        "Yêu cầu quá thời gian chờ. Vui lòng thử lại.",
      );
      await expect.poll(() => http.failed.includes(old.request())).toBe(true);
      expect(old.request().failure()?.errorText).toContain("ERR_ABORTED");
      await expectIdle(page);
      await button(page, task).click();
      await expect(page.getByRole("status", { name: "Trạng thái trao đổi DH" })).toContainText(
        task === "exchange" ? "Hai bên đã thiết lập" : "Đã điền hai số mũ riêng",
      );
      await releaseCancelled(old, task);
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    expect(http.calls).toHaveLength(4);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`DH HTTP: linked steps and standard Caesar text/file in ${theme}`, async ({
    page,
  }, testInfo) => {
    const calls: Request[] = [];
    const wire = exchangeBody();
    let keypairCount = 0;
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/health")
        return route.fulfill({
          json: { success: true, result: { database: "ok", history: "disabled" } },
        });
      calls.push(request);
      if (path === "/api/dh/keypair") {
        const side = keypairCount++ === 0 ? "A" : "B";
        return route.fulfill({
          json: {
            success: true,
            privateKey: wire[`privateKey${side}`],
            publicKey: wire[`publicKey${side}`],
            steps: wire.steps[`publicKey${side}`],
          },
        });
      }
      const replies: Record<string, object> = {
        "/api/dh/params": {
          success: true,
          q: "23",
          alpha: null,
          factors: ["2", "11"],
          primitiveRootChecks: [],
          suggestedAlpha: "5",
        },
        "/api/dh/params/random": {
          success: true,
          q: "32843",
          p: "16421",
          alpha: "2",
          factors: ["2", "16421"],
          primitiveRootChecks: [
            { factor: "2", exponent: "16421", result: "32842", passes: true },
            { factor: "16421", exponent: "2", result: "4", passes: true },
          ],
          suggestedAlpha: null,
        },
        "/api/dh/shared-secret": { success: true, sharedKey: "2", steps: wire.steps.sharedKeyA },
        "/api/dh/exchange": wire,
        "/api/dh/caesar": { success: true, sharedKey: "2", shift: "2", result: "Jgnnq Yqtnf" },
      };
      expect(Object.keys(replies)).toContain(path);
      await route.fulfill({ json: replies[path] });
    });
    await page.addInitScript(
      (value) => localStorage.setItem("cipher-workbench-theme", value),
      theme,
    );
    await page.goto("/e2e/fixtures/diffie-hellman/http-app.html");
    await page.getByRole("tab", { name: /Diffie–Hellman/ }).click();
    const panel = page.getByRole("region", {
      name: "Thực hành Diffie–Hellman từng bước",
      exact: true,
    });
    const caesar = page.getByRole("region", { name: "Caesar bằng khóa chung", exact: true });
    const output = caesar.getByRole("region", {
      name: "Kết quả Caesar bằng khóa chung",
      exact: true,
    });
    const form = page.getByRole("form", { name: "Thiết lập Diffie–Hellman", exact: true });
    const q = form.getByRole("textbox", { name: "Số nguyên tố q", exact: true });
    const alpha = form.getByRole("textbox", { name: "Căn nguyên thủy α", exact: true });
    const selectSide = (side: "A" | "B") =>
      panel
        .getByRole("group", { name: "Bên thực hành DH" })
        .getByRole("button", { name: `Bên ${side}`, exact: true })
        .click();
    await expect(panel).toBeVisible();
    await expect(caesar).toBeVisible();
    expect(calls).toHaveLength(0);
    await q.fill("23");
    await panel.getByRole("button", { name: "Kiểm tra q và α", exact: true }).click();
    await expect(panel.getByText("Gợi ý α: 5")).toBeVisible();
    expect(calls.at(-1)!.postDataJSON()).toEqual({ q: "23" });
    await expect(alpha).toHaveValue("");
    await panel.getByRole("button", { name: "Dùng α gợi ý", exact: true }).click();
    await expect(alpha).toHaveValue("5");
    await panel.getByRole("button", { name: "Tạo cặp khóa bên A", exact: true }).click();
    await expect(form.getByRole("textbox", { name: "Số mũ riêng X_A", exact: true })).toHaveValue(
      "6",
    );
    expect(calls.at(-1)!.postDataJSON()).toEqual({ q: "23", alpha: "5" });
    await selectSide("B");
    await panel.getByRole("button", { name: "Tạo cặp khóa bên B", exact: true }).click();
    await expect(form.getByRole("textbox", { name: "Số mũ riêng X_B", exact: true })).toHaveValue(
      "15",
    );
    await expect(panel.getByText("Khóa công khai Y_A")).toBeVisible();
    await selectSide("A");
    await panel.getByRole("button", { name: "Tính khóa chung bên A", exact: true }).click();
    await expect(panel.getByText("K_A = 19^6 mod 23 = 2")).toBeVisible();
    expect(calls.at(-1)!.postDataJSON()).toEqual({
      q: "23",
      privateKey: "6",
      otherPublicKey: "19",
    });
    await panel.screenshot({ path: testInfo.outputPath("practice.png"), animations: "disabled" });
    await caesar.getByRole("button", { name: "Tạo ví dụ văn bản", exact: true }).click();
    const run = caesar.getByRole("button", { name: "Mã hóa bằng khóa chung", exact: true });
    await expect(run).toBeDisabled();
    await form.getByRole("button", { name: "Thiết lập bí mật chung", exact: true }).click();
    await expect(page.getByRole("status", { name: "Trạng thái trao đổi DH" })).toContainText(
      "Hai bên đã thiết lập",
    );
    await run.click();
    await expect(output.getByRole("tabpanel", { name: "Văn bản" })).toHaveText("Jgnnq Yqtnf");
    expect(calls.at(-1)!.postDataJSON()).toEqual({
      q: "23",
      privateKey: "6",
      otherPublicKey: "19",
      action: "encrypt",
      data: "Hello World",
    });
    await output.getByRole("tab", { name: "Phân tích", exact: true }).click();
    await expect(output.getByText("2 mod 26 = 2")).toBeVisible();
    await caesar.screenshot({
      path: testInfo.outputPath("caesar-analysis.png"),
      animations: "disabled",
    });
    await output.getByRole("tab", { name: "Phân tích", exact: true }).press("Home");
    await expect(output.getByRole("tab", { name: "Văn bản", exact: true })).toBeFocused();
    const downloadPromise = page.waitForEvent("download");
    await output.getByRole("button", { name: "Tải kết quả", exact: true }).click();
    expect((await downloadPromise).suggestedFilename()).toBe("dh-caesar.encrypted.txt");
    await caesar.getByRole("button", { name: "File .txt", exact: true }).click();
    await caesar.getByLabel("Chọn file Caesar DH").setInputFiles({
      name: "hello.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Hello World"),
    });
    await expect(caesar.getByLabel("Xem trước nội dung file")).toHaveText("Hello World");
    await run.click();
    await expect(output.getByRole("tabpanel", { name: "Văn bản" })).toHaveText("Jgnnq Yqtnf");
    const upload = calls.at(-1)!;
    expect(upload.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
    for (const part of ["file", "q", "privateKey", "otherPublicKey", "action"])
      expect(upload.postData()).toContain(`name="${part}"`);
    expect(upload.postData()).not.toContain('name="response_mode"');
    await selectSide("B");
    await expect(output.getByRole("tabpanel", { name: "Văn bản" })).toContainText(
      "Kết quả sẽ hiển thị",
    );
    await expect(caesar.getByText("hello.txt", { exact: true })).toBeVisible();
    await panel.getByRole("combobox", { name: "Độ dài nhóm", exact: true }).selectOption("16");
    await panel.getByRole("button", { name: "Sinh nhóm tham số", exact: true }).click();
    await expect(q).toHaveValue("32843");
    await expect(alpha).toHaveValue("2");
    await expect(form.getByRole("textbox", { name: "Số mũ riêng X_A", exact: true })).toHaveValue(
      "",
    );
    await expect(run).toBeDisabled();
    expect(calls.at(-1)!.postDataJSON()).toEqual({ bits: 16 });
    expect(calls).toHaveLength(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
