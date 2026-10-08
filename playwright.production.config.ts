import { defineConfig, devices } from "@playwright/test";

// Use an already-running production stack. Never build or start Backend services here.
const featureTests = ["hill.backend.spec.ts", "des.backend.spec.ts", "rsa.backend.spec.ts"];

export default defineConfig({
  testDir: "./e2e",
  reporter: "list",
  workers: 2,
  outputDir: "test-results/production",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:18081",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testMatch: ["backend-integration.spec.ts", "history.spec.ts", ...featureTests],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "375px",
      testMatch: featureTests,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
});
