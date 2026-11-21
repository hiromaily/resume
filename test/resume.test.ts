import { expect, test } from "bun:test";
import { formatPeriod } from "../src/views/resume-view";
import { post, signupAndLogin, testApp } from "./helpers";

const basics = (overrides: Record<string, string> = {}) => ({
  full_name: "山田 太郎",
  skills: "設計\nマネジメント\n",
  certifications: "AWS SAP",
  self_pr: "よろしくお願いします",
  ...overrides,
});

test("経歴書が無ければ作成を促す", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await app.request("/resume", { headers: { cookie } });
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("まだ経歴書がありません");
  expect(html).toContain('href="/resume/edit"');
});

test("基本の項目を保存すると閲覧に出る", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await post(app, "/resume/edit", basics(), { cookie });
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe("/resume/edit");
  const html = await (await app.request("/resume", { headers: { cookie } })).text();
  for (const s of ["山田 太郎", "設計", "マネジメント", "AWS SAP", "よろしくお願いします"]) expect(html).toContain(s);
});

test("氏名が空なら 422 で、他の入力は残る", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await post(app, "/resume/edit", basics({ full_name: "" }), { cookie });
  expect(res.status).toBe(422);
  const html = await res.text();
  expect(html).toContain("氏名を日本語か英語のどちらかで入力してください");
  expect(html).toContain("よろしくお願いします");
});

test("入力の HTML はエスケープされる", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  await post(app, "/resume/edit", basics({ full_name: "<script>alert(1)</script>" }), { cookie });
  const html = await (await app.request("/resume", { headers: { cookie } })).text();
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>alert(1)");
});

test("formatPeriod", () => {
  expect(formatPeriod("2023-04", null, "ja")).toBe("2023/04 – 現在");
  expect(formatPeriod("2023-04", null, "en")).toBe("2023/04 – Present");
  expect(formatPeriod("2016-04", "2020-12", "ja")).toBe("2016/04 – 2020/12");
});

test("ログインしていなければ編集の画面は /login へ", async () => {
  const res = await testApp().app.request("/resume/edit");
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/login");
});

test("スキルと資格はチップで入力し、保存したものはチップで出る", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  await post(
    app,
    "/resume/edit",
    {
      full_name: "A",
      skills: ["Golang", "設計"],
      skills_query: "マネジメント",
      certifications: ["AWS SAP"],
      certifications_query: "",
    },
    { cookie },
  );
  const html = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  for (const [name, value] of [
    ["skills", "Golang"],
    ["skills", "設計"],
    ["skills", "マネジメント"],
    ["certifications", "AWS SAP"],
  ])
    expect(html).toContain(`<input type="hidden" name="${name}" value="${value}"`);
  expect(html).toContain('name="skills_query"');
  expect(html).toContain('name="certifications_query"');
  expect(html).not.toContain('<textarea id="skills"');
});

test("スキルの候補には技術アイコンが出る", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const html = await (
    await app.request("/chips/skills/suggest?skills_query=Type", { headers: { cookie, "HX-Request": "true" } })
  ).text();
  expect(html).toContain('src="/icons/typescript.svg"');
  expect(html).toContain('hx-get="/chips/skills/pick"');
});

test("資格の候補は打った名前だけで、アイコンは出さない", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const q = encodeURIComponent("Go 言語認定");
  const html = await (
    await app.request(`/chips/certifications/suggest?certifications_query=${q}`, {
      headers: { cookie, "HX-Request": "true" },
    })
  ).text();
  expect(html).toContain('hx-vals="{&quot;pick&quot;:&quot;Go 言語認定&quot;}"');
  expect(html).not.toContain("<img");
});

test("チップの入力が無い項目は 404", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  expect((await app.request("/chips/full_name/suggest", { headers: { cookie } })).status).toBe(404);
});

test("候補は値が変わるたび（日本語入力・貼り付けを含む）に取りに行く", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const html = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  expect(html).toContain('name="certifications_query"');
  expect(html).not.toContain('hx-trigger="keyup changed delay:200ms"');
  expect(html).toContain('hx-trigger="input changed delay:200ms"');
});

test("英語だけで基本の項目を保存できる", async () => {
  const { app, repos } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await post(
    app,
    "/resume/edit",
    { full_name: "", full_name_en: "Taro Yamada", self_pr_en: "PR" },
    { cookie },
  );
  expect(res.status).toBe(303);
  const user = await repos.users.findByEmail("a@example.com");
  const resume = await repos.resumes.findByUserId(user?.id ?? "");
  expect(resume?.fullName).toEqual({ ja: "", en: "Taro Yamada" });
  expect(resume?.selfPr).toEqual({ ja: "", en: "PR" });
});

test("氏名が日本語も英語も空なら 422", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await post(app, "/resume/edit", { full_name: "", full_name_en: "" }, { cookie });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("氏名を日本語か英語のどちらかで入力してください");
});

test("英語の氏名が101文字なら 422", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await post(app, "/resume/edit", { full_name_en: "a".repeat(101) }, { cookie });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("氏名（英語）は100文字以内にしてください");
});

test("資格（英語）のチップと入力欄に残った語が合わさって保存される", async () => {
  const { app, repos } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await post(
    app,
    "/resume/edit",
    { full_name_en: "Taro", certifications_en: ["FE"], certifications_en_query: "AP" },
    { cookie },
  );
  expect(res.status).toBe(303);
  const user = await repos.users.findByEmail("a@example.com");
  const resume = await repos.resumes.findByUserId(user?.id ?? "");
  expect(resume?.certifications.en).toEqual(["FE", "AP"]);
  const suggest = await app.request("/chips/certifications_en/suggest?certifications_en_query=AP", {
    headers: { cookie },
  });
  expect(suggest.status).toBe(200);
});

test("編集画面に英語の入力欄があり、日本語の氏名は必須にしない", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const html = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  expect(html).toContain('name="full_name_en"');
  expect(html).toContain('name="company_en"');
  expect(html).not.toMatch(/<input[^>]*name="full_name"[^>]*required/);
  expect(html).not.toMatch(/<input[^>]*name="company"[^>]*required/);
});
