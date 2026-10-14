import { Link } from "react-router";

import type { Route } from "./+types/home";
import { api } from "~/lib/api.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "日本酒を知らなくても、外さない一本を贈れる" },
    {
      name: "description",
      content: "場面と予算を選ぶだけ。日本酒好きの友達に、用語なしの説明を読んで一本を選んで贈れます。",
    },
  ];
}

export async function loader() {
  // サービスバインディング経由で API に届くことの確認。後で候補一覧などに置き換える。
  const res = await api.health.$get();
  const health = res.ok ? await res.json() : null;
  return { apiOk: health?.ok ?? false, apiEnv: health?.env ?? null };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 space-y-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold leading-tight">
          日本酒を知らなくても、
          <br />
          外さない一本を贈れる。
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          聞くのは場面と予算だけ。味や用語はこちらが引き受けます。
          相手はリンクを開いて住所を入れるだけで受け取れます。
        </p>
      </header>

      <Link
        to="/gift/new"
        className="inline-block rounded-full bg-gray-900 px-6 py-3 text-white dark:bg-white dark:text-gray-900"
      >
        贈る一本を選ぶ
      </Link>

      <p className="text-xs text-gray-400">
        API: {loaderData.apiOk ? `OK (${loaderData.apiEnv})` : "接続できません"}
      </p>
    </main>
  );
}
