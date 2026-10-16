import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("total-count")).toHaveText("05");
}

test("repeated valid comparisons and the same example preserve the inspector and editors without UI mutations", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("radio", { name: "Conteúdo", exact: true }).click();
  await page.getByRole("button", { name: "Exemplos", exact: true }).click();
  await page.getByRole("button", { name: /Configuração de serviço/ }).click();
  await expect(page.getByTestId("total-count")).toHaveText("32");
  await page.getByRole("radio", { name: "Informativas", exact: true }).click();
  await page
    .getByRole("button", { name: "Próxima página", exact: true })
    .click();
  const row = page.getByTestId("diff-list").getByRole("button").first();
  const rowName = await row.getAttribute("aria-label");
  await row.click();
  await page.keyboard.press("Escape");
  const original = await page.getByTestId("code-before").elementHandle();
  const selected = await page.locator(".diff-row.selected").elementHandle();
  const footer = await page
    .getByTestId("editor-before")
    .locator("footer")
    .textContent();
  await page.evaluate(() => {
    const changes: string[] = [];
    (window as unknown as { uxChanges: string[] }).uxChanges = changes;
    for (const selector of [
      ".work-heading",
      ".command",
      ".inspector",
      ".editor-footer",
      ".operation-feedback",
      ".cm-content",
    ]) {
      for (const node of document.querySelectorAll(selector))
        new MutationObserver((records) => {
          for (const record of records)
            changes.push(selector + ":" + record.type);
        }).observe(node, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: [
            "disabled",
            "contenteditable",
            "aria-readonly",
            "data-state",
          ],
        });
    }
  });
  for (let i = 0; i < 8; i++)
    await page.getByRole("button", { name: /^Comparar/ }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { uxChanges: string[] }).uxChanges,
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Exemplos", exact: true }).click();
  await page.getByRole("button", { name: /Configuração de serviço/ }).click();
  await expect(
    page.getByRole("radio", { name: "Informativas", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".diff-row.selected")).toHaveAttribute(
    "aria-label",
    rowName!,
  );
  await expect(page.getByTestId("editor-before").locator("footer")).toHaveText(
    footer!,
  );
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  expect(await selected!.evaluate((node) => node.isConnected)).toBe(true);
  expect(
    (
      await page.evaluate(
        () => (window as unknown as { uxChanges: string[] }).uxChanges,
      )
    ).filter((x) => x.includes(".cm-content") || x.includes(".inspector")),
  ).toEqual([]);
  await expect(page.locator(".notification")).not.toHaveAttribute(
    "data-visible",
    "true",
  );
});

test("quick example comparisons retain layout and control opacity without processing flashes", async ({
  page,
  context,
}) => {
  await context.route("**/assets/comparison.worker-*.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        "const originalPost=self.postMessage.bind(self); self.postMessage=(message)=>setTimeout(()=>originalPost(message),40);\n" +
        (await response.text()),
    });
  });
  await ready(page);
  const nodes = await page.locator(".cm-editor").elementHandles();
  await page.evaluate(() => {
    const observations: {
      processing: boolean;
      opacity: string;
      top: number;
    }[] = [];
    (window as unknown as { uxFrames: typeof observations }).uxFrames =
      observations;
    const sample = () => {
      const app = document.querySelector(".app")!,
        button = document.querySelector(".command-right .button-primary")!,
        bench = document.querySelector(".bench")!;
      observations.push({
        processing: app.getAttribute("data-processing") === "true",
        opacity: getComputedStyle(button).opacity,
        top: bench.getBoundingClientRect().top,
      });
    };
    new MutationObserver(sample).observe(document.querySelector(".app")!, {
      attributes: true,
      subtree: true,
      attributeFilter: ["disabled", "data-processing"],
    });
  });
  for (const [name, count] of [
    ["Evento de webhook", "05"],
    ["Configuração de serviço", "03"],
    ["Cadastro de cliente", "05"],
    ["Cadastro de cliente", "05"],
  ] as const) {
    await page.getByRole("button", { name: "Exemplos", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByTestId("total-count")).toHaveText(count);
    await expect(page.getByRole("button", { name: /^Comparar/ })).toBeEnabled();
  }
  const frames = await page.evaluate(
    () =>
      (
        window as unknown as {
          uxFrames: { processing: boolean; opacity: string; top: number }[];
        }
      ).uxFrames,
  );
  expect(frames.length).toBeGreaterThan(0);
  expect(
    frames.every((frame) => !frame.processing && frame.opacity === "1"),
  ).toBe(true);
  expect(new Set(frames.map((frame) => frame.top)).size).toBe(1);
  for (const node of nodes)
    expect(await node.evaluate((element) => element.isConnected)).toBe(true);
});

test("array information has a single popover with mouse, Enter, Space, Escape and outside dismissal", async ({
  page,
}) => {
  await ready(page);
  const trigger = page.getByRole("button", {
    name: "Como arrays são comparados",
  });
  await trigger.hover();
  await page.waitForTimeout(450);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  for (const key of ["Enter", "Space"]) {
    await trigger.focus();
    await page.keyboard.press(key);
    await expect(
      page.getByRole("dialog", { name: "Comparação de arrays" }),
    ).toContainText("pela posição");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  await trigger.click();
  await page
    .getByRole("heading", { name: "Comparar JSONs", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Comparação de arrays" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "Comparação de arrays" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/paralelo-array-popover.png",
  });
  const touchContext = await page
    .context()
    .browser()!
    .newContext({
      viewport: { width: 360, height: 800 },
      hasTouch: true,
      isMobile: true,
    });
  try {
    const touchPage = await touchContext.newPage();
    await touchPage.goto("http://127.0.0.1:4184/");
    const touchTrigger = touchPage.getByRole("button", {
      name: "Como arrays são comparados",
    });
    await expect(touchTrigger).toBeEnabled();
    await touchTrigger.tap();
    await expect(
      touchPage.getByRole("dialog", { name: "Comparação de arrays" }),
    ).toBeVisible();
    await touchPage
      .getByRole("heading", { name: "Comparar JSONs", exact: true })
      .tap();
    await expect(
      touchPage.getByRole("dialog", { name: "Comparação de arrays" }),
    ).toHaveCount(0);
  } finally {
    await touchContext.close();
  }
});

test("tooltip arrows stay outside text for export and editor actions at desktop and mobile widths", async ({
  page,
}) => {
  await ready(page);
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 360)
      await page.getByRole("tab", { name: /Diferenças/ }).click();
    const exportButton = page.getByRole("button", {
      name: "Exportar relatório Markdown",
    });
    await exportButton.hover();
    const tooltip = page.locator('[data-slot="tooltip-content"]');
    await expect(tooltip).toBeVisible();
    const geometry = await tooltip.evaluate((element) => {
      const content = element.getBoundingClientRect(),
        arrow = element
          .querySelector('[data-slot="tooltip-arrow"]')!
          .getBoundingClientRect();
      return {
        side: element.getAttribute("data-side"),
        content: { top: content.top, bottom: content.bottom },
        arrow: { top: arrow.top, bottom: arrow.bottom },
      };
    });
    if (geometry.side === "top")
      expect(geometry.arrow.top).toBeGreaterThanOrEqual(
        geometry.content.bottom - 0.5,
      );
    else
      expect(geometry.arrow.bottom).toBeLessThanOrEqual(
        geometry.content.top + 0.5,
      );
    if (width === 1440)
      await page.screenshot({
        path: "docs/screenshots/paralelo-export-tooltip.png",
      });
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const format = page.getByRole("button", {
    name: "Formatar JSON original",
    exact: true,
  });
  await format.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "Formatar JSON original",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});
