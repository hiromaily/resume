import { createApp } from "../src/app";
import type { AppConfig } from "../src/config";
import { createSqliteRepositories } from "../src/db/sqlite";
import type { Translator } from "../src/translate/ports";

export const testConfig: AppConfig = {
  dbDriver: "sqlite",
  databaseUrl: ":memory:",
  port: 0,
  secureCookies: false,
  translator: undefined,
};

export function testApp({ translator }: { translator?: Translator | null } = {}) {
  const clock = { now: new Date("2026-10-31T00:00:00Z") };
  const repos = createSqliteRepositories(":memory:");
  const app = createApp({ repos, config: testConfig, now: () => clock.now, translator });
  return { app, repos, clock };
}

export const ORIGIN = "http://localhost";

export function form(data: Record<string, string | string[]>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) for (const item of [v].flat()) params.append(k, item);
  return params;
}

type App = ReturnType<typeof testApp>["app"];

export function post(
  app: App,
  path: string,
  data: Record<string, string | string[]>,
  headers: Record<string, string> = {},
) {
  return app.request(path, {
    method: "POST",
    body: form(data),
    headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded", ...headers },
  });
}

export function cookieFrom(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  return raw.split(";")[0];
}

export async function signupAndLogin(app: App, email = "a@example.com"): Promise<{ cookie: string }> {
  const res = await post(app, "/signup", { email, password: "correct-horse-battery" });
  if (res.status !== 303) throw new Error(`signup failed: ${res.status}`);
  return { cookie: cookieFrom(res) };
}
