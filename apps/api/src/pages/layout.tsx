import type { PropsWithChildren } from "hono/jsx";

type Props = PropsWithChildren<{
  title: string;
  description: string;
  /** OGP 用。LINE などで貼られた時のプレビューに使う */
  ogImage?: string;
  url: string;
}>;

/** 受け取りリンクなど、アプリ不要でブラウザだけで完結させるページの共通枠。 */
export function Layout({ title, description, ogImage, url, children }: Props) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        <style>{css}</style>
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}

const css = `
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; line-height: 1.6; }
  main { max-width: 36rem; margin: 0 auto; padding: 3rem 1rem; }
  h1 { font-size: 1.5rem; line-height: 1.3; }
  .muted { opacity: .7; font-size: .9rem; }
  .card { border: 1px solid rgba(128,128,128,.35); border-radius: 1rem; padding: 1rem 1.25rem; margin: 1.5rem 0; }
  label { display: block; margin: .75rem 0; }
  input[type=text] { width: 100%; box-sizing: border-box; padding: .6rem .75rem; border: 1px solid rgba(128,128,128,.5); border-radius: .5rem; font: inherit; }
  button { font: inherit; padding: .75rem 1.5rem; border-radius: 999px; border: 0; background: #111; color: #fff; }
  @media (prefers-color-scheme: dark) { button { background: #fff; color: #111; } }
`;
