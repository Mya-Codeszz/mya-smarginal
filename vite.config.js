import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you're running a separate backend for the /api/* routes
// (login, signup, profile, gemini) during local dev, proxy them
// here so the frontend can call relative /api/... paths.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
