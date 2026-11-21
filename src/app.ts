import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { authRoutes } from "./auth/routes";
import { sessionMiddleware } from "./auth/session";
import { chipRoutes } from "./chips/routes";
import type { AppConfig } from "./config";
import type { Repositories } from "./db/ports";
import { iconRoutes } from "./icons/routes";
import { resumeRoutes } from "./resume/routes";
import { shareRoutes } from "./share/routes";
import type { Translator } from "./translate/ports";
import type { AppEnv } from "./types";

export type AppDeps = {
  repos: Repositories;
  config: AppConfig;
  now?: () => Date;
  /** The translator implementation. If null or omitted, translation is disabled */
  translator?: Translator | null;
};

const HTMX_PATH = new URL("../node_modules/htmx.org/dist/htmx.min.js", import.meta.url).pathname;
const CSS_PATH = new URL("../public/app.css", import.meta.url).pathname;

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const now = deps.now ?? (() => new Date());
  const app = new Hono<AppEnv>();

  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );
  app.use(csrf());
  app.use(async (c, next) => {
    c.set("repos", deps.repos);
    c.set("now", now);
    c.set("translator", deps.translator ?? null);
    c.set("user", null);
    await next();
  });
  app.use(sessionMiddleware(deps.config));

  app.get(
    "/static/htmx.min.js",
    () =>
      new Response(Bun.file(HTMX_PATH), {
        headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=86400" },
      }),
  );
  app.get(
    "/static/app.css",
    () =>
      new Response(Bun.file(CSS_PATH), {
        headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" },
      }),
  );

  app.get("/", (c) => c.redirect(c.var.user ? "/resume" : "/login", 302));
  app.route("/", authRoutes(deps.config));
  app.route("/", resumeRoutes());
  app.route("/", iconRoutes());
  app.route("/", chipRoutes());
  app.route("/", shareRoutes());

  return app;
}
