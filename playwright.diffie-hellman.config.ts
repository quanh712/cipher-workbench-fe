import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.DH_E2E_PORT ?? 4180);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "diffie-hellman-*.spec.ts",
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "375px", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: `VITE_ENABLE_DIFFIE_HELLMAN=true npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/e2e/fixtures/diffie-hellman/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
