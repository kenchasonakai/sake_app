import { Layout } from "./layout.tsx";

type Props = {
  token: string;
  url: string;
};

/**
 * 受け取りリンク（/g/:token）。アプリ不要でここだけで完結させる。
 * TODO: token でギフトを引き、贈り主の一言・一本の説明・配送状況を表示する。
 *       成人確認と住所入力の送信先（POST /g/:token/claim）を実装する。
 */
export function ReceivePage({ token, url }: Props) {
  const title = "日本酒が届きます";
  const description =
    "友達からあなたに、一本の日本酒が贈られました。住所を入れるだけで受け取れます。";
  return (
    <Layout title={title} description={description} url={url}>
      <h1>{title}</h1>
      <p>{description}</p>

      <section class="card">
        <p class="muted">贈り主からの一言</p>
        <p>（ここに贈り主の一言と、選ばれた一本の説明が入ります）</p>
      </section>

      <form method="post" action={`/g/${token}/claim`}>
        <label>
          <input type="checkbox" name="adult" required /> 20歳以上です
        </label>
        <label>
          お届け先の住所
          <input type="text" name="address" required placeholder="〒100-0001 東京都千代田区…" />
        </label>
        <label>
          お名前
          <input type="text" name="name" required />
        </label>
        <button type="submit">受け取る</button>
      </form>

      <section class="card muted">
        <p>届いたあとは、アプリで飲んだ記録を残せます。記録を付けると、贈り主に「開けたよ」が一度だけ届きます。感想は自分だけの記録として残ります。</p>
      </section>
    </Layout>
  );
}
