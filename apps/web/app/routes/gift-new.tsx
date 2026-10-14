import { Form } from "react-router";

import type { Route } from "./+types/gift-new";

export function meta({}: Route.MetaArgs) {
  return [{ title: "贈る一本を選ぶ" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return {
    occasion: url.searchParams.get("occasion") ?? "",
    budget: url.searchParams.get("budget") ?? "",
  };
}

/**
 * 贈る流れの雛形。
 * 1. 場面と予算（必須）、相手の好み（任意、既定は「分からない」）
 * 2. API が候補を 2〜3 本返す（未実装）
 * 3. 一本を決めて一言を書くと受け取りリンクが発行される（未実装）
 */
export default function GiftNew({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 space-y-8">
      <h1 className="text-2xl font-bold">贈る一本を選ぶ</h1>

      <Form method="get" className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="font-semibold">場面</legend>
          {[
            ["birthday", "誕生日"],
            ["thanks", "お礼"],
            ["casual", "なんとなく"],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="occasion"
                value={value}
                defaultChecked={loaderData.occasion === value}
                required
              />
              {label}
            </label>
          ))}
        </fieldset>

        <label className="block space-y-2">
          <span className="font-semibold">予算（円）</span>
          <input
            type="number"
            name="budget"
            min={1000}
            step={500}
            defaultValue={loaderData.budget}
            required
            className="block w-full rounded border px-3 py-2 dark:bg-gray-900"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-gray-900 px-6 py-3 text-white dark:bg-white dark:text-gray-900"
        >
          候補を見る
        </button>
      </Form>

      {loaderData.occasion && loaderData.budget && (
        <p className="text-gray-500">
          候補の選定はまだ実装していません（場面: {loaderData.occasion}、予算: {loaderData.budget}円）。
        </p>
      )}
    </main>
  );
}
