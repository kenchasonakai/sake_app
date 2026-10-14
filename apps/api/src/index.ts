import { zValidator } from "@hono/zod-validator";
import { env } from "cloudflare:workers";
import { desc } from "drizzle-orm";
import { Hono } from "hono";
import { createSakeSchema, type Sake } from "@sake/shared";
import { db, schema } from "./db/index.ts";
import { ReceivePage } from "./pages/receive.tsx";

/**
 * API。ルートはメソッドチェーンで定義する。
 * こうしておくと `typeof api` に全ルートの型が乗り、アプリ側の
 * `hc<AppType>()` で型付きクライアントが得られる。
 */
const api = new Hono()
  .get("/health", (c) => c.json({ ok: true, env: env.APP_ENV }))

  .get("/sakes", async (c) => {
    const rows: Sake[] = await db()
      .select()
      .from(schema.sakes)
      .orderBy(desc(schema.sakes.createdAt));
    return c.json(rows);
  })

  .post("/sakes", zValidator("json", createSakeSchema), async (c) => {
    const input = c.req.valid("json");
    const [row] = await db()
      .insert(schema.sakes)
      .values({ id: crypto.randomUUID(), ...input })
      .returning();
    const created: Sake = row!;
    return c.json(created, 201);
  });

/** アプリ側（hono/client）が参照する型。実体は dist/types に出力する。 */
export type AppType = typeof api;

/**
 * Worker 本体。API に加えて、アプリ不要で開く Web ページ（受け取りリンク）を同じ Worker で配信する。
 * 将来「探す・贈る」を Web でも出す時は、Expo アプリの Web 出力を静的アセットとして同梱する。
 */
const app = new Hono()
  .route("/", api)
  .get("/g/:token", (c) => c.html(ReceivePage({ token: c.req.param("token"), url: c.req.url })))
  .post("/g/:token/claim", (c) => c.text("未実装", 501));

export default app;
