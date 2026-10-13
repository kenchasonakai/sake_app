import { defineConfig } from "drizzle-kit";

/**
 * マイグレーション SQL の生成のみ drizzle-kit で行い、適用は cf に任せる。
 *   pnpm db:generate         → ./drizzle/NNNN_*.sql を生成
 *   pnpm db:migrate:local    → ローカル D1 に適用
 *   pnpm db:migrate:staging  → 開発用 D1 に適用
 *
 * Drizzle Studio で本物の D1 を見たい場合は driver: "d1-http" と
 * CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID / CLOUDFLARE_D1_TOKEN を追加する。
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
