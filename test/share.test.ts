import { expect, test } from "bun:test";
import { post, signupAndLogin, testApp } from "./helpers";

async function setupWithResume(duties = "8名のチームのマネジメント") {
  const t = testApp();
  const { cookie } = await signupAndLogin(t.app);
  await post(
    t.app,
    "/resume/edit",
    { full_name: "山田 太郎", skills: "", certifications: "", self_pr: "" },
    { cookie },
  );
  await post(
    t.app,
    "/resume/projects",
    { start_year: "2023", start_month: "04", current: "on", company: "A", project_name: "P", duties },
    { cookie },
  );
  return { ...t, cookie };
}

async function createLink(app: ReturnType<typeof testApp>["app"], cookie: string): Promise<string> {
  const res = await post(app, "/resume/share", {}, { cookie });
  expect(res.status).toBe(200);
  const match = (await res.text()).match(/\/r\/([A-Za-z0-9_-]{43})/);
  if (!match) throw new Error("share url not found");
  return `/r/${match[1]}`;
}

test("共有リンクはログインなしで閲覧でき、漏れを防ぐヘッダーが付く", async () => {
  const { app, cookie } = await setupWithResume();
  const url = await createLink(app, cookie);
  const res = await app.request(url);
  expect(res.status).toBe(200);
  expect(res.headers.get("x-robots-tag")).toBe("noindex");
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("cache-control")).toBe("no-store");
  const html = await res.text();
  expect(html).toContain("山田 太郎");
  expect(html).toContain('<meta name="robots" content="noindex"');
  expect(html).not.toContain("/logout");
  expect(html).not.toContain("/resume/edit");
});

test("作り直すと古い URL は 404、新しい URL は 200", async () => {
  const { app, cookie } = await setupWithResume();
  const old = await createLink(app, cookie);
  const fresh = await createLink(app, cookie);
  expect((await app.request(old)).status).toBe(404);
  expect((await app.request(fresh)).status).toBe(200);
});

test("止めると URL は 404 になり、状態は「共有していません」", async () => {
  const { app, cookie } = await setupWithResume();
  const url = await createLink(app, cookie);
  const res = await post(app, "/resume/share/delete", {}, { cookie });
  expect(res.status).toBe(303);
  expect((await app.request(url)).status).toBe(404);
  expect(await (await app.request("/resume/share", { headers: { cookie } })).text()).toContain("共有していません");
});

test("存在しないトークンと無効にしたトークンの 404 は同じ本文", async () => {
  const { app, cookie } = await setupWithResume();
  const old = await createLink(app, cookie);
  await createLink(app, cookie);
  const a = await (await app.request(old)).text();
  const b = await (await app.request(`/r/${"x".repeat(43)}`)).text();
  expect(a).toBe(b);
});

test("DB にはトークンそのものを保存しない", async () => {
  const { app, repos, cookie } = await setupWithResume();
  const token = (await createLink(app, cookie)).slice(3);
  expect(await repos.shareLinks.findByTokenHash(token)).toBeNull();
});

test("共有ページでも入力の HTML はエスケープされる", async () => {
  const { app, cookie } = await setupWithResume("<script>alert(1)</script>");
  const html = await (await app.request(await createLink(app, cookie))).text();
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>alert(1)");
});

test("経歴書が無ければ共有リンクを作れない", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await post(app, "/resume/share", {}, { cookie });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("先に経歴書を作ってください");
});

test("英語の氏名だけの経歴書でも共有リンクを作れる", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  await post(app, "/resume/edit", { full_name: "", full_name_en: "Taro Yamada" }, { cookie });
  const res = await post(app, "/resume/share", {}, { cookie });
  expect(res.status).toBe(200);
});
