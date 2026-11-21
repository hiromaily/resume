import { Hono } from "hono";
import type { AppEnv } from "../types";
import { iconBySlug, iconSvg } from "./index";

export function iconRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get("/icons/:file", (c) => {
    const file = c.req.param("file");
    const icon = file.endsWith(".svg") ? iconBySlug(file.slice(0, -4)) : null;
    if (!icon) return c.notFound();
    return c.body(iconSvg(icon), 200, {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    });
  });

  return routes;
}
