import { expect, test } from "bun:test";
import { applyDraft, pickSource } from "../src/resume/draft";
import { fakeTranslator } from "./fake-translator";
import { post, signupAndLogin, testApp } from "./helpers";

const HX = { "HX-Request": "true" };

async function setup(translator = fakeTranslator()) {
  const t = testApp({ translator });
  const { cookie } = await signupAndLogin(t.app);
  return { ...t, cookie, translator };
}

const project = {
  company: "A社",
  project_name: "P",
  duties: "職務",
  start_year: "2023",
  start_month: "04",
  current: "on",
  technologies: ["Go"],
};

test("pickSource は空を除いて基本の名前のキーで取り出す", () => {
  const values = { full_name: "山田", full_name_en: "", certifications: ["A"], self_pr: "", skills: ["Go"] };
  expect(pickSource(values, ["full_name", "certifications", "self_pr"], "ja")).toEqual({
    full_name: "山田",
    certifications: ["A"],
  });
  expect(pickSource(values, ["full_name"], "en")).toEqual({});
});

test("applyDraft は訳す先の項目だけを置き換える", () => {
  const values = { full_name: "山田", full_name_en: "old", skills: ["Go"] };
  expect(applyDraft(values, { full_name: "Yamada" }, "en")).toEqual({
    full_name: "山田",
    full_name_en: "Yamada",
    skills: ["Go"],
  });
});

test("基本の項目: 下書きを入れたページを返し、保存はしない", async () => {
  const { app, cookie, repos, translator } = await setup();
  const res = await post(
    app,
    "/resume/edit/draft",
    {
      full_name: "山田 太郎",
      self_pr: "自己PR",
      certifications: ["基本情報技術者"],
      full_name_en: "old",
      from: "ja",
      to: "en",
    },
    { cookie },
  );
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain('value="[en] 山田 太郎"');
  expect(html).toContain("[en] 自己PR");
  expect(html).toContain("[en] 基本情報技術者");
  expect(html).not.toContain('value="old"');
  expect(translator.calls[0]?.from).toBe("ja");
  const user = await repos.users.findByEmail("a@example.com");
  expect(await repos.resumes.findByUserId(user?.id ?? "")).toBeNull();
});

test("職務経歴の追加のフォーム（htmx）: 部分を返し、訳さない値は残り、保存はしない", async () => {
  const { app, cookie, repos } = await setup();
  const res = await post(app, "/resume/projects/draft", { ...project, from: "ja", to: "en" }, { cookie, ...HX });
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html.startsWith("<form")).toBe(true);
  expect(html).toContain("[en] A社");
  expect(html).toContain('action="/resume/projects"');
  expect(html).toContain('value="Go"');
  const user = await repos.users.findByEmail("a@example.com");
  const resume = await repos.resumes.findByUserId(user?.id ?? "");
  expect(resume ? await repos.resumes.listProjects(resume.id) : []).toEqual([]);
});

test("既存の1件（JS 無し）: ページ全体を返す。他人の ID は 404", async () => {
  const { app, cookie, repos } = await setup();
  await post(app, "/resume/projects", { ...project, company_en: "x" }, { cookie });
  const user = await repos.users.findByEmail("a@example.com");
  const resume = await repos.resumes.findByUserId(user?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");
  const res = await post(
    app,
    `/resume/projects/${p?.id}/draft`,
    { ...project, company_en: "Acme", from: "en", to: "ja" },
    { cookie },
  );
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("<html");
  expect(html).toContain("[ja] Acme");
  expect(html).toContain(`action="/resume/projects/${p?.id}"`);

  const other = await signupAndLogin(app, "b@example.com");
  const res2 = await post(
    app,
    `/resume/projects/${p?.id}/draft`,
    { ...project, from: "en", to: "ja" },
    { cookie: other.cookie },
  );
  expect(res2.status).toBe(404);
});

test("訳す元が全部空なら 422 で、翻訳を呼ばない", async () => {
  const { app, cookie, translator } = await setup();
  const res = await post(app, "/resume/edit/draft", { full_name_en: "only en", from: "ja", to: "en" }, { cookie });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("訳す元（日本語）が空です");
  expect(translator.calls).toEqual([]);
});

test("翻訳の失敗は 422 で、入力した値を残す", async () => {
  const { app, cookie } = await setup(fakeTranslator({ fail: true }));
  const res = await post(app, "/resume/projects/draft", { ...project, from: "ja", to: "en" }, { cookie, ...HX });
  expect(res.status).toBe(422);
  const html = await res.text();
  expect(html).toContain("下書きを作れませんでした。時間をおいてもう一度試してください");
  expect(html).toContain("A社");
});

test("to が ja・en 以外なら 400", async () => {
  const { app, cookie } = await setup();
  const res = await post(app, "/resume/edit/draft", { full_name: "山田", from: "ja", to: "fr" }, { cookie });
  expect(res.status).toBe(400);
});

test("翻訳が無効なら、3本とも 404 でボタンも出ない", async () => {
  const t = testApp();
  const { cookie } = await signupAndLogin(t.app);
  for (const path of ["/resume/edit/draft", "/resume/projects/draft", "/resume/projects/x/draft"]) {
    expect((await post(t.app, path, { full_name: "山田", from: "ja", to: "en" }, { cookie })).status).toBe(404);
  }
  const html = await (await t.app.request("/resume/edit", { headers: { cookie } })).text();
  expect(html).not.toContain("下書きを作る");
});

test("翻訳が有効なら、3種類のフォームの先頭に帯が出る（言語はプルダウン、ボタンは1つ）", async () => {
  const { app, cookie } = await setup();
  await post(app, "/resume/projects", project, { cookie });
  const html = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  expect(html).toContain('formaction="/resume/edit/draft"');
  expect(html).toContain('formaction="/resume/projects/draft"');
  expect(html).toContain("AI で翻訳の下書き");
  expect(html).toMatch(/<select name="from"[^>]*>.*?<option value="ja" selected="">日本語<\/option>/s);
  expect(html).toMatch(/<select name="to"[^>]*>.*?<option value="en" selected="">英語<\/option>/s);
  expect(html).not.toContain("英語の下書きを作る");
  const id = html.match(/\/resume\/projects\/([0-9a-f-]{36})\/edit/)?.[1];
  const edit = await (await app.request(`/resume/projects/${id}/edit`, { headers: { cookie, ...HX } })).text();
  expect(edit).toContain(`formaction="/resume/projects/${id}/draft"`);
  expect(edit).toContain(`hx-post="/resume/projects/${id}/draft"`);
  // Display while translating: add htmx-request to the form and disable the pressed button
  expect(edit).toContain('hx-indicator="closest form"');
  expect(edit).toContain('hx-disabled-elt="this"');
  expect(edit).toContain("訳しています…（10 秒ほど）");
  // The bar is at the top of the form (before the first input)
  expect(edit.indexOf("draft-bar")).toBeLessThan(edit.indexOf('name="company"'));
});

test("基本の項目の帯も htmx で送り、訳している間の表示を出す", async () => {
  const { app, cookie } = await setup();
  const html = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  const basics = html.split("<form").find((f) => f.includes('action="/resume/edit"')) ?? "";
  const go = /<button type="submit" class="draft-go"[^>]*>/.exec(basics)?.[0] ?? "";
  expect(go).toContain('hx-post="/resume/edit/draft"');
  expect(go).toContain('hx-target="closest form"');
  expect(go).toContain('hx-indicator="closest form"');
});

test("基本の項目の下書き（htmx）はフォームの部分を返す", async () => {
  const { app, cookie } = await setup();
  const res = await post(app, "/resume/edit/draft", { full_name: "山田", from: "ja", to: "en" }, { cookie, ...HX });
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html.startsWith("<form")).toBe(true);
  expect(html).toContain('action="/resume/edit"');
  expect(html).toContain('value="[en] 山田"');
});

test("Enter で押される最初の submit は保存（下書きのボタンではない）", async () => {
  const { app, cookie } = await setup();
  await post(app, "/resume/projects", project, { cookie });
  const firstSubmitIsSave = (html: string) => {
    const forms = html
      .split("<form")
      .slice(1)
      .filter((f) => f.includes("draft-bar"));
    for (const f of forms) {
      const first = /<button type="submit"[^>]*>/.exec(f)?.[0] ?? "";
      expect(first).not.toContain("formaction");
    }
    return forms.length;
  };
  const page = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  expect(firstSubmitIsSave(page)).toBeGreaterThanOrEqual(2); // basics and add
  const id = /\/resume\/projects\/([^/"]+)\/edit/.exec(page)?.[1];
  const partial = await (await app.request(`/resume/projects/${id}/edit`, { headers: { cookie, ...HX } })).text();
  expect(firstSubmitIsSave(partial)).toBe(1);
});

test("下書きを入れたら知らせ、入った欄に印を付け、選んだ言語を保つ", async () => {
  const { app, cookie } = await setup();
  const res = await post(app, "/resume/edit/draft", { full_name_en: "Taro", from: "en", to: "ja" }, { cookie });
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("下書きを入れました（英語 → 日本語）。確かめて直してから保存してください");
  expect(html).toMatch(/<input id="full_name" [^>]*class="drafted"/);
  expect(html).not.toMatch(/<input id="full_name_en" [^>]*class="drafted"/);
  expect(html).toMatch(/<select name="from"[^>]*>.*?<option value="en" selected="">英語<\/option>/s);
  expect(html).toMatch(/<select name="to"[^>]*>.*?<option value="ja" selected="">日本語<\/option>/s);
});

test("訳す元と訳す先が同じなら 422 で、翻訳を呼ばない", async () => {
  const { app, cookie, translator } = await setup();
  const res = await post(app, "/resume/projects/draft", { ...project, from: "ja", to: "ja" }, { cookie, ...HX });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("訳す元と訳す先に別の言語を選んでください");
  expect(translator.calls).toEqual([]);
});

test("from が ja・en 以外なら 400", async () => {
  const { app, cookie } = await setup();
  expect((await post(app, "/resume/edit/draft", { full_name: "山田", to: "en" }, { cookie })).status).toBe(400);
});

test("英語だけの職務経歴も、編集の一覧で会社名が見える", async () => {
  const { app, cookie } = await setup();
  await post(
    app,
    "/resume/projects",
    { ...project, company: "", company_en: "Acme Inc", project_name: "", project_name_en: "Pay" },
    { cookie },
  );
  const page = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  expect(page).toContain("Acme Inc");
});
