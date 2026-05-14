import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8080";

  return {
    envDir: "../..",
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
