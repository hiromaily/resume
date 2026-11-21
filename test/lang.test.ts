import { expect, test } from "bun:test";
import { post, signupAndLogin, testApp } from "./helpers";

async function setup(opts: { en: boolean }) {
  const t = testApp();
  const { cookie } = await signupAndLogin(t.app);
  await post(
    t.app,
    "/resume/edit",
    {
      full_name: "山田 太郎",
      ...(opts.en ? { full_name_en: "Taro Yamada" } : {}),
      skills: "",
      certifications: "",
      self_pr: "",
    },
    { cookie },
  );
  await post(
    t.app,
    "/resume/projects",
    {
      start_year: "2023",
      start_month: "04",
      current: "on",
      company: "株式会社あかね",
      ...(opts.en ? { company_en: "Acme" } : {}),
      project_name: "P",
      duties: "d",
    },
    { cookie },
  );
  const res = await post(t.app, "/resume/share", {}, { cookie });
  const match = (await res.text()).match(/\/r\/([A-Za-z0-9_-]{43})/);
  if (!match) throw new Error("share url not found");
  return { ...t, cookie, url: `/r/${match[1]}` };
}

test("?lang=en は英語で出し、日本語の本文を出さない", async () => {
  const { app, url } = await setup({ en: true });
  const html = await (await app.request(`${url}?lang=en`)).text();
  expect(html).toContain('<html lang="en">');
  for (const s of ["Taro Yamada", "Work Experience", "Present", "Acme"]) expect(html).toContain(s);
  for (const s of ["山田 太郎", "スキル", "株式会社あかね"]) expect(html).not.toContain(s);
});

test("?lang=ja は日本語で出す", async () => {
  const { app, url } = await setup({ en: true });
  const html = await (await app.request(`${url}?lang=ja`)).text();
  expect(html).toContain('<html lang="ja">');
  expect(html).toContain("山田 太郎");
  expect(html).toContain("職務経歴");
  expect(html).not.toContain("Taro Yamada");
});

test("Accept-Language: en は英語の氏名があるときだけ英語", async () => {
  const headers = { "Accept-Language": "en-US,en" };
  const both = await setup({ en: true });
  expect(await (await both.app.request(both.url, { headers })).text()).toContain("Taro Yamada");
  const onlyJa = await setup({ en: false });
  const html = await (await onlyJa.app.request(onlyJa.url, { headers })).text();
  expect(html).toContain("山田 太郎");
  expect(html).toContain('<html lang="ja">');
});

test("日本語だけの経歴書を ?lang=en で開くと、見出しは英語で本文は空", async () => {
  const { app, url } = await setup({ en: false });
  const res = await app.request(`${url}?lang=en`);
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("Skills");
  expect(html).not.toContain("山田 太郎");
  expect(html).not.toContain("株式会社あかね");
});

test("切り替えのリンクが両方にあり、今の言語に aria-current が付く", async () => {
  const { app, url } = await setup({ en: true });
  const html = await (await app.request(`${url}?lang=en`)).text();
  expect(html).toContain('href="?lang=ja"');
  expect(html).toContain('href="?lang=en"');
  expect(html).toMatch(/aria-current="true"[^>]*>English|href="\?lang=en"[^>]*aria-current="true"/);
});

test("共有ページのヘッダーと、無効なトークンは今のまま", async () => {
  const { app, url } = await setup({ en: true });
  const res = await app.request(`${url}?lang=en`);
  expect(res.headers.get("x-robots-tag")).toBe("noindex");
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("vary")).toContain("Accept-Language");
  expect((await app.request(`/r/${"x".repeat(43)}?lang=en`)).status).toBe(404);
});

test("/resume?lang=en は経歴書の部分だけ英語で、ヘッダーと操作は日本語", async () => {
  const { app, cookie } = await setup({ en: true });
  const html = await (await app.request("/resume?lang=en", { headers: { cookie } })).text();
  expect(html).toContain('<html lang="en">');
  expect(html).toContain("Taro Yamada");
  expect(html).toContain("Work Experience");
  expect(html).toContain("ログアウト");
  expect(html).toContain("編集する");
  expect(html).toContain("<title>職務経歴書</title>");
});
