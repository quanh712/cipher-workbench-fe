import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "des.mock.spec.ts",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4176" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "375px", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
    { name: "disabled", use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4177" } },
  ],
  webServer: [
    {
      command: "VITE_ENABLE_DES_DEMO=true npm run dev -- --host 127.0.0.1 --port 4176",
      url: "http://127.0.0.1:4176",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "VITE_ENABLE_DES_DEMO=false npm run dev -- --host 127.0.0.1 --port 4177",
      url: "http://127.0.0.1:4177",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
