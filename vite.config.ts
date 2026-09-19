import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 3000,
    host: true,
    headers: { "Access-Control-Allow-Origin": "*" },
    proxy: {
      "/api-sitecore": {
        target: "https://api-sg-cdpp.sitecorecloud.io",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api-sitecore/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const token = process.env.CDP_TOKEN;
            const contextId = process.env.CDP_CONTEXT_ID;
            if (token) {
              proxyReq.setHeader("Authorization", `Bearer ${token}`);
            } else if (contextId) {
              proxyReq.setHeader("x-sitecore-contextid", contextId);
            }
          });
          proxy.on("error", (err) => {
            console.error("[Vite Proxy] CDP error:", err.message);
          });
        },
      },
    },
  },
});