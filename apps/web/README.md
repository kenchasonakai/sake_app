# @sake/web

探す・贈る・受け取りリンクを担う Web。React Router（framework mode, SSR）を Cloudflare Workers で動かす。

- `/` ランディング（検索から来る入口）
- `/gift/new` 贈る流れ
- `/g/:token` 受け取りリンク（OGP 付き。アプリ不要）

API（apps/api）へはサービスバインディング `env.API` 経由で呼ぶ（`app/lib/api.server.ts`）。

```sh
pnpm dev        # http://localhost:5174（apps/api も cf dev しておく）
pnpm typecheck  # cf workers types && react-router typegen && tsc -b
pnpm build      # cf build
pnpm deploy:staging
```
