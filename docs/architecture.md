# アーキテクチャとディレクトリ設計

前提: [decisions.md](decisions.md) と [flows.md](flows.md)。

## 全体像

```
                 ┌──────────────── 公開されるのはここだけ（D7）
 iPhone/Android ─┤
 アプリ           │  apps/web（Worker: sake-web）
                 │   ├─ /g/:token        受け取りページ（Hono JSX、JS なし）
 ブラウザ ────────┤   ├─ /                入口（後で Expo の Web 出力）
 LINE プレビュー   │
                 │   └─ /api/*  ──────┐  そのまま API に渡す
                 └────────────────────│───────────────────
                                      │ サービスバインディング env.API
                                      ▼
                     apps/api（Worker: sake-api。公開ルートなし）
                      ├─ /api/*        アプリと将来の Web 版が使う API
                      └─ /internal/*   Web の Worker だけが呼ぶ API（受け取り）
                                      │
                                      ▼
                                 D1（sake-db）
```

- アプリの通信先は Web の Worker のオリジンだけ。`/api/*` は Web が中身を見ずに API へ渡す。
- `/internal/*` は Web が `/api/*` として転送しないので、外からは届かない。受け取りの処理はここに置き、Web のサーバー側からだけ呼ぶ。
- API の Worker には workers.dev もルートも付けない。外から直接呼べない。
- 独自ドメインを取ったら Web の Worker に付けるだけで、API 側は変わらない。

## リポジトリ

```
sake_app/
├─ apps/
│  ├─ mobile/      Expo。Expo Go で動かし、ストアには出さない（D17）。将来 expo export --platform web で Web 版も
│  ├─ api/         Hono + Drizzle + D1。HTML は返さない
│  └─ web/         Hono JSX。公開の入口。受け取りページと /api 転送
├─ packages/
│  └─ shared/      Zod スキーマと列挙。アプリ、API、Web で共用
└─ docs/
```

依存の向き: `mobile → shared`、`api → shared`、`web → shared`、`mobile → api` と `web → api` は型だけ。逆向きは作らない。

## apps/api

```
apps/api/
├─ cloudflare.config.ts     mode（development / staging / production）ごとの Worker 定義
├─ drizzle/                 マイグレーション SQL。drizzle-kit generate の出力で、手で編集しない
└─ src/
   ├─ index.ts              組み立てだけ。/api と /internal を束ね、AppType と InternalType を export
   ├─ routes/
   │  ├─ public/            /api/* 。アプリと将来の Web 版が使う
   │  │  ├─ bottles.ts      カタログの参照
   │  │  ├─ recommendations.ts  候補の計算（ログイン不要、保存しない）
   │  │  ├─ gifts.ts        贈ったギフトの作成、一覧、詳細、リンクの再表示と作り直し、キャンセル
   │  │  ├─ received.ts     もらったギフトの一覧、紐づけ、開けたよ
   │  │  ├─ tastings.ts     記録
   │  │  ├─ me.ts           自分の情報、表示名
   │  │  └─ admin.ts        運営用（O4）
   │  └─ internal/          /internal/* 。Web の Worker だけが呼ぶ
   │     └─ claims.ts       受け取りページの表示用データ、住所の送信
   ├─ services/             業務ロジック。Hono に依存しない関数。テストはここに書く
   │  ├─ recommend.ts       場面・予算・好みのヒントからの候補計算（D3: 記録は使わない）
   │  ├─ gifts.ts           作成、状態、期限、リンクの作り直し、キャンセル
   │  ├─ claims.ts          トークン検証、住所の保存、手配の作成
   │  ├─ linking.ts         受け取る人のアカウントへの紐づけ（2 経路）
   │  ├─ tastings.ts        記録と開けたよ
   │  └─ fulfillment.ts     手配の状態を運営画面から進める（D14）
   ├─ db/
   │  ├─ index.ts
   │  └─ schema/            auth.ts、catalog.ts、gifts.ts、fulfillment.ts、tastings.ts、devices.ts
   ├─ auth/index.ts         Better Auth（メール OTP、Expo プラグイン、drizzle アダプタ）
   ├─ middleware/
   │  ├─ session.ts         セッションを c.var.user に載せる
   │  └─ require.ts         requireUser、requireAdmin
   └─ lib/
      ├─ token.ts           受け取りトークンの生成、ハッシュ、暗号化
      └─ errors.ts
```

ルール:
- `routes/*` は Hono のメソッドチェーンで書き、`index.ts` で `.route()` する。ルートの型は `AppType`（/api）と `InternalType`（/internal）に乗る。
- `services/*` は db と引数だけに依存する。「誰が」を引数で受け、所有者の確認を service の中で必ず行う。
- 返却は `packages/shared` の Zod で形を決め、内部の列をそのまま返さない。
- GET で書き込まない（D5）。

### API の一覧

`/api/*`（アプリと将来の Web 版）:

| メソッド | パス | 認証 | 用途 |
| --- | --- | --- | --- |
| GET | /api/health | 不要 | 疎通確認 |
| ALL | /api/auth/* | - | Better Auth |
| GET | /api/bottles、/api/bottles/:id | 不要 | カタログ |
| POST | /api/recommendations | 不要 | 場面・予算・ヒントから、予算内の候補を小さい瓶と大きい瓶の 2 つの束で、おすすめの印付きで返す。保存しない |
| POST | /api/gifts | 必要 | 確定。一本、一言、名前、場面、予算、見せた候補を受け取り、ギフトとリンクを作る |
| GET | /api/gifts | 必要 | 自分が贈ったギフトの一覧と状況 |
| GET | /api/gifts/:id | 必要（贈った本人） | 詳細と状況 |
| GET | /api/gifts/:id/link | 必要（贈った本人） | リンクの再表示 |
| POST | /api/gifts/:id/reissue | 必要（贈った本人） | リンクの作り直し。受け取られる前ならいつでも。古いリンクは無効 |
| POST | /api/gifts/:id/cancel | 必要（贈った本人） | キャンセル。受け取られる前だけ |
| GET | /api/received | 必要 | 自分に紐づいたもらったギフト |
| POST | /api/received/link | 必要 | 受け取りリンクを貼って紐づける |
| POST | /api/received/:giftId/opened | 必要（紐づいた本人） | 開けたよを 1 回だけ送る |
| GET、POST | /api/tastings | 必要 | 自分の記録の一覧、作成。作成時に開けたよを一緒に送れる |
| GET、PATCH、DELETE | /api/tastings/:id | 必要（本人） | |
| GET、PATCH | /api/me | 必要 | 自分の情報、既定の表示名 |
| * | /api/admin/* | admin | 手配の一覧と更新（O4） |

`/internal/*`（Web の Worker だけ）:

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | /internal/claims/:token | 受け取りページに出す情報。状態に応じた出し分け用。住所は返さない |
| POST | /internal/claims/:token | 住所の送信。1 回だけ成功 |

## apps/web

```
apps/web/
├─ cloudflare.config.ts     env.API（サービスバインディング）、レート制限
├─ public/                  後で Expo の Web 出力を置く
└─ src/
   ├─ index.tsx             /api/* の転送、/g/:token、/
   ├─ routes/
   │  └─ receive.tsx        GET /g/:token、POST /g/:token
   ├─ pages/                Hono JSX のページ。Layout、受け取り、状況、使えないリンク（期限切れとキャンセルで共通）、完了
   └─ lib/api.ts            /internal 用の型付きクライアント（fetch = env.API.fetch）
```

ルール:
- `/api/*` の転送はリクエストをそのまま `env.API.fetch(request)` に渡す。中身を解釈しない。
- 受け取りページは JS なし。フォームは同じパスへの POST。送信後はリダイレクトで GET に戻す。
- POST /g/:token はレート制限をかける（Workers のレート制限バインディング）。

## apps/mobile

```
apps/mobile/src/
├─ app/                     Expo Router。画面の配置だけ
│  ├─ _layout.tsx           Provider（Query、Auth）、テーマ
│  ├─ (tabs)/
│  │  ├─ index.tsx          ホーム。贈る入口と、贈ったギフトの状況
│  │  ├─ records.tsx        記録。もらった一本もここに出る
│  │  └─ settings.tsx       アカウント、表示名
│  ├─ gift/
│  │  ├─ new.tsx            G2 場面と予算
│  │  ├─ candidates.tsx     G3 候補。1 枚ずつめくる
│  │  ├─ message.tsx        G4 一言と名前
│  │  ├─ confirm.tsx        G5〜G6 サインインと確定
│  │  ├─ [id]/share.tsx     G7 共有
│  │  └─ [id]/index.tsx     G8 状況
│  ├─ received/
│  │  ├─ add.tsx            リンクを貼って紐づけ
│  │  └─ [id].tsx           もらった一本と開けたよ
│  ├─ tasting/
│  │  ├─ new.tsx
│  │  └─ [id].tsx
│  ├─ bottle/[id].tsx
│  └─ auth/sign-in.tsx      メール OTP
├─ features/                機能ごとの hooks と部品（gift、received、tasting、catalog、auth）
├─ components/              機能に依存しない UI
├─ lib/
│  ├─ api.ts                hc<AppType>。Cookie を付ける fetch
│  ├─ auth-client.ts        Better Auth の Expo クライアント
│  ├─ gift-draft.ts         G2〜G4 の入力を端末に持つ（確定前はサーバーに送らない）
└─ constants/
```

ルール:
- `app/` は薄く。データ取得と状態は `features/*` に置く。
- API は `lib/api.ts` の型付きクライアントからだけ呼ぶ。
- 入力の検証は `@sake/shared` の Zod を使う。

## packages/shared

```
packages/shared/src/
├─ enums.ts           occasion、budget、bottleSize、giftStatus、fulfillmentStatus、verdict、tasteHint
├─ bottle.ts          Bottle（公開情報）
├─ recommendation.ts  RecommendInput、Candidate（おすすめの印と一文を含む）
├─ gift.ts            CreateGiftInput、GiftSummary、GiftDetail、GiftDisplayStatus
├─ claim.ts           ClaimView（受け取りページの出し分け）、ClaimInput（住所など）
├─ received.ts        ReceivedGift、LinkInput
└─ tasting.ts         CreateTastingInput、Tasting
```

## 環境

| mode | 公開の入口 | API | D1 |
| --- | --- | --- | --- |
| development | sake-web-dev、cf dev、5174 番 | sake-api-dev、cf dev、5173 番 | ローカル、固定 UUID |
| staging | sake-web-staging.＜アカウント＞.workers.dev | sake-api-staging、公開なし | sake-db-staging |
| production | sake-web、後で独自ドメイン | sake-api、公開なし | sake-db |

- アプリの `EXPO_PUBLIC_API_URL` は公開の入口のオリジン。開発時は PC の LAN の IP と 5174 番。
- デモでは staging だけをデプロイすればよい。受け取りリンクを LINE から開けるよう、Web は必ずデプロイしておく。アプリは Expo Go で開き、デプロイした Web のオリジンに向ける。
- デプロイは api、web の順。秘密情報は `cf deploy --secrets-file` で渡す。
- 定期実行は使わない（D6、D14）。
