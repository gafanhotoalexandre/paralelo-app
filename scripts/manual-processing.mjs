import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

const scenarios = {
  slow: `
    const until = performance.now() + 5000;
    while (performance.now() < until) {}
  `,
  timeout: "return;",
  failure: 'throw new Error("Falha controlada do teste manual");',
};

export async function installScenario(context, scenario) {
  if (!(scenario in scenarios)) {
    throw new Error("Use slow, timeout ou failure.");
  }
  // Only the first worker is intercepted. Its initial comparison runs normally;
  // the second request exercises the scenario. Replacement workers are real.
  await context.route(/\/assets\/comparison\.worker-[^/]+\.js(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      contentType: "text/javascript",
      body: `${source}\n;(() => {
        const original = self.onmessage;
        let requests = 0;
        self.onmessage = function(event) {
          if (++requests === 2) { ${scenarios[scenario]} }
          return original.call(self, event);
        };
      })();`,
    });
  }, { times: 1 });
}

async function main() {
  const scenario = process.argv[2] ?? "slow";
  if (!(scenario in scenarios)) throw new Error("Use slow, timeout ou failure.");
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await installScenario(context, scenario);
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4184/");
    await page.getByTestId("total-count").filter({ hasText: "05" }).waitFor();
    console.log(`Cenário: ${scenario}. Altere um JSON ou o modo e clique em Comparar.`);
    console.log("A primeira comparação automática é normal; a próxima operação usa a condição controlada.");
    console.log("Feche o navegador para encerrar. Reabra o comando para repetir o cenário.");
    await new Promise((resolve) => browser.once("disconnected", resolve));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
