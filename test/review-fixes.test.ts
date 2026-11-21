import { expect, test } from "bun:test";
import { post, signupAndLogin, testApp } from "./helpers";

test("同時に送ったログインの失敗も、5 回を超えたら止める", async () => {
  const { app } = testApp();
  await signupAndLogin(app);
  const results = await Promise.all(
    Array.from({ length: 30 }, () => post(app, "/login", { email: "a@example.com", password: "wrong-password-123" })),
  );
  const statuses = results.map((r) => r.status);
  expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
  expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(25);
});

test("経歴書の無い利用者が職務経歴の編集の URL を開いても、経歴書は作られない", async () => {
  const { app, repos } = testApp();
  const { cookie } = await signupAndLogin(app);
  expect((await app.request("/resume/projects/nope/edit", { headers: { cookie } })).status).toBe(404);
  expect((await app.request("/resume/projects", { headers: { cookie, "HX-Request": "true" } })).status).toBe(200);
  const user = await repos.users.findByEmail("a@example.com");
  expect(await repos.resumes.findByUserId(user?.id ?? "")).toBeNull();
  expect(await (await app.request("/resume", { headers: { cookie } })).text()).toContain("まだ経歴書がありません");
});

test("氏名の無い経歴書は共有できない", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  await post(
    app,
    "/resume/projects",
    { start_year: "2023", start_month: "04", current: "on", company: "A", project_name: "P" },
    { cookie },
  );
  const res = await post(app, "/resume/share", {}, { cookie });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("先に経歴書を作ってください");
});
