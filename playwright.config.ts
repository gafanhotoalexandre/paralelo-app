import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5184",
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    launchOptions: { timeout: 20000 },
  },
  reporter: "list",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "firefox",
      testMatch: "**/cross-browser.spec.ts",
      use: { browserName: "firefox" },
    },
    {
      name: "webkit",
      testMatch: "**/cross-browser.spec.ts",
      use: { browserName: "webkit" },
    },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:5184",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
