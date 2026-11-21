import { readFileSync } from "node:fs";
import type { Child } from "hono/jsx";
import type { Lang } from "../i18n/lang";

/** A version derived from the CSS content. When the content changes the URL changes, so browsers do not use a stale cache */
const CSS_VERSION = Bun.hash(readFileSync(new URL("../../public/app.css", import.meta.url))).toString(36);

const HTMX_CONFIG = JSON.stringify({
  includeIndicatorStyles: false,
  responseHandling: [
    { code: "204", swap: false },
    { code: "[23]..", swap: true },
    { code: "422", swap: true },
    { code: "[45]..", swap: false, error: true },
  ],
});

type Props = {
  title: string;
  user?: { email: string } | null;
  noindex?: boolean;
  lang?: Lang;
  children?: Child;
};

export function Layout({ title, user, noindex, lang = "ja", children }: Props) {
  return (
    <html lang={lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {noindex ? <meta name="robots" content="noindex" /> : null}
        <meta name="htmx-config" content={HTMX_CONFIG} />
        <title>{title}</title>
        <link rel="stylesheet" href={`/static/app.css?v=${CSS_VERSION}`} />
        <script src="/static/htmx.min.js" defer></script>
      </head>
      <body>
        <header class="site-header">
          <a href="/" class="brand">
            職務経歴書
          </a>
          {user ? (
            <nav>
              <span class="muted">{user.email}</span>
              <form method="post" action="/logout" class="inline">
                <button type="submit">ログアウト</button>
              </form>
            </nav>
          ) : null}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
