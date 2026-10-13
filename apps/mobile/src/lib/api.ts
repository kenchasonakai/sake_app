import { hc } from 'hono/client';
import type { AppType } from '@sake/api';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5173';

/**
 * API の型付きクライアント。
 * `AppType` は apps/api が `pnpm build:types` で出力した型定義から読む。
 * 認証を入れたら `headers` にセッション Cookie を載せる。
 */
export const api = hc<AppType>(baseUrl);

export type Api = typeof api;
