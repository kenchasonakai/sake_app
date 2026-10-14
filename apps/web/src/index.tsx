import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { api } from "./lib/api.ts";
import { Layout } from "./pages/layout.tsx";
import { ReceivePage } from "./pages/receive.tsx";

const app = new Hono()
  // 探す・贈るの Web 版は後で Expo の Web 出力を同梱する。それまでは仮の入口。
  .get("/", async (c) => {
    const health = await api.health.$get().then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return c.html(
      <Layout
        title="日本酒を知らなくても、外さない一本を贈れる"
        description="場面と予算を選ぶだけ。日本酒好きの友達に、用語なしの説明を読んで一本を選んで贈れます。"
        url={c.req.url}
      >
        <h1>日本酒を知らなくても、外さない一本を贈れる。</h1>
        <p>聞くのは場面と予算だけ。味や用語はこちらが引き受けます。</p>
        <p class="muted">
          {env.APP_ENV} / API: {health ? `OK (${health.env})` : "接続できません"}
        </p>
      </Layout>,
    );
  })

  // 受け取りリンク。アプリ不要でここだけで完結させる
  .get("/g/:token", (c) => c.html(<ReceivePage token={c.req.param("token")} url={c.req.url} />))
  .post("/g/:token/claim", (c) => c.text("未実装", 501));

export default app;
