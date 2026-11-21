import type { Context } from "hono";
import { Hono } from "hono";
import { getConnInfo } from "hono/bun";
import type { AppConfig } from "../config";
import { DuplicateEmailError } from "../db/ports";
import type { AppEnv } from "../types";
import { Layout } from "../views/layout";
import { hashPassword, verifyPassword } from "./password";
import { createRateLimiter } from "./rate-limit";
import { endSession, startSession } from "./session";
import { normalizeEmail, validateCredentials } from "./validation";

const LOGIN_FAILED = "メールアドレスまたはパスワードが違います";

type FormProps = {
  mode: "signup" | "login";
  email?: string;
  errors?: Partial<Record<"email" | "password" | "form", string>>;
};

function CredentialsPage({ mode, email = "", errors = {} }: FormProps) {
  const title = mode === "signup" ? "ユーザー登録" : "ログイン";
  return (
    <Layout title={title}>
      <h1>{title}</h1>
      {errors.form ? <p class="error">{errors.form}</p> : null}
      <form method="post" action={`/${mode}`} class="card">
        <label for="email">メールアドレス</label>
        <input id="email" name="email" type="email" value={email} required autocomplete="email" />
        {errors.email ? <p class="error">{errors.email}</p> : null}
        <label for="password">パスワード（12文字以上）</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minlength={12}
          autocomplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {errors.password ? <p class="error">{errors.password}</p> : null}
        <p>
          <button type="submit" class="primary">
            {title}
          </button>
        </p>
      </form>
      {mode === "login" ? (
        <p>
          アカウントが無い場合は <a href="/signup">ユーザー登録</a>
        </p>
      ) : (
        <p>
          登録済みの場合は <a href="/login">ログイン</a>
        </p>
      )}
    </Layout>
  );
}

function clientIp(c: Context<AppEnv>): string {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function authRoutes(config: AppConfig): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

  routes.get("/signup", (c) => c.html(<CredentialsPage mode="signup" />));
  routes.get("/login", (c) => c.html(<CredentialsPage mode="login" />));

  routes.post("/signup", async (c) => {
    const result = validateCredentials(await c.req.parseBody());
    if (!result.ok) return c.html(<CredentialsPage mode="signup" email={result.email} errors={result.errors} />, 422);
    try {
      const user = await c.var.repos.users.create(result.email, await hashPassword(result.password));
      await startSession(c, config, user.id);
    } catch (e) {
      if (!(e instanceof DuplicateEmailError)) throw e;
      return c.html(
        <CredentialsPage
          mode="signup"
          email={result.email}
          errors={{ email: "このメールアドレスは既に使われています" }}
        />,
        422,
      );
    }
    return c.redirect("/resume", 303);
  });

  routes.post("/login", async (c) => {
    const body = await c.req.parseBody();
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    const now = c.var.now();
    const keys = [`email:${email}`, `ip:${clientIp(c)}`];
    if (keys.some((k) => limiter.isBlocked(k, now))) {
      return c.html(
        <CredentialsPage
          mode="login"
          email={email}
          errors={{ form: "試行の回数が多すぎます。しばらく待ってからやり直してください" }}
        />,
        429,
      );
    }
    // Count it as a failure before verifying (await). Counting afterwards would let concurrent requests all slip past the check
    for (const k of keys) limiter.recordFailure(k, now);
    const user = await c.var.repos.users.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return c.html(<CredentialsPage mode="login" email={email} errors={{ form: LOGIN_FAILED }} />, 401);
    }
    limiter.reset(keys[0]);
    limiter.forgive(keys[1]);
    await startSession(c, config, user.id);
    return c.redirect("/resume", 303);
  });

  routes.post("/logout", async (c) => {
    await endSession(c, config);
    return c.redirect("/login", 303);
  });

  return routes;
}
