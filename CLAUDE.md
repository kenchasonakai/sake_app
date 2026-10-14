# sake_app

日本酒を知らなくても、日本酒好きの友達に外さない一本を贈れるアプリ。

## 最初に読む

- [docs/concept.md](docs/concept.md) コンセプトと役割分担（アプリが主役、Web は受け取りリンク、API は両方が使う）
- [docs/architecture.md](docs/architecture.md) ディレクトリ設計と URL 設計
- [docs/auth.md](docs/auth.md) 認証・認可
- [docs/data-model.md](docs/data-model.md) テーブル設計
- [docs/design-discussion.md](docs/design-discussion.md) UI を決める前の論点
- [README.md](README.md) セットアップとコマンド

## 技術と制約

- pnpm workspace + Turborepo。Node 22.18 以上。Bun 不可（cf CLI が未対応）。
- Cloudflare は新 CLI の `cf`（ベータ）で操作する。設定は各 app の `cloudflare.config.ts`。Wrangler はログ閲覧用。
- apps/api: Hono + Drizzle + D1。API のみ。HTML は返さない。
- apps/web: Hono JSX。受け取りリンク。API へはサービスバインディング `env.API`。
- apps/mobile: Expo SDK 57 + Expo Router。API は `hc<AppType>()` で呼ぶ（型は apps/api の `pnpm build:types` が出力）。
- 入力検証は packages/shared の Zod を使い、アプリと API で二重に持たない。
- 開発者は Mac を持たない。iOS は Expo Go と EAS のクラウドビルドのみ。

## 作業の約束

- 変更後は `pnpm typecheck`（ルート）を通す。API を変えたら `pnpm --filter @sake/api build:types` で型を出し直す。
- schema を変えたら `pnpm --filter @sake/api db:generate` で `drizzle/` に SQL を生成し、`db:migrate:local` で適用する。生成 SQL は手で編集しない。
- 受け取る側の記録（tastings）は本人以外が読めない設計を崩さない。贈り主に渡るのは「開けたよ」の事実だけ。
- 住所は orders にだけ置き、贈り主には見せない。
- アプリ内で金銭を受け取らない（酒類販売媒介業免許の確認が取れるまで）。

## 実装の順番（提案）

1. スキーマを data-model.md に合わせて作り直す（`sakes` を削除、bottles / gifts / orders / tastings …）
2. 候補を数本 bottles に入れ、`POST /recommendations` をルールで実装
3. アプリ: 場面と予算 → 候補 → 一言 → リンク発行（匿名のまま。サインインは後）
4. Web: `/g/:token` を実データに接続、住所送信で orders を作る
5. 記録と「開けたよ」（Better Auth のメール OTP をここで入れる）
6. 運営用の注文一覧（手動進行）
