# sake_app

日本酒の記録アプリ。TypeScript のみで iOS / Android 両対応（Mac なし前提）。

## 構成

| ディレクトリ | 役割 | 主要技術 |
| --- | --- | --- |
| `apps/web` | 探す・贈る・受け取りリンク | React Router 8（SSR）on Cloudflare Workers（cf CLI / Vite）+ Tailwind |
| `apps/mobile` | 受け取った後の記録、知った後の注文 | Expo SDK 57 + Expo Router + TanStack Query + hono/client |
| `apps/api` | API | Hono on Cloudflare Workers（cf CLI / Vite）+ Drizzle + D1 |
| `packages/shared` | 共有スキーマ | Zod（アプリのフォームと API のバリデーションで共用） |

- パッケージ管理は pnpm workspace（isolated）+ Turborepo。
- API の型は `apps/api` が `dist/types` に出力し、Web とアプリは `hc<AppType>()` で型付きクライアントを得る。
- Web → API はサービスバインディング（`env.API`）で呼ぶ。公開 URL も CORS も不要。
- コンセプトは [docs/concept.md](docs/concept.md)。
- Cloudflare の操作は Wrangler ではなく新 CLI の `cf`（ベータ）で行う。Wrangler はログ閲覧（`wrangler tail`）用に同梱。

## 必要なもの

- Node.js 22.18 以上（Bun 不可。cf が対応していない）
- pnpm 10
- iPhone に Expo Go
- Cloudflare アカウント（デプロイ時のみ。ローカル開発は不要）

## セットアップ

```sh
pnpm install
pnpm --filter @sake/api build:types   # API の型定義を生成（アプリの型チェックに必要）
```

## ローカル開発

### API（ローカル D1）

```sh
cd apps/api
pnpm db:migrate:local   # ローカル D1 にマイグレーション適用（初回と schema 変更時）
pnpm dev                # http://localhost:5173（LAN にも公開される）
```

- ローカル D1 の実体は `apps/api/.cloudflare/state/` 配下。
- `cf d1 ... --local` は D1 を UUID でしか指定できないため、development モードの D1 には
  `cloudflare.config.ts` の `LOCAL_D1_ID` を固定で与えている。実在の DB とは無関係。
- schema を変えたら `pnpm db:generate` で `drizzle/` に SQL を生成し、`pnpm db:migrate:local` で適用。

### Web

```sh
cd apps/web
pnpm dev                # http://localhost:5174。apps/api の cf dev も起動しておくと env.API がそこに繋がる
```

- `/` ランディング、`/gift/new` 贈る流れ、`/g/:token` 受け取りリンク（OGP 付き）。
- cf build と React Router 8.4 の既知の不整合（出力先の強制とマニフェストの場所）を `vite.config.ts` の小さなプラグインで回避している。直ったら外す。

### アプリ

```sh
cd apps/mobile
cp .env.example .env     # EXPO_PUBLIC_API_URL を PC の LAN 上の IP（例: http://192.168.0.10:5173）にする
pnpm start               # QR コードを iPhone の Expo Go で読む
```

API の型を変えたら `pnpm --filter @sake/api build:types` を実行し直す（ルートで `pnpm typecheck` を叩けば Turborepo が順に実行する）。

## デプロイ（Cloudflare）

モードは `development`（cf dev の既定）/ `staging`（開発用 Worker）/ `production`。

```sh
cd apps/api
cf auth login                                 # 初回のみ。cf は Wrangler と別の認証情報を持つ
cf d1 create --name sake-db-staging           # 返ってきた id を cloudflare.config.ts に貼る（省略時は deploy が作成）
pnpm deploy:staging                           # sake-api-staging.<account>.workers.dev
STAGING_D1_ID=<id> pnpm db:migrate:staging    # 開発用 D1 にマイグレーション適用
pnpm logs:staging                             # ログ（wrangler tail）
```

本番は `pnpm deploy` / `PRODUCTION_D1_ID=<id> pnpm db:migrate:production`。
Web も同様に `apps/web` で `pnpm deploy:staging` / `pnpm deploy`（API を先にデプロイしておく。サービスバインディング先が必要）。
秘密情報は `cf deploy --secrets-file <path>` で渡す（`cf` には `secret put` 相当がまだ無い）。

## よく使うコマンド（ルート）

```sh
pnpm typecheck   # shared → api(型出力) → web / mobile の順に型チェック
pnpm build       # api と web を cf build
pnpm api <cmd>   # apps/api のスクリプト実行（例: pnpm api db:generate）
pnpm mobile <cmd>
```

## 段階的な進め方

1. Phase 0（この骨組み）: モノレポ、共有 Zod、API・Web・アプリの疎通
2. Phase 1: Web で贈る流れと受け取りリンク、staging Worker + D1、手動運用で注文を回す。課金ゼロ
3. Phase 2: R2 で写真、EAS Update、Sentry。Apple Developer 申請
4. Phase 3: iOS Development Build、プッシュ通知とソーシャルログイン、TestFlight
5. Phase 4: Android は手元 PC でビルド → クローズドテスト → Play 公開
