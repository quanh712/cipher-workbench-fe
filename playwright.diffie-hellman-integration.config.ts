import { defineConfig } from "@playwright/test";

// API-only acceptance: no Vite server, browser, route intercept or fake gateway.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "diffie-hellman.backend.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: "list",
  use: {
    baseURL: process.env.DH_BACKEND_URL ?? "http://127.0.0.1:18082",
    extraHTTPHeaders: { Accept: "application/json" },
    // Traces may contain private exponents/shared secrets.
    trace: "off",
  },
});
