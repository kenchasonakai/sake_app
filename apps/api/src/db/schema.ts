import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { SakeType } from "@sake/shared";

export const sakes = sqliteTable("sakes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  brewery: text("brewery"),
  type: text("type").$type<SakeType>().notNull(),
  rating: integer("rating"),
  memo: text("memo"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});
