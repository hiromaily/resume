import { expect, test } from "bun:test";
import { fakeTranslator } from "./fake-translator";
import { post, signupAndLogin, testApp } from "./helpers";

// Snapshots of each page's full HTML. Confirms that changes meant not to alter the look (refactoring) leave the HTML unchanged.
// When you change the look, read the diff and, if it is as intended, rewrite with `bun test --update-snapshots`

/** Replaces values that change on every run (IDs, share tokens, the CSS version, the list of years from this year) with fixed text */
const normalize = (html: string) =>
  html
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/\/r\/[A-Za-z0-9_-]+/g, "/r/<token>")
    .replace(/app\.css\?v=[^"]+/g, "app.css?v=<version>")
    .replace(/<option value="\d{4}">\d{4}<\/option>/g, "");

async function setup() {
  const t = testApp();
  const { cookie } = await signupAndLogin(t.app);
  await post(
    t.app,
    "/resume/edit",
    { full_name: "山田 太郎", skills: ["TypeScript", "Go"], certifications: ["基本情報技術者"], self_pr: "自己PR" },
    { cookie },
  );
  await post(
    t.app,
    "/resume/projects",
    {
      start_year: "2023",
      start_month: "04",
      current: "on",
      company: "A社",
      project_name: "P",
      duties: "職務",
      technologies: ["React", "AWS"],
      positions: ["EM", "Tech Lead"],
    },
    { cookie },
  );
  const page = async (path: string, headers: Record<string, string> = {}) =>
    normalize(await (await t.app.request(path, { headers: { cookie, ...headers } })).text());
  const partial = (path: string) => page(path, { "HX-Request": "true" });
  return { ...t, cookie, page, partial };
}

test("ログインとユーザー登録のページ", async () => {
  const { app } = testApp();
  expect(normalize(await (await app.request("/login")).text())).toMatchSnapshot();
  expect(normalize(await (await app.request("/signup")).text())).toMatchSnapshot();
});

test("経歴書の閲覧と編集のページ", async () => {
  const { page } = await setup();
  expect(await page("/resume")).toMatchSnapshot();
  expect(await page("/resume/edit")).toMatchSnapshot();
});

test("職務経歴の部分（一覧・編集のフォーム・期間・ポジション）", async () => {
  const { app, cookie, partial, repos } = await setup();
  const user = await repos.users.findByEmail("a@example.com");
  const resume = await repos.resumes.findByUserId(user?.id ?? "");
  const [project] = await repos.resumes.listProjects(resume?.id ?? "");
  expect(await partial("/resume/projects")).toMatchSnapshot();
  expect(await partial(`/resume/projects/${project.id}/edit`)).toMatchSnapshot();
  expect(await partial("/resume/projects/period-end?current=on&end_year=2024&end_month=03")).toMatchSnapshot();
  expect(await partial("/resume/projects/period-end?end_year=2024&end_month=03")).toMatchSnapshot();
  expect(await partial("/resume/projects/positions?positions=EM&position_pick=QA")).toMatchSnapshot();
  const invalid = await post(
    app,
    "/resume/projects",
    { start_year: "2023", start_month: "04", company: "", project_name: "P", positions: ["EM", "XX"] },
    { cookie, "HX-Request": "true" },
  );
  expect(invalid.status).toBe(422);
  expect(normalize(await invalid.text())).toMatchSnapshot();
});

test("チップの入力の部分（候補・追加・削除）", async () => {
  const { partial } = await setup();
  expect(await partial("/chips/technologies/suggest?technologies_query=Rea")).toMatchSnapshot();
  expect(await partial("/chips/certifications/suggest?certifications_query=基本")).toMatchSnapshot();
  expect(await partial("/chips/technologies/pick?technologies=TypeScript&pick=React")).toMatchSnapshot();
  expect(await partial("/chips/skills/pick?skills=TypeScript&skills=Go&remove=Go")).toMatchSnapshot();
});

test("共有リンクの管理と共有ページ", async () => {
  const { app, cookie, page } = await setup();
  expect(await page("/resume/share")).toMatchSnapshot();
  const created = await post(app, "/resume/share", {}, { cookie });
  const html = await created.text();
  expect(normalize(html)).toMatchSnapshot();
  const sharePath = html.match(/\/r\/[A-Za-z0-9_-]+/)?.[0] ?? "";
  expect(normalize(await (await app.request(sharePath)).text())).toMatchSnapshot();
  expect(normalize(await (await app.request(`${sharePath}?lang=en`)).text())).toMatchSnapshot();
});

test("翻訳が有効なときの編集のページ（下書きのボタンが出る）", async () => {
  const t = testApp({ translator: fakeTranslator() });
  const { cookie } = await signupAndLogin(t.app);
  const html = await (await t.app.request("/resume/edit", { headers: { cookie } })).text();
  expect(normalize(html)).toMatchSnapshot();
});
