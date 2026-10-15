# テーブル設計（D1 / SQLite、Drizzle）

前提: [decisions.md](decisions.md)、[flows.md](flows.md)、[auth.md](auth.md)。

## 方針

- 主キーは text の UUID。日時は ISO 8601 の text。真偽は integer。JSON は text。
- 状態は「ギフト」「手配」「開けたよ」の 3 つに分けて持つ。1 つの列に混ぜない。
- 期限は `*_expires_at` 列とリクエスト時の比較で判定する（D6）。
- 個人情報（住所、氏名、電話、受け取る人のメール）は `fulfillments` にだけ置く。
- 記録（`tastings`）は本人以外が読まない。ギフトの候補選びに使わない（D3）。
- 決済のテーブルは作らない（D14）。

## 一覧

```
user ─┬─< gifts >── bottles
      │     ├─1 fulfillments   住所と手配。1 ギフトに 1 つ
      │     └─< gift_events    状況の履歴
      ├─< tastings >─ bottles、gifts（もらった一本）
      └─< push_tokens
```

`gifts` から `user` へは 2 本ある。贈った人の `giver_user_id` と、紐づいた受け取る人の `recipient_user_id`。

## user（Better Auth）

`user`、`session`、`account`、`verification` は Better Auth の生成に従う。`user` にだけ列を足す。

| 列 | 型 | 説明 |
| --- | --- | --- |
| role | text | `user` / `admin`。既定 `user` |
| display_name | text? | 受け取りページに出す名前の既定値 |
| adult_confirmed_at | text? | 会員登録時の 20 歳以上の自己申告 |

## bottles（カタログ。手選びで数十本）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| name | text | 銘柄 |
| brewery | text | 蔵 |
| prefecture | text? | |
| volume_ml | integer | 180、300 など |
| price_yen | integer | 税込の価格の目安 |
| shipping_yen | integer | 送料の目安（O2）。ハッカソンでは一律でよい |
| taste_sweetness | integer 1〜5 | 甘め 1 〜 すっきり辛め 5 |
| taste_body | integer 1〜5 | 軽やか 1 〜 コクあり 5 |
| fame | integer 1〜5 | 定番 1 〜 知る人ぞ知る 5 |
| facts | text JSON | 事実のタグ。`many_fans`、`limited_distribution`、`new_brewery`、`award` など |
| description_plain | text | 用語を使わない説明。贈る人が読んで決める本文 |
| pairing_hint | text? | 「こんな場面に」の一言 |
| sake_type | text? | 純米などの区分。本文には出さず、詳細を開いた時だけ |
| image_url | text? | |
| offers | text JSON | 手配先や外出し先。`[{ vendor, url, priceYen }]` |
| source | text | 味の軸の出所。`manual` / `ai` / `sakenowa` |
| status | text | `active` / `paused` |
| sort_order | integer | |
| created_at、updated_at | text | |

索引: `(status, price_yen)`。

## gifts

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| giver_user_id | text FK user | 削除で連鎖させない |
| occasion | text | `birthday` / `thanks` / `casual` |
| budget_yen | integer | O2 の決め方に従う |
| taste_hint | text JSON? | 任意。`{ preference, level }`。既定は「分からない」で null |
| candidates | text JSON | 見せた候補のスナップショット。`[{ bottleId, rank, priceYen, shippingYen, score }]`。選定ロジックの見直しに使う |
| bottle_id | text FK bottles | 選んだ一本 |
| bottle_snapshot | text JSON | 確定時点の名前、容量、価格、送料、説明。カタログが変わっても受け取りページの表示が変わらないように |
| reasons | text JSON | 決めた理由のチップ |
| message | text | 一言 |
| giver_display_name | text | 受け取りページに出す名前。ギフトごとに変えられる |
| status | text | `issued` / `claimed` / `cancelled` |
| claim_token_hash | text UNIQUE | トークンの SHA-256 |
| claim_token_enc | text | 再表示用に暗号化したトークン |
| token_expires_at | text | リンクの有効期限。状態が進むたびに延ばす |
| claimed_at | text? | 住所が送られた時刻 |
| recipient_user_id | text? FK user | 受け取る人がアプリで紐づけた時 |
| linked_at | text? | |
| opened_at | text? | 開けたよが送られた時刻。1 回だけ |
| cancelled_at | text? | |
| created_at、updated_at | text | |

索引: `(giver_user_id, created_at)`、`claim_token_hash`、`recipient_user_id`。

### ギフトの状態

```
issued ──住所の送信──▶ claimed
   │
   └──キャンセル──▶ cancelled
```

- 期限切れは状態ではない。`status = issued` かつ `token_expires_at` を過ぎていれば期限切れとして扱う。
- リンクの作り直しは `issued` の間ならいつでもできる。状態は `issued` のまま、ハッシュ、暗号化トークン、有効期限を入れ替える。古いトークンは使えなくなる（D11）。
- キャンセルできるのは `issued` の間だけで、贈った本人か運営だけ（D10）。`claimed` からは移れない。
- 配送の進み具合は `fulfillments.status`、開けたよは `opened_at` で表し、ここには持たない。

### リンクの有効期限

| 時点 | token_expires_at |
| --- | --- |
| 発行、作り直し | その時刻から 30 日 |
| 受け取り | 受け取りから 90 日 |
| 届いた | 届いた日から 30 日 |
| キャンセル | 即時 |

## fulfillments（住所と手配）

受け取りで作られる。1 ギフトに 1 つ。今は運営の手動手配だけ（D14）。本番で別の手配に移れるよう、方法を列で持っておく。

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| gift_id | text UNIQUE FK gifts | |
| status | text | 下記 |
| recipient_name | text | |
| postal_code | text | |
| prefecture | text | |
| city | text | 市区町村 |
| address_line1 | text | 番地 |
| address_line2 | text? | 建物名、部屋番号 |
| phone | text | |
| recipient_email | text? | 任意。アプリへの自動紐づけに使う |
| adult_confirmed_at | text | 受け取る人の 20 歳以上の自己申告 |
| consented_at | text | 住所の使い道への同意 |
| method | text | 手配の方法。今は `manual` だけ |
| vendor | text? | 実際に手配した先（通販サイト、酒販店など） |
| vendor_ref | text? | 先方の注文番号 |
| cost_yen | integer? | 運営が実際に買って送った時にかかった金額。送らないデモでは空 |
| carrier、tracking_number | text? | |
| arranged_at、shipped_at、delivered_at | text? | |
| failed_reason | text? | |
| note | text? | 運営メモ |
| pii_purged_at | text? | 個人情報を消した時刻 |
| created_at、updated_at | text | |

索引: `(status, created_at)`、`recipient_email`。

### 手配の状態

```
pending ──▶ arranged ──▶ shipped ──▶ delivered
   │            │
   ├────────────┴──▶ failed
   └──▶ cancelled
```

- `pending` は受け取り直後。運営が手配する前。
- 手配の `cancelled` は運営だけが使う。受け取った人から止めてほしいと連絡があった時など。贈る人は受け取られた後のギフトをキャンセルできない（D10）。
- 手配できなかった時は `failed` にして、運営から贈る人に連絡する。代金を受け取っていないので返金はない。
- 個人情報の列は、手配が終わった後にリンクの有効期限が切れたら消し、`pii_purged_at` を埋める。最初は運営画面から手動で、自動化する時に Cron を足す。

## gift_events（状況の履歴）

贈る人の状況画面と監査に使う。

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| gift_id | text FK gifts | |
| type | text | `issued` / `reissued` / `claimed` / `arranged` / `shipped` / `delivered` / `failed` / `opened` / `cancelled` / `linked` |
| actor | text | `giver` / `recipient` / `admin` / `system` |
| payload | text JSON? | 追跡番号など。個人情報は入れない |
| created_at | text | |

索引: `(gift_id, created_at)`。
`linked` は監査用で、贈る人の画面には出さない。

## tastings（記録。本人だけ）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| user_id | text FK user | |
| bottle_id | text? FK bottles | カタログにある酒 |
| sake_name | text? | カタログにない酒の自由入力 |
| gift_id | text? FK gifts | もらった一本。`gifts.recipient_user_id` が自分のものだけ |
| verdict | text | `again` / `ok` / `not_for_me` |
| memo | text? | 自分だけのメモ |
| tasted_on | text | 日付 |
| created_at、updated_at | text | |

索引: `(user_id, tasted_on)`。
制約: `bottle_id`、`sake_name`、`gift_id` のどれか 1 つは必須。

開けたよとの関係: 記録の作成時に「開けたよを送る」が選ばれ、紐づいたギフトの `opened_at` が空なら、同じトランザクションで `opened_at` を埋め、`gift_events` に `opened` を足す。記録の中身はギフト側に何も写さない。

## push_tokens

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| user_id | text FK user | |
| token | text UNIQUE | Expo のプッシュトークン |
| platform | text | `ios` / `android` |
| last_seen_at | text | |
| created_at | text | |

## 候補の計算（ギフト）

入力は場面、予算、任意の好みのヒントだけ。記録は使わない（D3）。

1. `status = active` で、価格と送料の合計が予算以下、かつ予算の 6 割以上の酒を取る。2 本に満たなければ下限を外す。
2. 好みのヒントがあれば、味の軸がヒントに近いものを上げる。「分からない」なら軸が真ん中に近いものを上げる。
3. 場面で重みを変える。お礼は定番寄り、誕生日は少し特別寄り、なんとなくは価格の低い方寄り。
4. 2〜3 本を選ぶ時、知名度の軸で散らす。定番と知る人ぞ知るの両方が並ぶようにする。どちらを贈るかは贈る人の感性に委ねるため（コンセプト 2）。
5. 保存しない。ギフトの確定時に、見せた候補を `gifts.candidates` に残す。

## 今のコードとの差分

Phase 0 の `sakes` テーブルは動作確認用。再構築で削除し、上のテーブルに置き換える。
