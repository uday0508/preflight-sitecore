import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 3000,
    host: true,
    headers: { "Access-Control-Allow-Origin": "*" },
    proxy: {
      "/api/cdp": {
        target: "https://api-sg-cdpp.sitecorecloud.io",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/cdp/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const token = process.env.CDP_TOKEN;
            if (token) {
              proxyReq.setHeader("Authorization", `Bearer ${token}`);
            }
          });
        },
      },
    },
  },
});