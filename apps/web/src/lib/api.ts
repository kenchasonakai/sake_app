import { env } from "cloudflare:workers";
import { hc } from "hono/client";
import type { AppType } from "@sake/api";

/**
 * API の型付きクライアント。
 *
 * - サービスバインディング env.API を fetch として渡すので、URL のホスト部分は
 *   経路の決定には使われない。ただし開発時は API 側の Vite 開発サーバーが Host を
 *   検査する（許可外のホストは 403）ため、既定で許可される localhost にしておく。
 * - 開発時、相手の Worker が起きた直後の 1〜2 リクエストが
 *   "Network connection lost" で落ちることがあるので、GET に限り 1 回だけ再試行する。
 */
const RETRIES = 1;

async function fetchViaBinding(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  for (let attempt = 0; ; attempt++) {
    try {
      return await env.API.fetch(input, init);
    } catch (e) {
      if (method !== "GET" || attempt >= RETRIES) throw e;
    }
  }
}

export const api = hc<AppType>("http://localhost", { fetch: fetchViaBinding });
