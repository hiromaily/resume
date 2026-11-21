import { Hono } from "hono";
import { requireAuth } from "../auth/session";
import type { AppEnv } from "../types";
import { applyPick, ChipInput, ChipSuggestions, isChipField } from "../views/chip-input";

export function chipRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use("/chips/*", requireAuth);

  routes.get("/chips/:field/suggest", (c) => {
    const field = c.req.param("field");
    if (!isChipField(field)) return c.notFound();
    return c.html(<ChipSuggestions field={field} query={c.req.query(`${field}_query`) ?? ""} />);
  });

  routes.get("/chips/:field/pick", (c) => {
    const field = c.req.param("field");
    if (!isChipField(field)) return c.notFound();
    const selected = applyPick(c.req.queries(field) ?? [], {
      pick: c.req.query("pick"),
      remove: c.req.query("remove"),
    });
    return c.html(<ChipInput field={field} selected={selected} autofocus />);
  });

  return routes;
}
