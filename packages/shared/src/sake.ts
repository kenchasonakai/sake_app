import { z } from "zod";

/** 日本酒の種別。必要に応じて増やす。 */
export const sakeTypeSchema = z.enum([
  "junmai",
  "junmai_ginjo",
  "junmai_daiginjo",
  "honjozo",
  "ginjo",
  "daiginjo",
  "other",
]);
export type SakeType = z.infer<typeof sakeTypeSchema>;

/** API が返す日本酒レコード。 */
export const sakeSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  brewery: z.string().max(100).nullable(),
  type: sakeTypeSchema,
  rating: z.number().int().min(1).max(5).nullable(),
  memo: z.string().max(1000).nullable(),
  createdAt: z.string(),
});
export type Sake = z.infer<typeof sakeSchema>;

/** 作成リクエスト。アプリ側のフォームと API のバリデーションで共有する。 */
export const createSakeSchema = sakeSchema
  .pick({ name: true, type: true })
  .extend({
    brewery: z.string().max(100).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    memo: z.string().max(1000).optional(),
  });
export type CreateSakeInput = z.infer<typeof createSakeSchema>;
