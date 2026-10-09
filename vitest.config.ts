import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Local dev flags must not change the baseline assumed by unit tests.
    // Feature registration tests opt in explicitly with vi.stubEnv.
    env: {
      VITE_ENABLE_HILL: "false",
      VITE_ENABLE_DES: "false",
      VITE_ENABLE_DES_DEMO: "false",
      VITE_ENABLE_RSA: "false",
      VITE_ENABLE_DIFFIE_HELLMAN: "false",
    },
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
