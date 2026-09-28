import { defineConfig, devices } from "@playwright/test";
import { createIntegrationWebServers } from "./playwright.web-servers";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["backend-integration.spec.ts", "history.spec.ts"],
  reporter: "list",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:4174",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl ? undefined : createIntegrationWebServers(4174),
});
