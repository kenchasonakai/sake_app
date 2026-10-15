# sake_app

日本酒を知らなくても、日本酒好きの友達に外さない一本を贈れるアプリ。ハッカソンのデモ用で、アプリは Expo Go、受け取りリンクは Web で動かす。ストアには出さず、決済も発送もしない。

設計は docs にある。コードは Phase 0 の骨組みで、docs への追従はこれから（[CLAUDE.md](CLAUDE.md) の「今のコードの状態」）。

## 設計ドキュメント

- [docs/concept.md](docs/concept.md) コンセプトシート
- [docs/decisions.md](docs/decisions.md) 決定事項と未決事項
- [docs/flows.md](docs/flows.md) 利用の流れ
- [docs/architecture.md](docs/architecture.md) 構成、ディレクトリ、API
- [docs/auth.md](docs/auth.md) 認証・認可
- [docs/data-model.md](docs/data-model.md) テーブル設計
- [docs/screens.md](docs/screens.md) 画面設計
- [docs/design-discussion.md](docs/design-discussion.md) 残っている UI の論点
- [CLAUDE.md](CLAUDE.md) 実装者向けの入口と再構築の順番

## 構成

| ディレクトリ | 役割 | 主要技術 |
| --- | --- | --- |
| `apps/mobile` | アプリ本体（探す・贈る・記録・注文）。将来は Web 出力も同じコードから | Expo SDK 57 + Expo Router + TanStack Query + hono/client |
| `apps/api` | API | Hono on Cloudflare Workers（cf CLI / Vite）+ Drizzle + D1 |
| `apps/web` | アプリ不要で開く Web ページ（受け取りリンク）。将来は Expo の Web 出力もここから配信 | Hono JSX on Cloudflare Workers（cf CLI / Vite） |
| `packages/shared` | 共有スキーマ | Zod（アプリのフォームと API のバリデーションで共用） |

- パッケージ管理は pnpm workspace（isolated）+ Turborepo。
- API の型は `apps/api` が `dist/types` に出力し、アプリ側は `hc<AppType>()` で型付きクライアントを得る。
- 受け取りリンク `/g/:token` は `apps/web` が Hono JSX でサーバー描画する（OGP 付き、アプリ不要）。Web → API はサービスバインディング `env.API` で呼ぶ（公開 URL も CORS も不要）。
- 「探す・贈る」を Web でも出す段階になったら、Expo アプリの Web 出力（`expo export --platform web`）を `apps/web/public` に置いて同じ Worker の静的アセットとして同梱する。
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

### Web（受け取りリンク）

```sh
cd apps/web
pnpm dev                # http://localhost:5174。apps/api の cf dev も起動しておくと env.API がそこに繋がる
```

受け取りリンクの雛形は http://localhost:5174/g/任意の文字列 で開ける。

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
Web も `apps/web` で `pnpm deploy:staging` / `pnpm deploy`（API を先にデプロイしておく。サービスバインディング先が必要）。
秘密情報は `cf deploy --secrets-file <path>` で渡す（`cf` には `secret put` 相当がまだ無い）。

## よく使うコマンド（ルート）

```sh
pnpm typecheck   # shared → api(型出力) → web / mobile の順に型チェック
pnpm build       # api と web を cf build
pnpm api <cmd>   # apps/api のスクリプト実行（例: pnpm api db:generate）
pnpm mobile <cmd>
```

## 進め方

作る順番は [CLAUDE.md](CLAUDE.md) の「再構築の順番」。デモに向けては次を用意する。

- staging に api と web をデプロイし、受け取りリンクを LINE から開けるようにする。
- アプリは Expo Go で開き、デプロイした Web のオリジンに向ける。
- カタログに候補を数十本入れる。
- 受け取りからの経過時間で手配の状態が進むので、贈る人と受け取る人の画面が変わるところを見せる。
