import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "BACKEND_DEV_URL");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: process.env.BACKEND_DEV_URL || env.BACKEND_DEV_URL || "http://127.0.0.1:8000",
          changeOrigin: false,
        },
      },
    },
  };
});
