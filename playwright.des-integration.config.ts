import { defineConfig, devices } from "@playwright/test";
import { createIntegrationWebServers } from "./playwright.web-servers";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const servers = createIntegrationWebServers(4178);
servers[1].command = `VITE_ENABLE_DES=true ${servers[1].command}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "des.backend.spec.ts",
  reporter: "list",
  use: { baseURL: externalBaseUrl ?? "http://127.0.0.1:4178", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "375px", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: externalBaseUrl ? undefined : servers,
});
