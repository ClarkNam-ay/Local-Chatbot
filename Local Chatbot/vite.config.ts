// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devHost = process.env.VITE_DEV_HOST || "127.0.0.1";
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS || "localhost,127.0.0.1")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const backendProxyTarget =
  process.env.VITE_BACKEND_PROXY_TARGET || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: devHost,
    allowedHosts,
    proxy: {
      "/api": {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
