import type { Context, MiddlewareHandler } from "hono";

export function isHtmx(c: Context): boolean {
  return c.req.header("HX-Request") === "true";
}

/** Put this before routes that return only a fragment. If the request is not from htmx, redirect (303) to the page that contains the fragment */
export const htmxOnly =
  (page: string): MiddlewareHandler =>
  async (c, next) => {
    if (!isHtmx(c)) return c.redirect(page, 303);
    await next();
  };
