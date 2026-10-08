import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "rsa.spec.ts",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4178" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "375px", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "VITE_ENABLE_RSA=true npm run dev -- --host 127.0.0.1 --port 4178",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
