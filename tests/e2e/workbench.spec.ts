import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const shots = "docs/screenshots";
test("responsive workbench at every boundary, without global horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync(shots, { recursive: true });
  await page.goto("/");
  await expect(page.getByTestId("total-count")).toHaveText("05");
  for (const width of [1440, 1021, 1020, 768, 721, 720, 360]) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const before = page.getByTestId("editor-before");
    const after = page.getByTestId("editor-after");
    await expect(before).toBeVisible();
    if (width >= 721) await expect(after).toBeVisible();
    else await expect(after).toBeHidden();
    if (width >= 1021)
      await expect(
        page.getByRole("tabpanel", { name: "Diferenças", exact: true }),
      ).toBeVisible();
    else {
      await expect(
        page.getByRole("tabpanel", { name: "Diferenças", exact: true }),
      ).toBeHidden();
      await page.getByRole("tab", { name: /^Diferenças/ }).click();
      await expect(before).toBeHidden();
      await expect(
        page.getByRole("tabpanel", { name: "Diferenças", exact: true }),
      ).toBeVisible();
      const bench = await page.getByRole("main").boundingBox();
      const inspector = await page
        .getByRole("tabpanel", { name: "Diferenças", exact: true })
        .boundingBox();
      expect(Math.abs(bench!.y - inspector!.y)).toBeLessThan(2);
      if (width === 360)
        await page.screenshot({ path: `${shots}/paralelo-mobile-results.png` });
      await page
        .getByRole("tab", {
          name: width <= 720 ? "Original" : "Documentos",
          exact: true,
        })
        .click();
    }
    if ([1440, 768, 360].includes(width))
      await page.screenshot({ path: `${shots}/paralelo-${width}.png` });
  }
  expect(errors).toEqual([]);
});

test("drawers touch both edges, contain focus, close with Escape and locate the entire value", async ({
  page,
}) => {
  await page.goto("/");
  const examples = page.getByRole("button", { name: "Exemplos", exact: true });
  await examples.click();
  const left = page.getByRole("dialog");
  await expect(left).toBeVisible();
  await expect
    .poll(async () => Math.abs((await left.boundingBox())!.x))
    .toBeLessThan(1);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await left.evaluate((e) => e.contains(document.activeElement))).toBe(
      true,
    );
  }
  await page.keyboard.press("Escape");
  await expect(left).toBeHidden();
  await expect(examples).toBeFocused();
  await page
    .getByRole("button", { name: "/documento — Propriedade adicionada" })
    .click();
  const right = page.getByRole("dialog");
  await expect
    .poll(async () => {
      const box = (await right.boundingBox())!;
      return Math.abs(box.x + box.width - 1440);
    })
    .toBeLessThan(1);
  await expect(
    right.getByRole("button", { name: "Localizar no original" }),
  ).toBeDisabled();
  await page.screenshot({ path: `${shots}/paralelo-details.png` });
  await right.getByRole("button", { name: "Localizar no atualizado" }).click();
  await expect(right).toBeHidden();
  await expect(page.getByTestId("code-after")).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toContain('"tipo": "CPF"');
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString().trim()))
    .toMatch(/^\{[\s\S]*\}$/);
});

test("classification and kind intersect; navigation crosses the 25-item page boundary", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Potenciais", exact: true }).click();
  await page.getByRole("combobox", { name: "Tipo de alteração" }).click();
  await page
    .getByRole("option", { name: "Transição envolvendo null", exact: true })
    .click();
  await expect(page.getByTestId("diff-list").getByRole("button")).toHaveCount(
    1,
  );
  await expect(page.getByTestId("diff-list")).toContainText("/telefone");
  await page.getByRole("radio", { name: "Informativas", exact: true }).click();
  await expect(page.getByTestId("diff-list")).toContainText("/apelido");
  await page.getByRole("combobox", { name: "Tipo de alteração" }).click();
  await page
    .getByRole("option", { name: "Propriedade removida", exact: true })
    .click();
  await expect(page.getByText("Nenhuma diferença neste filtro")).toBeVisible();
  await page.getByRole("radio", { name: "Conteúdo", exact: true }).click();
  await page.getByRole("button", { name: "Exemplos", exact: true }).click();
  await page.getByRole("button", { name: /Configuração de serviço/ }).click();
  await expect(page.getByTestId("total-count")).toHaveText("32");
  await expect(page.getByTestId("diff-list").getByRole("button")).toHaveCount(
    25,
  );
  await page.getByTestId("diff-list").getByRole("button").last().click();
  await page
    .getByRole("button", { name: "Próxima diferença", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("/recursos/recurso_23");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("diff-list").getByRole("button")).toHaveCount(
    7,
  );
  await expect(page.getByText("26–32 de 32")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "/recursos/recurso_23 — Valor alterado",
      exact: true,
    }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Página anterior", exact: true })
    .click();
  await expect(page.getByTestId("diff-list").getByRole("button")).toHaveCount(
    25,
  );
});

test("editor instances, selection, undo and text survive tabs, resize and expansion", async ({
  page,
}) => {
  await page.goto("/");
  const node = await page.getByTestId("code-before").elementHandle();
  const original = page.getByTestId("code-before");
  await original.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("{");
  await page.setViewportSize({ width: 768, height: 900 });
  await page.getByRole("tab", { name: /^Diferenças/ }).click();
  await page.getByRole("tab", { name: "Documentos", exact: true }).click();
  await original.focus();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("{");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("tab", { name: "Atualizado", exact: true }).click();
  await page.getByRole("tab", { name: "Original", exact: true }).click();
  expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
  await original.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("DEMO_EDIT");
  await expect(
    page
      .locator(".work-heading")
      .getByText("Resultado desatualizado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ampliar editor original" }).click();
  await expect(
    page.getByRole("button", { name: "Restaurar editor original" }),
  ).toBeVisible();
  await original.focus();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /^Comparar/ }).click();
  await expect(
    page.getByText("Comparação concluída.", { exact: true }),
  ).toBeVisible();
  expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
  await original.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("X");
  await page.getByRole("button", { name: "/ativo — Tipo alterado" }).click();
  await expect(
    page.getByRole("button", { name: "Localizar no original" }),
  ).toBeDisabled();
});

test("near-1 MiB Unicode import remains editable; oversized and invalid UTF-8 files preserve it", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:5184",
  });
  const input = page.getByTestId("editor-before").locator("input[type=file]");
  const unicode = '"' + "🧪".repeat(260000) + '"';
  await input.setInputFiles({
    name: "unicode.json",
    mimeType: "application/json",
    buffer: Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(unicode),
    ]),
  });
  await expect(page.getByRole("status")).toContainText("Documento importado");
  await page.getByTestId("code-before").focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("X");
  await page.keyboard.press("Control+z");
  await page
    .getByRole("button", { name: "Copiar JSON original", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(unicode);
  await input.setInputFiles({
    name: "too-large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(1024 * 1024 + 1, 32),
  });
  await expect(
    page.getByTestId("editor-before").getByRole("alert"),
  ).toContainText("ultrapassa 1 MiB");
  await input.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from([0xff, 0xfe, 0xff]),
  });
  await expect(
    page.getByTestId("editor-before").getByRole("alert"),
  ).toContainText("como UTF-8");
  await expect(page.getByTestId("total-count")).toHaveText("05");
  await page
    .getByRole("button", { name: "Copiar JSON original", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(unicode);
  await page.getByTestId("code-before").focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe('"');
});

test("clipboard unavailable gives feedback; reduced motion and session isolation work", async ({
  browser,
}) => {
  const first = await browser.newContext({ reducedMotion: "reduce" });
  await first.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    }),
  );
  const page = await first.newPage();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Copiar JSON original", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "A cópia não está disponível",
  );
  await page
    .getByRole("button", { name: "Como funciona", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const duration = await page
    .getByRole("dialog")
    .evaluate((element) =>
      parseFloat(getComputedStyle(element).animationDuration),
    );
  expect(duration).toBeLessThanOrEqual(0.001);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Limpar documentos" }).click();
  const second = await browser.newContext();
  const independent = await second.newPage();
  await independent.goto("/");
  await expect(independent.getByTestId("total-count")).toHaveText("05");
  await expect(page.getByTestId("total-count")).toHaveText("00");
  expect(
    requests.every((url) => url.startsWith("http://127.0.0.1:5184/")),
  ).toBe(true);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  await first.close();
  await second.close();
});

test("scroll and keyboard navigation survive hidden panels; 200% zoom stays usable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Conteúdo", exact: true }).click();
  await page.getByRole("button", { name: "Exemplos", exact: true }).click();
  await page.getByRole("button", { name: /Configuração de serviço/ }).click();
  await page.setViewportSize({ width: 768, height: 900 });
  await page.getByTestId("code-before").focus();
  await page.keyboard.press("Control+End");
  const scroller = page.getByTestId("editor-before").locator(".cm-scroller");
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  const scrollTop = await scroller.evaluate((element) => element.scrollTop);
  await page.getByRole("tab", { name: /^Diferenças/ }).click();
  await page.getByRole("tab", { name: "Documentos", exact: true }).click();
  await expect
    .poll(() =>
      scroller.evaluate(
        (element, previous) => Math.abs(element.scrollTop - previous),
        scrollTop,
      ),
    )
    .toBeLessThan(2);
  await page.setViewportSize({ width: 360, height: 800 });
  await page
    .getByRole("tab", { name: "Original", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Atualizado", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("code-after").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("code-after")).not.toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Como funciona", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
});

test("array explanation works with hover, keyboard and touch; filter list and brand are consistent", async ({
  page,
}) => {
  await page.goto("/");
  const policy = page.getByRole("button", {
    name: "Como arrays são comparados",
  });
  await policy.hover();
  await expect(page.getByRole("tooltip")).toContainText("pela posição");
  await policy.click();
  await expect(
    page.getByRole("dialog", { name: "Comparação de arrays" }),
  ).toContainText("Reordenar");
  await page.keyboard.press("Escape");
  await expect(policy).toBeFocused();
  const select = page.getByRole("combobox", { name: "Tipo de alteração" });
  await select.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("option", { name: "Valor alterado", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(select).toContainText("Valor alterado");
  await select.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("option", { name: "Todos os tipos", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(select).toContainText("Todos os tipos");
  const logo = await page.locator(".brand img").getAttribute("src");
  expect(await page.locator("link[rel=icon]").getAttribute("href")).toBe(logo);
  await page.setViewportSize({ width: 360, height: 800 });
  await policy.click();
  await expect(
    page.getByRole("dialog", { name: "Comparação de arrays" }),
  ).toBeVisible();
});
