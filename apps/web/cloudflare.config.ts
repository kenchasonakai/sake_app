import { bindings, defineConfig } from "cf/config";

/**
 * Web（探す・贈る・受け取りリンク）用の Worker。API とは別 Worker。
 * API へはサービスバインディング（env.API）経由で呼ぶので、公開 URL も CORS も不要。
 *
 * - development: `cf dev`。apps/api 側も `cf dev` を起動しておくと env.API がそこに繋がる
 * - staging:     `cf deploy --mode staging`
 * - production:  `cf deploy --mode production`
 */
export default defineConfig(({ mode }) => {
  switch (mode) {
    case "production":
      return worker("sake-web", mode, "sake-api");
    case "staging":
      return worker("sake-web-staging", mode, "sake-api-staging");
    default:
      return worker("sake-web-dev", "development", "sake-api-dev");
  }
});

function worker(name: string, appEnv: string, apiWorkerName: string) {
  return {
    worker: {
      name,
      compatibilityDate: "2026-10-06",
      entrypoint: "./workers/app.ts",
      observability: { enabled: true },
      env: {
        APP_ENV: bindings.text(appEnv),
        API: bindings.worker({ worker: apiWorkerName }),
      },
    },
  };
}
