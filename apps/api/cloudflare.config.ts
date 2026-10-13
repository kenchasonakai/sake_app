import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

/**
 * ローカル D1 の固定 ID。
 * `cf d1 ... --local` は D1 を UUID でしか指定できないので、development モードでは
 * バインディングにこの ID を与えて `cf dev` と `cf d1 migrations apply --local` が
 * 同じローカル DB（.cloudflare/state 配下）を指すようにする。実在する DB とは無関係。
 */
export const LOCAL_D1_ID = "3f2c7a9e-8b1d-4c5e-9f0a-1b2c3d4e5f60";

/**
 * mode ごとに完全な設定を返す（cf は env ブロックの継承をしない）。
 *
 * - development: `cf dev` の既定。ローカルの D1 シミュレーションを使う。
 * - staging:     `cf deploy --mode staging`。workers.dev 上の開発用 Worker + 開発用 D1。
 * - production:  `cf deploy --mode production`。本番 Worker + 本番 D1。
 *
 * staging / production の D1 は `cf d1 create <name>` で作り、返ってきた id を
 * bindings.d1({ name, id }) に貼る。id を省略すると `cf deploy` が同名で作成して紐づける。
 */
export default defineConfig(({ mode }) => {
  switch (mode) {
    case "production":
      return worker("sake-api", mode, bindings.d1({ name: "sake-db" }));
    case "staging":
      return worker("sake-api-staging", mode, bindings.d1({ name: "sake-db-staging" }));
    default:
      return worker("sake-api-dev", "development", bindings.d1({ name: "sake-db-local", id: LOCAL_D1_ID }));
  }
});

function worker(name: string, appEnv: string, DB: ReturnType<typeof bindings.d1>) {
  return {
    worker: {
      name,
      compatibilityDate: "2026-10-06",
      entrypoint,
      env: {
        APP_ENV: bindings.text(appEnv),
        DB,
      },
    },
  };
}
