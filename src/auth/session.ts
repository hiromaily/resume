import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppConfig } from "../config";
import type { User } from "../db/ports";
import { isHtmx } from "../html";
import type { AppEnv } from "../types";
import { generateToken, hashToken } from "./tokens";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionCookieName(config: AppConfig): string {
  return config.secureCookies ? "__Host-sid" : "sid";
}

export function sessionMiddleware(config: AppConfig): MiddlewareHandler<AppEnv> {
  const name = sessionCookieName(config);
  return async (c, next) => {
    const token = getCookie(c, name);
    if (token) {
      const { sessions, users } = c.var.repos;
      const session = await sessions.findByTokenHash(hashToken(token));
      if (session && new Date(session.expiresAt) > c.var.now()) {
        c.set("user", await users.findById(session.userId));
      } else if (session) {
        await sessions.delete(session.id);
      }
    }
    await next();
  };
}

export async function startSession(c: Context<AppEnv>, config: AppConfig, userId: string): Promise<void> {
  await endSession(c, config);
  const token = generateToken();
  const expiresAt = new Date(c.var.now().getTime() + SESSION_TTL_MS);
  await c.var.repos.sessions.create(userId, hashToken(token), expiresAt);
  setCookie(c, sessionCookieName(config), token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: config.secureCookies,
    expires: expiresAt,
  });
}

export async function endSession(c: Context<AppEnv>, config: AppConfig): Promise<void> {
  const name = sessionCookieName(config);
  const token = getCookie(c, name);
  if (!token) return;
  const session = await c.var.repos.sessions.findByTokenHash(hashToken(token));
  if (session) await c.var.repos.sessions.delete(session.id);
  deleteCookie(c, name, { path: "/", secure: config.secureCookies });
}

/** Gets the logged-in user, after requireAuth. Throws if requireAuth did not run first (a programming error) */
export function currentUser(c: Context<AppEnv>): User {
  if (!c.var.user) throw new Error("currentUser() は requireAuth の後ろでだけ呼ぶ");
  return c.var.user;
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.var.user) return next();
  if (isHtmx(c)) {
    c.header("HX-Redirect", "/login");
    return c.body(null, 401);
  }
  return c.redirect("/login", 302);
};
