import type { Route } from "./+types/gift-receive";

export function meta({ loaderData }: Route.MetaArgs) {
  // LINE などのプレビュー用 OGP。贈り主と一本の情報は後で API から引く。
  return [
    { title: loaderData.title },
    { property: "og:title", content: loaderData.title },
    { property: "og:description", content: loaderData.description },
    { property: "og:type", content: "website" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  // TODO: params.token でギフトを引く。見つからなければ 404。
  return {
    token: params.token,
    title: "日本酒が届きます",
    description: "友達からあなたに、一本の日本酒が贈られました。リンクを開いて住所を入れるだけで受け取れます。",
  };
}

/**
 * 受け取りリンクの雛形。アプリ不要でここだけで完結させる。
 * - 贈り主の一言と一本の説明
 * - 成人確認
 * - 住所入力
 * - 届くまでの配送状況、届いた後にできること（記録、開けたよ）の説明
 */
export default function GiftReceive({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 space-y-8">
      <h1 className="text-2xl font-bold">{loaderData.title}</h1>
      <p className="text-gray-600 dark:text-gray-300">{loaderData.description}</p>
      <p className="text-xs text-gray-400">token: {loaderData.token}</p>
    </main>
  );
}
