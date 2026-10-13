import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.ts";

/** リクエストごとに呼ぶ。D1 バインディングは cloudflare.config.ts の env.DB。 */
export const db = () => drizzle(env.DB, { schema });

export { schema };
