# ディレクトリ設計

前提: [concept.md](concept.md) の役割分担。アプリ（apps/mobile）が主役、Web（apps/web）は受け取りリンクと将来の Web 版、API（apps/api）は両方が使う。

## 全体

```
sake_app/
├─ apps/
│  ├─ mobile/      Expo（iOS / Android。将来は expo export --platform web で Web 版も）
│  ├─ api/         Hono on Workers。API 専用。HTML は返さない
│  └─ web/         Hono JSX on Workers。アプリ不要で開くページ（受け取りリンク）。将来 Expo の Web 出力を public/ から配信
├─ packages/
│  └─ shared/      Zod スキーマと列挙。アプリ・API・Web で共用
└─ docs/           設計ドキュメント
```

依存の向き: `mobile → shared`, `api → shared`, `web → shared`, `web → api（型のみ。実行時はサービスバインディング）`, `mobile → api（型のみ）`。逆向きは作らない。

## apps/api

```
apps/api/
├─ cloudflare.config.ts    mode（development / staging / production）ごとの Worker 定義
├─ drizzle/                マイグレーション SQL（drizzle-kit generate の出力。手で編集しない）
└─ src/
   ├─ index.ts             Hono アプリの組み立てだけ。routes/* を .route() で束ね、AppType を export
   ├─ routes/              1 リソース 1 ファイル。入力検証（zValidator）と HTTP の変換だけ
   │  ├─ bottles.ts        候補カタログの参照
   │  ├─ gifts.ts          ギフトの作成〜リンク発行〜状態参照
   │  ├─ recommendations.ts 候補の選定（場面・予算・ヒント → 2〜3 本）
   │  ├─ claims.ts         受け取り（トークンで参照、住所入力、成人確認）
   │  ├─ tastings.ts       飲んだ記録
   │  ├─ me.ts             自分の情報、プッシュトークン登録
   │  └─ admin/            運営用（注文の手動進行、候補の編集）。role=admin のみ
   ├─ services/            ドメインロジック。Hono に依存しない純粋な関数
   │  ├─ recommend.ts      3 軸スコアリング（値段・味・知名度）。数十本ならルールで十分
   │  ├─ gifts.ts          状態遷移（draft → … → opened）と不変条件
   │  ├─ claims.ts         トークン検証、住所の保存、注文の生成
   │  ├─ tastings.ts       記録の保存と「開けたよ」イベントの一回限りの発火
   │  └─ notifications.ts  イベント → Expo Push / メール
   ├─ db/
   │  ├─ index.ts          drizzle(env.DB)
   │  └─ schema/           テーブル定義。1 ドメイン 1 ファイル（auth.ts, catalog.ts, gifts.ts, tastings.ts, ops.ts）
   ├─ auth/
   │  └─ index.ts          Better Auth の設定（drizzle アダプタ、Expo プラグイン、匿名、メール OTP）
   ├─ middleware/
   │  ├─ session.ts        セッションを c.var.user に載せる（未ログインは null）
   │  └─ require.ts        requireUser / requireRole("admin")
   └─ lib/
      ├─ id.ts             ID 生成（UUID）
      ├─ token.ts          受け取りトークンの生成と比較
      └─ errors.ts         HTTPException の薄いラッパ
```

ルール:
- `routes/*` はチェーンで書き、`index.ts` で `.route("/gifts", gifts)` のように束ねる。`export type AppType = typeof app` にすべてのルートが乗る。
- `services/*` は `db` と引数だけに依存させ、Hono のコンテキストを渡さない。テストはここに書く。
- 認証が要るルートは `routes` 側で `requireUser` を噛ませる。`services` は「誰が呼んだか」を引数で受ける。
- 受け取り（claims）は認証なし。トークンが権限そのもの（[auth.md](auth.md)）。

### URL 設計（API）

| メソッド | パス | 認証 | 用途 |
| --- | --- | --- | --- |
| GET | /bottles, /bottles/:id | 不要 | 候補カタログ参照（公開情報のみ） |
| POST | /recommendations | 任意 | 場面・予算・ヒント → 候補 2〜3 本 |
| POST | /gifts | 必要（匿名可） | ギフト下書き作成 |
| GET | /gifts, /gifts/:id | 必要 | 自分のギフト一覧と詳細（状態、イベント） |
| POST | /gifts/:id/choose | 必要 | 一本を決める（候補スナップショット保存） |
| POST | /gifts/:id/message | 必要 | 一言と決めた理由 |
| POST | /gifts/:id/issue | 必要（本人確認済み） | 受け取りリンク発行。匿名ユーザーはここでサインインを要求 |
| GET | /claims/:token | 不要 | 受け取りページ用の情報（贈り主の一言、一本の説明、状態）。住所は返さない |
| POST | /claims/:token | 不要 | 成人確認と住所の送信 → 注文作成。1 回だけ成功 |
| GET/POST | /tastings | 必要 | 自分の記録。gift_id 付きの初回で「開けたよ」発火 |
| GET | /me | 必要 | 自分の情報 |
| PUT | /me/push-token | 必要 | Expo Push トークン登録 |
| ALL | /auth/* | - | Better Auth のハンドラ |
| * | /admin/** | role=admin | 注文の手動進行、候補の編集、イベント再送 |

## apps/web

```
apps/web/
├─ cloudflare.config.ts    API へのサービスバインディング env.API
├─ public/                 将来 Expo の Web 出力を置く（静的アセットとして同梱される）
└─ src/
   ├─ index.tsx            ルートの束ね。/ と /g/:token と /api/* のプロキシ
   ├─ routes/
   │  ├─ receive.tsx       GET /g/:token, POST /g/:token（フォーム送信 → API の claims へ）
   │  └─ auth-proxy.ts     /api/auth/* を env.API に転送し Set-Cookie を中継（Web 版が要る時）
   ├─ pages/               Hono JSX のページと Layout（サーバー描画、JS なし）
   └─ lib/
      └─ api.ts            hc<AppType>（fetch = env.API.fetch）
```

ルール:
- ブラウザは Web の Worker とだけ話す。API の公開 URL をブラウザに見せない（CORS も Cookie のドメイン問題も避ける）。
- 受け取りページは JS なしで完結させる（LINE のアプリ内ブラウザで開かれる前提。速さと確実さを優先）。

## apps/mobile

```
apps/mobile/src/
├─ app/                    Expo Router。画面の「配置」だけ。ロジックは置かない
│  ├─ _layout.tsx          Provider（Query、Auth）、フォント、テーマ
│  ├─ (tabs)/
│  │  ├─ index.tsx         ホーム: 「贈る」導線と、贈った・もらった・飲んだの一覧
│  │  ├─ records.tsx       記録（飲んだ酒）
│  │  └─ settings.tsx
│  ├─ gift/
│  │  ├─ new.tsx           場面と予算（＋任意のヒント）
│  │  ├─ [id]/candidates.tsx 候補 2〜3 本と用語なしの説明
│  │  ├─ [id]/message.tsx  決めた理由 → 一言の下書き
│  │  ├─ [id]/share.tsx    リンクと LINE 用定型文
│  │  └─ [id]/index.tsx    状態（届いた・開けた）
│  ├─ tasting/
│  │  ├─ new.tsx           記録の入力（?giftId= で「開けたよ」に繋がる）
│  │  └─ [id].tsx
│  ├─ bottle/[id].tsx      一本の詳細
│  └─ auth/                サインイン（メール OTP、Apple / Google）
├─ features/               機能ごとのまとまり。画面から呼ぶ hooks と部品
│  ├─ gift/                useCreateGift, CandidateCard, OccasionPicker, BudgetPicker …
│  ├─ tasting/
│  ├─ catalog/
│  └─ auth/                useSession, authClient
├─ components/             機能に依存しない UI（Button, Sheet, ThemedText …）
├─ lib/
│  ├─ api.ts               hc<AppType>（Cookie を付ける fetch）
│  ├─ auth-client.ts       Better Auth の Expo クライアント
│  ├─ query-client.ts
│  └─ notifications.ts     Expo Push の許可とトークン登録
└─ constants/              theme, spacing
```

ルール:
- `app/` のファイルは薄く。データ取得と状態は `features/*/hooks` に置き、画面は組み立てるだけ。
- API の呼び出しは必ず `lib/api.ts` の型付きクライアントから。URL を文字列で書かない。
- 入力の検証は `@sake/shared` の Zod を使い、API と同じスキーマで二重に持たない。

## packages/shared

```
packages/shared/src/
├─ index.ts
├─ enums.ts        occasion, sakeType, giftStatus, orderStatus, tasteAxes の列挙
├─ bottle.ts       Bottle（公開情報）のスキーマ
├─ gift.ts         CreateGiftInput, ChooseInput, MessageInput, Gift（API の返却）
├─ recommendation.ts RecommendInput（場面・予算・ヒント）、Candidate
├─ claim.ts        ClaimView（受け取りページに出す情報）、ClaimInput（成人確認・住所）
└─ tasting.ts      CreateTastingInput, Tasting
```

ルール: API の返却型も Zod で定義し、`c.json(parsed)` 前に `schema.parse` する（内部の列を漏らさない）。

## 環境とデプロイ

| mode | api | web | D1 |
| --- | --- | --- | --- |
| development | sake-api-dev（cf dev, 5173） | sake-web-dev（cf dev, 5174） | ローカル（固定 UUID） |
| staging | sake-api-staging | sake-web-staging | sake-db-staging |
| production | sake-api | sake-web | sake-db |

デプロイ順は api → web（サービスバインディング先が必要）。秘密情報は `cf deploy --secrets-file`。
