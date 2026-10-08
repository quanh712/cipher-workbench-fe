import { defineConfig, devices } from "@playwright/test";
import { createIntegrationWebServers } from "./playwright.web-servers";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: [
    "backend-integration.spec.ts",
    "hill.mock.spec.ts",
    "hill.backend.spec.ts",
    "des.mock.spec.ts",
    "des.backend.spec.ts",
    "rsa.spec.ts",
    "rsa.backend.spec.ts",
  ],
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: createIntegrationWebServers(4173),
});
