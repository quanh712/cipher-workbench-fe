import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "hill.mock.spec.ts",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4175" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "375px", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "VITE_ENABLE_HILL=true npm run dev -- --host 127.0.0.1 --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
