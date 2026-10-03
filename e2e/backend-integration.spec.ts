import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("keeps the input panel visually identical to Caesar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const settleStyles = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);

    let caesarAppearance: unknown;
    for (const algorithm of ["caesar", "vigenere", "playfair", "affine", "columnar"]) {
      await page.locator(`#algorithm-tab-${algorithm}`).click();
      await settleStyles();
      const appearance = await page
        .locator(".workspace__columns > :first-child")
        .evaluate((root) => {
          const panel = root.querySelector(".panel")!;
          const header = root.querySelector(".panel__header")!;
          const textarea = root.querySelector("textarea")!;
          const actions = [...header.querySelectorAll(".button")];
          const tabs = [...root.querySelectorAll(".segmented button")];
          const css = (element: Element, properties: string[]) =>
            properties.map((property) => getComputedStyle(element).getPropertyValue(property));

          return {
            textareaWrapper: textarea.parentElement?.className,
            panel: css(panel, ["background-color", "border", "border-radius"]),
            header: css(header, ["background-color", "border-bottom", "padding", "height"]),
            textarea: css(textarea, [
              "background-color",
              "color",
              "border",
              "padding",
              "height",
              "min-height",
            ]),
            placeholder: getComputedStyle(textarea, "::placeholder").color,
            buttons: actions.map((button) =>
              css(button, ["background-color", "color", "border", "padding"]),
            ),
            tabs: tabs.map((tab) => css(tab, ["background-color", "color", "border", "padding"])),
          };
        });

      await page.getByRole("textbox", { name: "Nội dung đầu vào" }).focus();
      const focusAppearance = await page
        .locator(".workspace__columns > :first-child textarea")
        .evaluate((textarea) => {
          const style = getComputedStyle(textarea);
          return [style.borderColor, style.outline, style.boxShadow];
        });

      const pasteButton = page.locator(".workspace__columns > :first-child .panel__header button", {
        hasText: "Dán",
      });
      await pasteButton.hover();
      await settleStyles();
      const hoverAppearance = await pasteButton.evaluate((button) => {
        const style = getComputedStyle(button);
        return [style.backgroundColor, style.color, style.borderColor];
      });

      await page.getByRole("button", { name: "File .txt" }).click();
      await settleStyles();
      const fileAppearance = await page
        .locator(".workspace__columns > :first-child")
        .evaluate((root) => {
          const picker = root.querySelector(".file-picker")!;
          const activeTab = root.querySelector(".segmented .is-active")!;
          const pickerStyle = getComputedStyle(picker);
          const tabStyle = getComputedStyle(activeTab);
          return {
            picker: [pickerStyle.backgroundColor, pickerStyle.border, pickerStyle.padding],
            tab: [tabStyle.backgroundColor, tabStyle.color, tabStyle.border],
          };
        });
      await page.getByRole("button", { name: "Văn bản", exact: true }).click();

      const fullAppearance = { appearance, focusAppearance, hoverAppearance, fileAppearance };

      if (algorithm === "caesar") caesarAppearance = fullAppearance;
      else expect(fullAppearance, `${theme}: ${algorithm} khác Caesar`).toEqual(caesarAppearance);
    }
  }
});

test("uses the real FastAPI text contract through the Vite proxy", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("button", { name: "Mã hóa" }).click();

  await expect(page.getByText("Khoor Zruog", { exact: true })).toBeVisible();
  await expect(page.getByText("Mã hóa thành công.", { exact: true })).toBeVisible();
});

test("uses the real Vigenère text contract", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Vigenère/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();

  const requestPromise = page.waitForRequest("**/api/vigenere/encrypt");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  const request = await requestPromise;

  expect(request.postDataJSON()).toEqual({ text: "Attack at dawn!", key: "LEMON" });
  await expect(page.getByText("Lxfopv ef rnhr!", { exact: true })).toBeVisible();
});

test("uses the real Vigenère decrypt contract", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Vigenère/ }).click();
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("Lxfopv ef rnhr!");
  await page.getByRole("textbox", { name: "Khóa Vigenère" }).fill("LEMON");

  const requestPromise = page.waitForRequest("**/api/vigenere/decrypt");
  await page.getByRole("button", { name: "Giải mã" }).click();
  expect((await requestPromise).postDataJSON()).toEqual({ text: "Lxfopv ef rnhr!", key: "LEMON" });
  await expect(page.getByText("Attack at dawn!", { exact: true })).toBeVisible();
});

test("uses the real Playfair text contract", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Playfair/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();

  const requestPromise = page.waitForRequest("**/api/playfair/encrypt");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await requestPromise).postDataJSON()).toEqual({
    text: "HIDE THE GOLD IN THE TREE STUMP",
    key: "PLAYFAIR EXAMPLE",
  });
  await expect(page.getByText("BMODZBXDNABEKUDMUIXMMOUVIF", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Phân tích" }).click();
  await expect(page.getByText("Key Matrix 5×5", { exact: true })).toBeVisible();
  await expect(page.getByText(/HI → BM/)).toBeVisible();
});

test("wraps long normalized Playfair input inside its analysis panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Playfair/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("HELLO WORLD ".repeat(80));
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
  await expect(page.locator(".cipher-output-panel .status--success")).toBeVisible();
  await page.getByRole("tab", { name: "Phân tích" }).click();

  await expect(page.locator(".playfair-analysis .stats-list dd").nth(1)).toContainText(
    "xem trước 80/800 ký tự",
  );

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page.evaluate(() => {
      const row = [...document.querySelectorAll(".playfair-analysis .stats-list > div")].find(
        (element) => element.querySelector("dt")?.textContent?.includes("Đầu vào chuẩn hóa"),
      )!;
      const value = row.querySelector<HTMLElement>("dd")!;
      const panel = document.querySelector<HTMLElement>(".playfair-analysis")!;
      return {
        valueRight: value.getBoundingClientRect().right,
        panelRight: panel.getBoundingClientRect().right,
        valueScrollWidth: value.scrollWidth,
        valueClientWidth: value.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
      };
    });
    expect(bounds.valueRight).toBeLessThanOrEqual(bounds.panelRight - 8);
    expect(bounds.valueScrollWidth).toBeLessThanOrEqual(bounds.valueClientWidth + 1);
    expect(bounds.pageWidth).toBeLessThanOrEqual(bounds.viewport);
  }
});

test("suggests only internal Playfair fillers after the Backend trims the terminal filler", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Playfair/ }).click();
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("BOFTFT");
  await page.getByRole("textbox", { name: "Khóa Playfair" }).fill("MATMA");
  await page.getByRole("button", { name: "Giải mã" }).click();

  await expect(page.locator("pre.output")).toHaveText("CNTXT");
  await page.getByRole("tab", { name: "Phân tích" }).click();
  await expect(page.locator(".playfair-filler-suggestion pre")).toHaveText("CNTT");
  await expect(page.locator(".playfair-filler-suggestion small")).toContainText(
    "Có thể bỏ 1 ký tự X/Q",
  );
  await expect(page.locator("pre.output")).toHaveText("CNTXT");
});

test("uses the Backend's terminal-filler rule for Playfair text and file decrypt", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Playfair/ }).click();
  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByRole("textbox", { name: "Khóa Playfair" }).fill("PLAYFAIR EXAMPLE");

  for (const [ciphertext, expected] of [
    ["PDGW", "ABX"],
    ["BMODZBXDNAGE", "HIDETHEGOLD"],
    ["GWGW", "XQX"],
  ]) {
    await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill(ciphertext);
    await page.getByRole("button", { name: "Giải mã" }).click();
    await expect(page.locator("pre.output")).toHaveText(expected);
  }

  await page.getByRole("button", { name: "File .txt" }).click();
  await page.getByLabel("Chọn file văn bản").setInputFiles({
    name: "secret.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("PDGW"),
  });
  const previewRequest = page.waitForRequest("**/api/playfair/file");
  await page.getByRole("button", { name: "Giải mã" }).click();
  expect((await previewRequest).method()).toBe("POST");
  await expect(page.locator("pre.output")).toHaveText("ABX");

  const downloadRequest = page.waitForRequest("**/api/playfair/file");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả" }).click();
  expect((await downloadRequest).method()).toBe("POST");
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("secret.decrypted.txt");
  expect(await readFile(await download.path(), "utf8")).toBe("ABX");
});

test("uses the real Affine text contract in both directions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Affine/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();

  const encryptRequest = page.waitForRequest("**/api/affine/encrypt");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await encryptRequest).postData()).toBe('{"text":"HELLO","a":5,"b":8}');
  await expect(page.locator("pre.output")).toHaveText("RCLLA");

  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("RCLLA");
  const decryptRequest = page.waitForRequest("**/api/affine/decrypt");
  await page.getByRole("button", { name: "Giải mã" }).click();
  expect((await decryptRequest).postData()).toBe('{"text":"RCLLA","a":5,"b":8}');
  await expect(page.locator("pre.output")).toHaveText("HELLO");
});

test("uses the real Columnar text contract and exactly round-trips Unicode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Hệ mã hàng/ }).click();
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("😀A𝄞é");
  await page.getByRole("textbox", { name: "Khóa cột" }).fill(" { 2 1 3 } ");

  const encryptRequest = page.waitForRequest("**/api/columnar/encrypt");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await encryptRequest).postDataJSON()).toEqual({ text: "😀A𝄞é", key: " { 2 1 3 } " });
  await expect(page.locator("pre.output")).toHaveText("A😀é𝄞");

  await page.getByRole("radio", { name: /Giải mã/ }).click();
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("A😀é𝄞");
  const decryptRequest = page.waitForRequest("**/api/columnar/decrypt");
  await page.getByRole("button", { name: "Giải mã" }).click();
  expect((await decryptRequest).postDataJSON()).toEqual({ text: "A😀é𝄞", key: " { 2 1 3 } " });
  await expect(page.locator("pre.output")).toHaveText("😀A𝄞é");
});

test("matches the canonical Columnar example on the real Backend", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Hệ mã hàng/ }).click();
  await page.getByRole("button", { name: "Tạo ví dụ" }).click();

  const requestPromise = page.waitForRequest("**/api/columnar/encrypt");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await requestPromise).postDataJSON()).toEqual({
    text: "khoacongnghethongtin",
    key: "3,6,2,1,5,4",
  });
  await expect(page.locator("pre.output")).toHaveText("agnonokntioetchghghn");
});

test("previews and downloads a Columnar BOM file using separate Backend requests", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Hệ mã hàng/ }).click();
  await page.getByRole("button", { name: "File .txt" }).click();
  await page.getByLabel("Chọn file văn bản").setInputFiles({
    name: "message.TXT",
    mimeType: "text/plain",
    buffer: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("ABCDE")]),
  });
  await page.getByRole("textbox", { name: "Khóa cột" }).fill("3 1 4 2");

  const previewRequest = page.waitForRequest("**/api/columnar/file");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await previewRequest).method()).toBe("POST");
  await expect(page.locator("pre.output")).toHaveText("BDAEC");

  const downloadRequest = page.waitForRequest("**/api/columnar/file");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả" }).click();
  expect((await downloadRequest).method()).toBe("POST");
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("message.encrypted.txt");
  expect(await readFile(await download.path())).toEqual(
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("BDAEC")]),
  );
});

test("keeps large Affine text keys as exact JSON integers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Affine/ }).click();
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("HELLO");
  await page.getByRole("textbox", { name: "Khóa nhân a" }).fill("9007199254740993");
  await page.getByRole("textbox", { name: "Khóa dịch b" }).fill("+0008");

  const requestPromise = page.waitForRequest("**/api/affine/encrypt");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await requestPromise).postData()).toBe('{"text":"HELLO","a":9007199254740993,"b":8}');
  await expect(page.locator("pre.output")).toHaveText("FKHHC");
});

test("previews and downloads an Affine file with the real Backend", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Affine/ }).click();
  await page.getByRole("button", { name: "File .txt" }).click();
  await page.getByLabel("Chọn file văn bản").setInputFiles({
    name: "message.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("HELLO"),
  });
  await page.getByRole("textbox", { name: "Khóa nhân a" }).fill(" +005 ");
  await page.getByRole("textbox", { name: "Khóa dịch b" }).fill(" 8 ");

  const previewRequest = page.waitForRequest("**/api/affine/file");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await previewRequest).method()).toBe("POST");
  await expect(page.locator("pre.output")).toHaveText("RCLLA");

  const downloadRequest = page.waitForRequest("**/api/affine/file");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả" }).click();
  expect((await downloadRequest).method()).toBe("POST");
  expect((await downloadEvent).suggestedFilename()).toBe("message.encrypted.txt");
});

test("previews and downloads a Playfair file with two server requests", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Playfair/ }).click();
  await page.getByRole("button", { name: "File .txt" }).click();
  await page.getByLabel("Chọn file văn bản").setInputFiles({
    name: "secret.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("HIDE THE GOLD IN THE TREE STUMP"),
  });
  await page.getByRole("textbox", { name: "Khóa Playfair" }).fill("PLAYFAIR EXAMPLE");

  const previewRequest = page.waitForRequest("**/api/playfair/file");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await previewRequest).method()).toBe("POST");
  await expect(page.getByText("BMODZBXDNABEKUDMUIXMMOUVIF", { exact: true })).toBeVisible();

  const downloadRequest = page.waitForRequest("**/api/playfair/file");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả" }).click();
  expect((await downloadRequest).method()).toBe("POST");
  expect((await downloadEvent).suggestedFilename()).toBe("secret.encrypted.txt");
});

test("previews and downloads a Vigenère file with two requests", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Vigenère/ }).click();
  await page.getByRole("button", { name: "File .txt" }).click();
  await page.getByLabel("Chọn file văn bản").setInputFiles({
    name: "attack.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Attack at dawn!"),
  });
  await page.getByRole("textbox", { name: "Khóa Vigenère" }).fill("LEMON");
  await expect(page.getByLabel("Xem trước nội dung file")).toHaveText("Attack at dawn!");

  const previewRequest = page.waitForRequest("**/api/vigenere/file");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  expect((await previewRequest).method()).toBe("POST");
  await expect(page.getByText("Lxfopv ef rnhr!", { exact: true })).toBeVisible();

  const downloadRequest = page.waitForRequest("**/api/vigenere/file");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả" }).click();
  expect((await downloadRequest).method()).toBe("POST");
  expect((await downloadEvent).suggestedFilename()).toBe("attack.encrypted.txt");
});

test("keeps a long Vigenère file result within the key panel and scrolls its text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("tab", { name: /Vigenère/ }).click();
  await page.getByRole("button", { name: "File .txt" }).click();
  await page.getByLabel("Chọn file văn bản").setInputFiles({
    name: "long.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("HELP WORLD. ".repeat(250)),
  });
  await page.getByRole("textbox", { name: "Khóa Vigenère" }).fill("LEMON");
  await page.getByRole("button", { name: "Mã hóa", exact: true }).click();

  const result = page.locator(".cipher-output-panel");
  await expect(result.locator(".status")).toContainText("Xử lý thành công");
  const bounds = await page.evaluate(() => {
    const output = document.querySelector<HTMLElement>(".cipher-output-panel .output")!;
    const resultPanel = document.querySelector<HTMLElement>(".cipher-output-panel > .panel")!;
    const keyPanel = document.querySelector<HTMLElement>(
      ".workspace__input-column .config-section .panel",
    )!;
    return {
      resultBottom: resultPanel.getBoundingClientRect().bottom,
      keyBottom: keyPanel.getBoundingClientRect().bottom,
      scrollHeight: output.scrollHeight,
      clientHeight: output.clientHeight,
    };
  });
  expect(Math.abs(bounds.resultBottom - bounds.keyBottom)).toBeLessThanOrEqual(2);
  expect(bounds.scrollHeight).toBeGreaterThan(bounds.clientHeight);
});

for (const algorithm of ["Caesar", "Affine"] as const) {
  test(`keeps a long ${algorithm} result beside its key and scrolls its text`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("tab", { name: new RegExp(algorithm) }).click();
    await page.getByRole("button", { name: "Tạo ví dụ" }).click();
    await page.getByRole("button", { name: "File .txt" }).click();
    await page.getByLabel("Chọn file văn bản").setInputFiles({
      name: "long.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("HELP WORLD. ".repeat(250)),
    });
    await page.getByRole("button", { name: "Mã hóa", exact: true }).click();
    const columns = page.locator(".workspace__columns--key-aligned");
    await expect(columns.locator(".cipher-output-panel .status")).toContainText("Xử lý thành công");
    const bounds = await columns.evaluate((element) => {
      const output = element.querySelector<HTMLElement>(".cipher-output-panel .output")!;
      const resultPanel = element.querySelector<HTMLElement>(".cipher-output-panel > .panel")!;
      const keyPanel = element.querySelector<HTMLElement>(
        ".workspace__input-column .config-section .panel",
      )!;
      return {
        resultBottom: resultPanel.getBoundingClientRect().bottom,
        keyBottom: keyPanel.getBoundingClientRect().bottom,
        scrollHeight: output.scrollHeight,
        clientHeight: output.clientHeight,
      };
    });
    expect(Math.abs(bounds.resultBottom - bounds.keyBottom)).toBeLessThanOrEqual(2);
    expect(bounds.scrollHeight).toBeGreaterThan(bounds.clientHeight);
  });
}

test("sends a large key as an exact JSON integer token", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Nội dung đầu vào" }).fill("A");
  await page.getByRole("textbox", { name: "Khóa Caesar" }).fill("9007199254740993");

  const requestPromise = page.waitForRequest("**/api/caesar/encrypt");
  await page.getByRole("button", { name: "Mã hóa" }).click();
  const request = await requestPromise;

  expect(request.postData()).toBe('{"text":"A","key":9007199254740993}');
  await expect(page.locator("pre.output")).toHaveText("H");
});

test("previews and downloads a file with two server requests", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "File .txt" }).click();
  await page.getByLabel("Chọn file văn bản").setInputFiles({
    name: "bao.cao.v2.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Hello World"),
  });
  await page.getByRole("textbox", { name: "Khóa Caesar" }).fill("3");
  await page.getByRole("button", { name: "Mã hóa" }).click();

  await expect(page.getByText("Khoor Zruog", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải kết quả" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("bao.cao.v2.encrypted.txt");
});

test("shows the canonical backend message for invalid UTF-8", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "File .txt" }).click();
  await page.getByLabel("Chọn file văn bản").setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from([0xff]),
  });
  await page.getByRole("textbox", { name: "Khóa Caesar" }).fill("3");
  await page.getByRole("button", { name: "Mã hóa" }).click();

  await expect(page.getByText("File phải sử dụng UTF-8.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải kết quả" })).toBeDisabled();
});
