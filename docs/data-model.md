# テーブル設計（D1 / SQLite, Drizzle）

方針:
- 主キーは `text` の UUID。日時は ISO 8601 の `text`（`created_at` は DB 既定値）。真偽値は `integer`。
- 状態遷移はすべて `gift_events` に残し、`gifts.status` はその射影。
- 個人情報（住所）は `orders` だけに置き、配送完了から一定期間で消す。
- Better Auth のテーブル（`user / session / account / verification`）はプラグインの生成に従い、アプリ側の列は `user` に最小限だけ足す。

## 一覧

```
user ─┬─< gifts >─ bottles >─ shops
      │     │
      │     ├─1 orders ─ payments
      │     ├─< gift_candidates
      │     └─< gift_events
      ├─< recipients（贈り主が管理する「相手」）
      ├─< tastings >─ bottles
      └─< push_tokens
```

## 認証（Better Auth）

`user` にアプリ固有の列を追加:

| 列 | 型 | 説明 |
| --- | --- | --- |
| role | text | `user` / `admin` / `shop`。既定 `user` |
| shop_id | text? | role=shop の時の所属店 |
| is_anonymous | integer | anonymous プラグインが管理 |
| adult_confirmed_at | text? | 贈る側の飲酒年齢の自己申告 |

`session / account / verification` はプラグインの既定どおり。

## カタログ

### shops（提携先。最初は 1 行）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| name | text | |
| contact | text? | 注文を渡す先（メールなど） |
| ec_url | text? | 外出し先 |
| is_active | integer | |
| created_at / updated_at | text | |

### bottles（手選びの候補。数十本）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| shop_id | text FK shops | どこが発送するか |
| name | text | 銘柄名 |
| brewery | text | 蔵 |
| prefecture | text? | |
| sake_type | text | `junmai` … `other`（shared の enum） |
| volume_ml | integer | 180 / 300 / 720 |
| price_yen | integer | 税込の販売価格。予算の絞り込みに使う |
| taste_sweetness | integer 1–5 | 甘口 1 〜 辛口 5。「味」の軸その 1 |
| taste_richness | integer 1–5 | すっきり 1 〜 コクあり 5。「味」の軸その 2 |
| fame | integer 1–5 | 定番 1 〜 知る人ぞ知る 5。「知名度」の軸 |
| facts | text (JSON) | 事実タグの配列。`many_fans` / `limited_distribution` / `new_brewery` / `award` … |
| description_plain | text | 用語を使わない説明。贈る側が読んで決める本文 |
| pairing_hint | text? | 「こんな場面に」の一言 |
| image_url | text? | |
| external_url | text? | 蔵や店の EC |
| status | text | `active` / `paused` / `out_of_stock` |
| sort_order | integer | 手動の並び |
| created_at / updated_at | text | |

索引: `(status, price_yen)`。
味の軸は最初は手入力（AI でリサーチして埋めてよい）。さけのわの API を使う場合は `source` と `source_ref` の列を足して出所を残す。

## ギフト

### recipients（贈り主が管理する「相手」）

「同じ相手に 2 回目」を扱うための台帳。相手の個人情報は持たない（呼び名だけ）。

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| giver_user_id | text FK user | |
| label | text | 贈り主から見た呼び名（「田中さん」） |
| recipient_user_id | text? FK user | 相手がリンクからアカウントを作った時に紐づく |
| created_at | text | |

### gifts

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| giver_user_id | text FK user | 匿名ユーザーでも必ず入る |
| recipient_id | text? FK recipients | |
| occasion | text | `birthday` / `thanks` / `casual` |
| budget_yen | integer | |
| hint | text (JSON) | 任意の相手情報 `{ preference: "unknown" \| "sweet" \| "dry" \| "light" \| "rich", level: "unknown" \| "casual" \| "enthusiast" }` |
| bottle_id | text? FK bottles | 決めた一本 |
| reasons | text (JSON)? | 決めた理由（チップの選択）。一言の下書きの元 |
| message | text? | 相手への一言 |
| status | text | 下記の状態 |
| claim_token | text? UNIQUE | 受け取りリンクのトークン。発行時に生成。再発行で置き換え |
| claim_expires_at | text? | |
| claimed_at | text? | 住所が送られた時刻 |
| recipient_user_id | text? FK user | 受け取る側が後からアプリで紐づけた時 |
| opened_at | text? | 受け取る側が最初の記録を付けた時刻。「開けたよ」は 1 回だけ |
| created_at / updated_at | text | |

状態（`status`）:

```
draft ─ choose ─▶ chosen ─ message/issue ─▶ issued ─ claim ─▶ claimed ─ 店へ ─▶ ordered ─▶ shipped ─▶ delivered ─▶ opened
                                              │                                                          
                                              └─ 30 日 ─▶ expired（再発行で issued へ戻る）      いつでも cancelled
```

索引: `(giver_user_id, created_at)`, `claim_token`（UNIQUE）, `(recipient_user_id)`。

### gift_candidates（提示した候補のスナップショット）

後で選定ロジックを直すための記録。贈り主が何を見て何を選んだかが残る。

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| gift_id | text FK gifts | |
| bottle_id | text FK bottles | |
| rank | integer | 1〜3 |
| score | real? | 選定時のスコア |
| snapshot | text (JSON) | 提示時の価格・説明・軸の値 |
| created_at | text | |

### gift_events（タイムラインと通知の元）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| gift_id | text FK gifts | |
| type | text | `created` / `chosen` / `issued` / `claimed` / `ordered` / `shipped` / `delivered` / `opened` / `expired` / `reissued` / `cancelled` |
| actor | text | `giver` / `recipient` / `admin` / `system` |
| payload | text (JSON)? | 追跡番号など。個人情報は入れない |
| notify_to | text? | 通知先ユーザー（`gift.opened` なら贈り主） |
| notified_at | text? | 配信済み時刻。未配信を Cron で再送 |
| created_at | text | |

索引: `(gift_id, created_at)`, `(notified_at)`（NULL のものを拾う）。

## 注文と決済

### orders（1 ギフト 1 注文）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| gift_id | text UNIQUE FK gifts | |
| shop_id | text FK shops | bottles.shop_id を転記 |
| recipient_name | text | |
| postal_code / prefecture / city / line1 / line2 | text | 住所。line2 は任意 |
| phone | text? | 配送業者向け。任意 |
| adult_confirmed_at | text | 受け取る側の自己申告 |
| status | text | `pending`（店に未連絡）/ `handed`（店に渡した）/ `shipped` / `delivered` / `cancelled` |
| carrier / tracking_number | text? | |
| handed_at / shipped_at / delivered_at | text? | |
| note | text? | 運営メモ |
| pii_purged_at | text? | 住所を消した時刻。delivered から 30 日で消す |
| created_at / updated_at | text | |

### payments（MVP は手動。記録だけ持つ）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| gift_id | text FK gifts | |
| provider | text | `manual` / `shop_link` / `stripe`（将来） |
| amount_yen | integer | |
| status | text | `pending` / `paid` / `refunded` |
| external_ref | text? | 店の決済リンクの ID など |
| paid_at | text? | |
| created_at | text | |

媒介業免許の確認が取れるまで、アプリ内で金銭を受け取らない（[concept.md](concept.md) 8）。

## 記録

### tastings（本人だけが読める）

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| user_id | text FK user | |
| bottle_id | text? FK bottles | カタログにある酒 |
| sake_name | text? | カタログにない酒の自由入力 |
| gift_id | text? FK gifts | もらった酒の記録なら紐づく |
| verdict | text | `again`（また飲みたい）/ `ok` / `not_for_me`。3 段階で「ぽちぽち」 |
| memo | text? | 短いメモ。贈り主には渡らない |
| tasted_at | text | |
| created_at | text | |

索引: `(user_id, tasted_at)`, `(gift_id)`。
不変条件: `gift_id` 付きの記録を作る時、`gifts.opened_at` が NULL なら埋めて `gift_events(opened)` を 1 件だけ作る（同一トランザクション）。

### push_tokens

| 列 | 型 | 説明 |
| --- | --- | --- |
| id | text PK | |
| user_id | text FK user | |
| token | text UNIQUE | ExponentPushToken[...] |
| platform | text | `ios` / `android` |
| last_seen_at | text | |
| created_at | text | |

## 既存の `sakes` テーブルについて

Phase 0 の動作確認用。`tastings` に置き換えるので、次のマイグレーションで削除する（データはない）。

## 選定ロジックに必要な読み取り

1. `bottles` から `status = active` かつ `price_yen <= budget` を取る（上限は予算、下限は予算の 60% を目安）。
2. 場面で重みを変える: 誕生日は `fame` の中〜高（少し特別）、お礼は `fame` 低（外さない定番）、なんとなくは価格の低い方を優先。
3. ヒントがあれば `taste_*` を寄せる。`unknown` なら中庸（3 付近）を優先。
4. 相手が `recipients.recipient_user_id` を持ち、過去の `tastings.verdict = again` があれば、その `bottle` の軸に寄せる（memo は読まない。verdict と軸だけ）。
5. 上位 3 本を `gift_candidates` に保存して返す。
