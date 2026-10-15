# sake_app

日本酒を知らなくても、日本酒好きの友達に外さない一本を贈れるアプリ。ハッカソンの題材。

## 最初に読む

1. [docs/concept.md](docs/concept.md) コンセプトシート（原文）
2. [docs/decisions.md](docs/decisions.md) 決定事項と未決事項。設計はすべてこれに従う
3. [docs/flows.md](docs/flows.md) 利用の流れ、画面、状態の見せ方
4. [docs/architecture.md](docs/architecture.md) 構成、ディレクトリ、API の一覧
5. [docs/auth.md](docs/auth.md) 認証、受け取りトークン、認可
6. [docs/data-model.md](docs/data-model.md) テーブル設計と候補の計算
7. [docs/design-discussion.md](docs/design-discussion.md) UI の論点
8. [README.md](README.md) セットアップとコマンド

## 技術

- pnpm workspace と Turborepo。Node 22.18 以上。Bun は不可（cf CLI が未対応）。
- Cloudflare は新しい CLI の `cf`（ベータ）で操作する。設定は各 app の `cloudflare.config.ts`。Wrangler はログを見る時だけ。
- apps/web: 公開の入口。Hono JSX の受け取りページと、`/api/*` の API への転送。
- apps/api: Hono、Drizzle、D1。公開しない。`/api/*` と、Web だけが呼ぶ `/internal/*`。
- apps/mobile: Expo SDK 57、Expo Router。API は `hc<AppType>()` で呼ぶ。
- 入力と返却の形は packages/shared の Zod で決め、二重に持たない。
- 開発者は Mac を持たない。iOS は Expo Go と EAS のクラウドビルドだけ。

## 守ること

- 匿名ログインは使わない。贈る人はギフトの確定前にサインインする。受け取る人はアカウントなしで受け取れる。
- 記録（tastings）は本人以外が読まない。ギフトの候補選びにも使わない。
- 贈る人に、受け取る人の住所、メール、アカウントの有無、記録を見せない。
- 「開けたよ」は任意。記録を付ける時に本人が選んだ時だけ、1 回だけ送る。
- GET で状態を変えない。受け取りリンクは LINE のプレビューやスキャナが先に開く。
- 期限は `*_expires_at` で判定し、定期実行で書き換えない。
- お金の流れ（decisions.md の O1）が決まるまで決済を作らない。
- 変更後はルートで `pnpm typecheck` を通す。API を変えたら `pnpm --filter @sake/api build:types` で型を出し直す。
- schema を変えたら `pnpm --filter @sake/api db:generate` で SQL を作り、`db:migrate:local` で適用する。生成された SQL は手で直さない。

## 今のコードの状態

`apps/*` は Phase 0 の骨組みで、docs にまだ追従していない。主な差分:

- API のルートが `/api` 配下になく、`/internal` もない。動作確認用の `sakes` テーブルが残っている。
- Web は `/api/*` を転送していない。受け取りフォームの送信先が `/g/:token/claim` で、住所が 1 つの入力欄。
- アプリは Expo のテンプレートのままで、app.json の name と scheme が `mobile`。

## 再構築の順番（提案）

1. 骨組みを docs に合わせる。API を `/api` と `/internal` に分け、Web に転送と `/g/:token` の GET / POST を置く。`sakes` を消し、app.json を整える。
2. スキーマを data-model.md のとおりに作る。カタログに数本入れる。
3. 候補の計算（`POST /api/recommendations`）。
4. アプリの贈る流れ。G2〜G4 は端末の中、G5 でメール OTP、G6 で確定とリンク発行。
5. 受け取りページを実データに繋ぎ、住所の送信で fulfillments を作る。
6. 贈る人の状況画面と通知。
7. 受け取る人の紐づけ、記録、開けたよ。
8. 運営画面。O1 と O4 が決まってから。
