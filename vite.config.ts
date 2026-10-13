import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["BACKEND_DEV_URL", "BACKEND_SIGNATURE_URL"]);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api/dh/history": {
          target:
            process.env.BACKEND_SIGNATURE_URL ||
            env.BACKEND_SIGNATURE_URL ||
            "http://127.0.0.1:8080",
          changeOrigin: false,
          rewrite: (path) => path.replace(/^\/api\/dh\/history/, "/api/history"),
        },
        "/api/rsa/history": {
          target:
            process.env.BACKEND_SIGNATURE_URL ||
            env.BACKEND_SIGNATURE_URL ||
            "http://127.0.0.1:8080",
          changeOrigin: false,
          rewrite: (path) => path.replace(/^\/api\/rsa\/history/, "/api/history"),
        },
        "/api": {
          target: process.env.BACKEND_DEV_URL || env.BACKEND_DEV_URL || "http://127.0.0.1:8000",
          changeOrigin: false,
        },
      },
    },
  };
});
