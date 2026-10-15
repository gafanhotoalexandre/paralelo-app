import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("real worker, precision, formatting, styled controls, drawers and static download", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("total-count")).toHaveText("05");
  await page
    .getByTestId("code-before")
    .fill('{"number":9007199254740992,"a":null}');
  await page
    .getByTestId("code-after")
    .fill('{"number":9007199254740993,"a":"🧪"}');
  await page.getByRole("radio", { name: "Conteúdo", exact: true }).click();
  await page.getByRole("button", { name: /^Comparar/ }).click();
  await expect(page.getByTestId("total-count")).toHaveText("02");
  const type = page.getByRole("combobox", { name: "Tipo de alteração" });
  await type.click();
  await page
    .getByRole("option", { name: "Valor alterado", exact: true })
    .click();
  await expect(page.getByTestId("diff-list").getByRole("button")).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "/number — Valor alterado" }).click();
  await page
    .getByRole("button", { name: "Localizar no atualizado", exact: true })
    .click();
  await expect(page.getByTestId("code-after")).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("9007199254740993");
  await page
    .getByRole("button", { name: "Formatar JSON atualizado", exact: true })
    .click();
  await expect(page.getByTestId("code-after")).toContainText(
    "9007199254740993",
  );
  await expect(
    page.getByRole("button", { name: "Exportar relatório Markdown" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /^Comparar/ }).click();
  await expect(
    page.getByRole("button", { name: "Exportar relatório Markdown" }),
  ).toBeEnabled();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar relatório Markdown" })
    .click();
  const download = await pending,
    content = await readFile((await download.path())!, "utf8");
  expect(content).toContain("9007199254740993");
  expect(content).toContain("/a");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("tab", { name: /^Diferenças/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Como arrays são comparados" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Comparação de arrays" }),
  ).toContainText("pela posição");
  await page.keyboard.press("Escape");
});
