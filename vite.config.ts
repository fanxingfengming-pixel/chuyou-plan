import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const proxy = {
  "/api/travel": {
    target: "http://127.0.0.1:3001",
    changeOrigin: false,
    timeout: 245000,
  },
};
const denied = [
  ".env",
  ".env.*",
  "**/.env*",
  "**/.git/**",
  "**/server/**",
  "**/data/**",
  "**/scripts/**",
  "**/artifacts/integration/**",
  "**/tests/**",
];
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy,
    watch: {
      ignored: [
        "**/artifacts/**",
        "**/data/**",
        "**/.npm-cache/**",
        "**/.pdf-qa/**",
        "**/.impeccable/**",
      ],
    },
    // Vitest's transform server needs the test files; browser dev mode blocks them.
    fs: {
      deny:
        mode === "test"
          ? denied.filter((pattern) => pattern !== "**/tests/**")
          : denied,
    },
  },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
}));
