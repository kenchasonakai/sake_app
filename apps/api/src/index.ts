import { zValidator } from "@hono/zod-validator";
import { env } from "cloudflare:workers";
import { desc } from "drizzle-orm";
import { Hono } from "hono";
import { createSakeSchema, type Sake } from "@sake/shared";
import { db, schema } from "./db/index.ts";

/**
 * ルートはメソッドチェーンで定義する。
 * こうしておくと `typeof app` に全ルートの型が乗り、アプリ側の
 * `hc<AppType>()` で型付きクライアントが得られる。
 */
const app = new Hono()
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
export type AppType = typeof app;

export default app;
