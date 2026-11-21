import { expect, test } from "bun:test";
import { hashToken } from "../src/auth/tokens";
import { cookieFrom, post, signupAndLogin, testApp } from "./helpers";

const PW = "correct-horse-battery";

test("サインアップするとセッションの Cookie が付き /resume へ送る", async () => {
  const { app } = testApp();
  const res = await post(app, "/signup", { email: "A@Example.com ", password: PW });
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe("/resume");
  const setCookie = res.headers.get("set-cookie") ?? "";
  expect(setCookie).toStartWith("sid=");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Lax");
});

test("DB にはセッションのトークンそのものではなくハッシュを保存する", async () => {
  const { app, repos } = testApp();
  const { cookie } = await signupAndLogin(app);
  const token = cookie.split("=")[1];
  expect(await repos.sessions.findByTokenHash(token)).toBeNull();
  expect(await repos.sessions.findByTokenHash(hashToken(token))).not.toBeNull();
});

test("パスワードが 11 文字なら 422", async () => {
  const res = await post(testApp().app, "/signup", { email: "a@example.com", password: "a".repeat(11) });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("12文字以上");
});

test("登録済みのメールアドレスでのサインアップは 422", async () => {
  const { app } = testApp();
  await signupAndLogin(app);
  const res = await post(app, "/signup", { email: "a@example.com", password: PW });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("既に使われています");
});

test("誤ったパスワードと存在しないメールアドレスは同じ文言の 401", async () => {
  const { app } = testApp();
  await signupAndLogin(app);
  const wrong = await post(app, "/login", { email: "a@example.com", password: "wrong-password-123" });
  const missing = await post(app, "/login", { email: "nobody@example.com", password: PW });
  expect(wrong.status).toBe(401);
  expect(missing.status).toBe(401);
  const msg = "メールアドレスまたはパスワードが違います";
  expect(await wrong.text()).toContain(msg);
  expect(await missing.text()).toContain(msg);
});

test("同じメールアドレスで 5 回失敗すると、6 回目は正しくても 429", async () => {
  const { app } = testApp();
  await signupAndLogin(app);
  for (let i = 0; i < 5; i++) await post(app, "/login", { email: "a@example.com", password: "wrong-password-123" });
  const res = await post(app, "/login", { email: "a@example.com", password: PW });
  expect(res.status).toBe(429);
});

test("正しいログインで新しいセッションが発行される", async () => {
  const { app } = testApp();
  const first = await signupAndLogin(app);
  const res = await post(app, "/login", { email: "a@example.com", password: PW });
  expect(res.status).toBe(303);
  expect(cookieFrom(res)).not.toBe(first.cookie);
});

test("ログイン済みなら GET / は /resume へ", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await app.request("/", { headers: { cookie } });
  expect(res.headers.get("location")).toBe("/resume");
});

test("期限が切れたセッションはログアウト扱い", async () => {
  const { app, clock } = testApp();
  const { cookie } = await signupAndLogin(app);
  clock.now = new Date(clock.now.getTime() + 7 * 24 * 60 * 60 * 1000 + 60 * 1000);
  const res = await app.request("/", { headers: { cookie } });
  expect(res.headers.get("location")).toBe("/login");
});

test("ログアウトの後、同じ Cookie はログアウト扱い", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const out = await post(app, "/logout", {}, { cookie });
  expect(out.status).toBe(303);
  const res = await app.request("/", { headers: { cookie } });
  expect(res.headers.get("location")).toBe("/login");
});

test("別のオリジンからの POST は 403", async () => {
  const res = await post(
    testApp().app,
    "/login",
    { email: "a@example.com", password: PW },
    { origin: "https://evil.example" },
  );
  expect(res.status).toBe(403);
});

test("ログインの画面を表示できる", async () => {
  const res = await testApp().app.request("/login");
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('action="/login"');
});

test("ログインが要るパスは、未ログインなら /login へ送る（htmx なら HX-Redirect と 401）", async () => {
  const { app } = testApp();
  const gets = [
    "/resume",
    "/resume/edit",
    "/resume/projects",
    "/resume/projects/period-end",
    "/resume/projects/positions",
    "/resume/projects/x/edit",
    "/resume/share",
    "/chips/technologies/suggest",
    "/chips/technologies/pick",
  ];
  const posts = [
    "/resume/edit",
    "/resume/projects",
    "/resume/projects/x",
    "/resume/projects/x/delete",
    "/resume/share",
    "/resume/share/delete",
  ];
  for (const path of gets) {
    const res = await app.request(path);
    expect([path, res.status, res.headers.get("location")]).toEqual([path, 302, "/login"]);
    const hx = await app.request(path, { headers: { "HX-Request": "true" } });
    expect([path, hx.status, hx.headers.get("HX-Redirect")]).toEqual([path, 401, "/login"]);
  }
  for (const path of posts) {
    const res = await post(app, path, {});
    expect([path, res.status, res.headers.get("location")]).toEqual([path, 302, "/login"]);
  }
});
