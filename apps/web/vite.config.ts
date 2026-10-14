import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare()],
  server: {
    // apps/api の cf dev は 5173 を使うので Web は 5174。LAN にも公開する。
    host: true,
    port: 5174,
    strictPort: true,
  },
});
