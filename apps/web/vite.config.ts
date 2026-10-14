import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { cp, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * cf build は CLOUDFLARE_VITE_FORCE_BUILD_OUTPUT を立ててクライアントの出力先を
 * .cloudflare/output 配下に変えるが、React Router 8.4 は従来の build/client を前提に
 *   1. SSR ビルド時に build/client/.vite/manifest.json を読む
 *   2. ブラウザ用マニフェスト build/client/assets/manifest-*.js を書く
 * ため、そのままでは cf build が失敗し、成功してもマニフェスト JS が配信物に含まれない。
 * クライアントビルド後に 1 を複製し、SSR ビルド後に 2 を配信物へ複製して回避する。
 * cf 側か React Router 側で直ったら削除する。
 */
function reactRouterManifestShim(): Plugin {
  const legacyClientDir = path.resolve("build/client");
  let forcedClientDir: string | undefined;
  return {
    name: "sake:react-router-cf-manifest-shim",
    apply: "build",
    async writeBundle(options) {
      if (!process.env.CLOUDFLARE_VITE_FORCE_BUILD_OUTPUT || !options.dir) return;
      if (this.environment.name !== "client") return;
      forcedClientDir = options.dir;
      const dest = path.join(legacyClientDir, ".vite", "manifest.json");
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(path.join(forcedClientDir, ".vite", "manifest.json"), dest);
    },
    async closeBundle() {
      if (this.environment.name !== "ssr" || !forcedClientDir) return;
      // React Router が build/client に書いたものを配信物へ寄せる（manifest-*.js など）
      await cp(path.join(legacyClientDir, "assets"), path.join(forcedClientDir, "assets"), {
        recursive: true,
        force: false,
      });
    },
  };
}

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    reactRouterManifestShim(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // apps/api の cf dev は 5173 を使うので Web は 5174。LAN にも公開する。
    host: true,
    port: 5174,
    strictPort: true,
  },
});
