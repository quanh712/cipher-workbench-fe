import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const backendUrl = process.env.BACKEND_DEV_URL ?? "http://127.0.0.1:18082";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "rsa.backend.spec.ts",
  reporter: "list",
  workers: 1,
  use: { baseURL: externalBaseUrl ?? "http://127.0.0.1:4179", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "375px", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "VITE_ENABLE_RSA=true npm run dev -- --host 127.0.0.1 --port 4179",
        env: { BACKEND_DEV_URL: backendUrl },
        url: "http://127.0.0.1:4179",
        reuseExistingServer: false,
        timeout: 30_000,
      },
});
