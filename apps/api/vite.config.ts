import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare()],
  server: {
    // iPhone の Expo Go から同一 LAN 経由で叩けるように公開する。
    // `cf dev --host` は通らないのでここで指定する。
    host: true,
    port: 5173,
    strictPort: true,
  },
});
