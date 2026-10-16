import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("total-count")).toHaveText("05");
}
async function put(page: Page, before: string, after: string) {
  await page.getByTestId("code-before").fill(before);
  await page.getByTestId("code-after").fill(after);
}
async function compare(page: Page) {
  await page.getByRole("button", { name: /^Comparar/ }).click();
  await expect(page.getByRole("button", { name: /^Comparar/ })).toBeEnabled();
}
const workerUrl = "**/assets/comparison.worker-*.js";
test("free comparison, directional null, exact numbers, formatting and complete Markdown download", async ({
  page,
}) => {
  await ready(page);
  await put(
    page,
    '{"id":9007199254740992,"nullable":null,"usable":"x"}',
    '{"id":9007199254740993,"nullable":"ok","usable":null}',
  );
  await page.getByRole("radio", { name: "Conteúdo", exact: true }).click();
  await compare(page);
  await expect(page.getByTestId("total-count")).toHaveText("03");
  await page
    .getByRole("button", { name: "/nullable — Mudança envolvendo null" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Informativa");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "/usable — Mudança envolvendo null" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Potencial incompatibilidade",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Formatar JSON atualizado", exact: true })
    .click();
  await expect(page.getByTestId("code-after")).toContainText(
    "9007199254740993",
  );
  await expect(
    page.getByRole("button", { name: "Exportar relatório Markdown" }),
  ).toBeDisabled();
  await compare(page);
  await page.getByRole("radio", { name: "Informativas", exact: true }).click();
  await expect(page.getByTestId("diff-list").getByRole("button")).toHaveCount(
    2,
  );
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar relatório Markdown" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("paralelo-relatorio.md");
  const text = await readFile((await download.path())!, "utf8");
  for (const content of [
    "9007199254740992",
    "9007199254740993",
    "/nullable",
    "/usable",
    "/id",
    "Potenciais incompatibilidades",
    "Conteúdo",
    "por índice",
  ])
    expect(text).toContain(content);
  await expect(page.getByTestId("total-count")).toHaveText("03");
});
test("malformed documents, duplicates, Unicode and equivalence have distinct actionable states", async ({
  page,
}) => {
  await ready(page);
  await put(page, '{"PRIVATE_NAME":', '{"a":1,"\\u0061":1}');
  await compare(page);
  await expect(
    page.getByTestId("editor-before").getByRole("alert"),
  ).toContainText("JSON inválido");
  await expect(
    page.getByTestId("editor-after").getByRole("alert"),
  ).toContainText("duplicadas");
  await expect(
    page.getByRole("button", { name: "Exportar relatório Markdown" }),
  ).toBeDisabled();
  await put(page, String.raw`"\ud800"`, "null");
  await compare(page);
  await expect(
    page.getByTestId("editor-before").getByRole("alert"),
  ).toContainText("Unicode");
  await put(
    page,
    "1e10000000000000000000000000000",
    "10e9999999999999999999999999999",
  );
  await page.getByRole("radio", { name: "Conteúdo", exact: true }).click();
  await compare(page);
  await expect(page.getByTestId("total-count")).toHaveText("00");
  await expect(page.getByTestId("diff-list")).toContainText(
    "Nenhuma diferença encontrada",
  );
  await expect(
    page.getByRole("button", { name: "Exportar relatório Markdown" }),
  ).toBeEnabled();
});
test("large formatted output fails without losing documents or a valid comparison", async ({
  page,
}) => {
  test.setTimeout(45000);
  await ready(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4184",
  });
  const source = JSON.stringify(Array(220000).fill(0));
  for (const side of ["before", "after"])
    await page
      .getByTestId(`editor-${side}`)
      .locator("input[type=file]")
      .setInputFiles({
        name: "large.json",
        mimeType: "application/json",
        buffer: Buffer.from(source),
      });
  await compare(page);
  await expect(page.getByTestId("total-count")).toHaveText("00");
  await page
    .getByRole("button", { name: "Formatar JSON original", exact: true })
    .click();
  await expect(
    page.getByTestId("editor-before").getByRole("alert"),
  ).toContainText("formatado ultrapassa 1 MiB");
  await expect(
    page.getByRole("button", { name: "Exportar relatório Markdown" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Copiar JSON original", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    source,
  );
});
test("busy worker remains isolated; cancellation and replacement recover normally", async ({
  page,
  context,
}) => {
  await context.route(workerUrl, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => { const end = performance.now() + 5000; while (performance.now() < end) {} };",
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
  await expect(page.getByTestId("code-before")).toHaveAttribute(
    "aria-readonly",
    "true",
  );
  await expect(page.getByRole("button", { name: /^Comparar/ })).toBeDisabled();
  const originalText = await page.getByTestId("code-before").innerText();
  await page.getByTestId("code-before").click();
  await page.keyboard.type("BLOCKED_INPUT");
  expect(await page.getByTestId("code-before").innerText()).toBe(originalText);
  // A frame can run on the UI thread while the worker is executing synchronous work.
  const frame = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        requestAnimationFrame(() => resolve(true));
      }),
  );
  expect(frame).toBe(true);
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("status")).toContainText("Operação cancelada");
  await context.unroute(workerUrl);
  await compare(page);
  await expect(page.getByTestId("total-count")).toHaveText("05");
});
test("timeout and worker failure give bounded feedback and allow another operation", async ({
  page,
  context,
}) => {
  await context.route(workerUrl, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => {};",
    }),
  );
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
  await page.clock.fastForward(10001);
  await expect(page.locator(".operation-feedback")).toContainText(
    "10 segundos",
  );
  await expect(page.getByRole("button", { name: /^Comparar/ })).toBeEnabled();
  await context.unroute(workerUrl);
  await context.route(workerUrl, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'self.onmessage = () => { throw new Error("PRIVATE_WORKER_CONTENT"); };',
    }),
  );
  await compare(page);
  await expect(page.locator(".operation-feedback")).toContainText(
    "Não foi possível concluir",
  );
  await expect(page.locator(".operation-feedback")).not.toContainText(
    "PRIVATE_WORKER_CONTENT",
  );
  await context.unroute(workerUrl);
  await compare(page);
  await expect(page.getByTestId("total-count")).toHaveText("05");
});
test("a near-limit Unicode line is compared and its complete value can be located", async ({
  page,
}) => {
  test.setTimeout(45000);
  await ready(page);
  const text = '"' + "🧪".repeat(260000) + '"';
  await page.getByTestId("code-before").fill("null");
  await page
    .getByTestId("editor-after")
    .locator("input[type=file]")
    .setInputFiles({
      name: "unicode.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
  await compare(page);
  await expect(page.getByTestId("total-count")).toHaveText("01");
  await page
    .getByRole("button", { name: "(raiz) — Mudança envolvendo null" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Prévia truncada");
  await page
    .getByRole("button", { name: "Localizar no atualizado", exact: true })
    .click();
  await expect(page.getByTestId("code-after")).toBeFocused();
  await expect(
    page.getByTestId("editor-after").locator(".cm-scroller"),
  ).toBeVisible();
});

test("locating a large multiline subtree reveals its beginning and keeps full selection", async ({
  page,
}) => {
  await ready(page);
  const text = JSON.stringify(
    { padding: Array(2500).fill(0), target: { items: Array(3000).fill(1) } },
    null,
    2,
  );
  await page.getByTestId("code-before").fill("{}");
  await page
    .getByTestId("editor-after")
    .locator("input[type=file]")
    .setInputFiles({
      name: "multiline.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
  await compare(page);
  await page
    .getByRole("button", { name: "/target — Propriedade adicionada" })
    .click();
  await page
    .getByRole("button", { name: "Localizar no atualizado", exact: true })
    .click();
  await expect(page.getByTestId("code-after")).toBeFocused();
  const firstMark = page
    .getByTestId("editor-after")
    .locator(".cm-located-value")
    .first();
  await expect
    .poll(() =>
      firstMark.evaluate((element) => {
        const rect = element.getBoundingClientRect(),
          scroll = element.closest(".cm-scroller")!.getBoundingClientRect();
        return rect.top >= scroll.top && rect.top < scroll.bottom;
      }),
    )
    .toBe(true);
  await expect(firstMark).toHaveText("{");
});
