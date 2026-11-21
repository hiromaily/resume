import { expect, test } from "bun:test";
import { validateProjectInput } from "../src/resume/validation";
import { post, signupAndLogin, testApp } from "./helpers";

const entry = (overrides: Record<string, string | string[]> = {}) => ({
  start_year: "2023",
  start_month: "04",
  current: "on",
  end_year: "",
  end_month: "",
  company: "株式会社A",
  project_name: "決済基盤リプレイス",
  duties: "8名のチームのマネジメント",
  technologies: "TypeScript, AWS",
  positions: ["EM", "Tech Lead"],
  ...overrides,
});

async function setup() {
  const t = testApp();
  const { cookie } = await signupAndLogin(t.app);
  return { ...t, cookie };
}

test("新しい順に並ぶ", async () => {
  const { app, cookie } = await setup();
  await post(app, "/resume/projects", entry({ start_year: "2021", start_month: "01", company: "株式会社B" }), {
    cookie,
  });
  const res = await post(app, "/resume/projects", entry(), { cookie });
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe("/resume/edit");
  const html = await (await app.request("/resume", { headers: { cookie } })).text();
  expect(html.indexOf("2023/04")).toBeGreaterThan(-1);
  expect(html.indexOf("2023/04")).toBeLessThan(html.indexOf("2021/01"));
});

test("htmx の要求には一覧の部分だけを返す", async () => {
  const { app, cookie } = await setup();
  const res = await post(app, "/resume/projects", entry(), { cookie, "HX-Request": "true" });
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toStartWith('<section id="projects"');
  expect(html).not.toContain("<html");
});

test("複数のポジションがバッジで出る。一覧に無いポジションは 422", async () => {
  const { app, cookie } = await setup();
  await post(app, "/resume/projects", entry(), { cookie });
  const html = await (await app.request("/resume", { headers: { cookie } })).text();
  expect(html).toContain('<span class="pos pos-management">EM</span>');
  expect(html).toContain('<span class="pos pos-lead">Tech Lead</span>');
  const bad = await post(app, "/resume/projects", entry({ positions: "CEO" }), { cookie });
  expect(bad.status).toBe(422);
});

test("年月の形式が違えば 422 で、入力の値が残る", async () => {
  const { app, cookie } = await setup();
  const res = await post(app, "/resume/projects", entry({ start_year: "2024", start_month: "13" }), { cookie });
  expect(res.status).toBe(422);
  const html = await res.text();
  expect(html).toContain("開始の年と月を選んでください");
  expect(html).toContain('<option value="2024" selected=""');
});

test("終了が開始より前なら 422", async () => {
  const { app, cookie } = await setup();
  const res = await post(
    app,
    "/resume/projects",
    entry({ start_year: "2024", start_month: "05", current: [], end_year: "2024", end_month: "04" }),
    { cookie },
  );
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("終了は開始より後");
});

test("他人の職務経歴は見えず、変えられず、消せない", async () => {
  const { app, repos, cookie } = await setup();
  await post(app, "/resume/projects", entry(), { cookie });
  const a = await repos.users.findByEmail("a@example.com");
  const resume = await repos.resumes.findByUserId(a?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");
  const b = await signupAndLogin(app, "b@example.com");

  expect((await app.request(`/resume/projects/${p.id}/edit`, { headers: { cookie: b.cookie } })).status).toBe(404);
  expect((await post(app, `/resume/projects/${p.id}`, entry({ company: "X" }), { cookie: b.cookie })).status).toBe(404);
  expect((await post(app, `/resume/projects/${p.id}/delete`, {}, { cookie: b.cookie })).status).toBe(404);
  expect((await repos.resumes.findProject(resume?.id ?? "", p.id))?.company.ja).toBe("株式会社A");
});

test("編集と削除", async () => {
  const { app, repos, cookie } = await setup();
  await post(app, "/resume/projects", entry(), { cookie });
  const resume = await repos.resumes.findByUserId((await repos.users.findByEmail("a@example.com"))?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");

  const form = await app.request(`/resume/projects/${p.id}/edit`, { headers: { cookie, "HX-Request": "true" } });
  expect(form.status).toBe(200);
  expect(await form.text()).toContain('value="株式会社A"');

  await post(app, `/resume/projects/${p.id}`, entry({ company: "株式会社Z" }), { cookie });
  expect((await repos.resumes.findProject(resume?.id ?? "", p.id))?.company.ja).toBe("株式会社Z");

  const del = await post(app, `/resume/projects/${p.id}/delete`, {}, { cookie, "HX-Request": "true" });
  expect(del.status).toBe(200);
  expect(await del.text()).not.toContain("株式会社Z");
  expect(await repos.resumes.listProjects(resume?.id ?? "")).toEqual([]);
});

test("期間は年と月のプルダウンで、就業中のチェックボックスがある", async () => {
  const { app, cookie } = await setup();
  const html = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  expect(html).toContain('<select id="start_year" name="start_year"');
  expect(html).toContain('<select id="start_month" name="start_month"');
  expect(html).toContain('<option value="12">12</option>');
  expect(html).toContain('<option value="2026">2026</option>');
  expect(html).toContain('<option value="1970">1970</option>');
  expect(html).toMatch(/<select id="end_year" name="end_year"[^>]*><option value="">年<\/option>/);
  expect(html).toContain('type="checkbox" name="current"');
});

test("編集のフォームでは保存した年と月が選ばれている", async () => {
  const { app, repos, cookie } = await setup();
  await post(app, "/resume/projects", entry({ current: [], end_year: "2024", end_month: "09" }), { cookie });
  const resume = await repos.resumes.findByUserId((await repos.users.findByEmail("a@example.com"))?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");
  expect(p.endYm).toBe("2024-09");
  const html = await (
    await app.request(`/resume/projects/${p.id}/edit`, { headers: { cookie, "HX-Request": "true" } })
  ).text();
  expect(html).toMatch(/name="start_year"[\s\S]*?<option value="2023" selected=""/);
  expect(html).toMatch(/name="start_month"[\s\S]*?<option value="04" selected=""/);
  expect(html).toMatch(/name="end_month"[\s\S]*?<option value="09" selected=""/);
});

test("終了の年だけを選んで月が空なら 422", async () => {
  const { app, cookie } = await setup();
  const res = await post(app, "/resume/projects", entry({ current: [], end_year: "2024", end_month: "" }), { cookie });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("終了の年と月を選んでください");
});

test("就業中にチェックすると、終了の入力は無視して現在として保存する", async () => {
  const { app, repos, cookie } = await setup();
  await post(app, "/resume/projects", entry({ current: "on", end_year: "2024", end_month: "09" }), { cookie });
  const resume = await repos.resumes.findByUserId((await repos.users.findByEmail("a@example.com"))?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");
  expect(p.endYm).toBeNull();
});

test("就業中でなく終了も空なら 422", async () => {
  const { app, cookie } = await setup();
  const res = await post(app, "/resume/projects", entry({ current: [] }), { cookie });
  expect(res.status).toBe(422);
  expect(await res.text()).toContain("終了の年と月を選ぶか、就業中にチェックしてください");
});

test("就業中の切り替えで、終了のプルダウンを選べなくする／選べるようにする", async () => {
  const { app, cookie } = await setup();
  const headers = { cookie, "HX-Request": "true" };
  const on = await (await app.request("/resume/projects/period-end?current=on&end_year=2024", { headers })).text();
  expect(on).toMatch(/<select id="end_year" name="end_year"[^>]*disabled=""/);
  expect(on).toMatch(/<select id="end_month" name="end_month"[^>]*disabled=""/);
  const off = await (await app.request("/resume/projects/period-end?end_year=2024", { headers })).text();
  expect(off).not.toContain("disabled");
  expect(off).toContain('<option value="2024" selected=""');
});

test("就業中の職務経歴を編集するときは、チェックが付き、終了は選べない", async () => {
  const { app, repos, cookie } = await setup();
  await post(app, "/resume/projects", entry(), { cookie });
  const resume = await repos.resumes.findByUserId((await repos.users.findByEmail("a@example.com"))?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");
  const html = await (
    await app.request(`/resume/projects/${p.id}/edit`, { headers: { cookie, "HX-Request": "true" } })
  ).text();
  expect(html).toMatch(/name="current"[^>]*checked=""/);
  expect(html).toMatch(/<select id="end_year" name="end_year"[^>]*disabled=""/);
});

test("チップで選んだ技術と、入力欄に残った語の両方を保存する", async () => {
  const { app, repos, cookie } = await setup();
  await post(app, "/resume/projects", entry({ technologies: ["TypeScript", "React"], technologies_query: "AWS, Go" }), {
    cookie,
  });
  const resume = await repos.resumes.findByUserId((await repos.users.findByEmail("a@example.com"))?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");
  expect(p.technologies).toEqual(["TypeScript", "React", "AWS", "Go"]);
});

test("ポジションはグループ分けしたプルダウンから選び、チェックボックスは無い", async () => {
  const { app, cookie } = await setup();
  const html = await (await app.request("/resume/edit", { headers: { cookie } })).text();
  expect(html).not.toContain('type="checkbox" name="positions"');
  expect(html).toContain('<select id="positions" name="position_pick"');
  for (const label of ["エンジニア", "基盤・運用", "データ", "技術のリード", "マネジメント", "プロダクト"])
    expect(html).toContain(`<optgroup label="${label}">`);
  for (const p of ["Frontend Engineer", "Staff Engineer", "VPoE", "CTO", "DevOps Engineer", "Scrum Master"])
    expect(html).toContain(`<option value="${p}">${p}</option>`);
});

test("プルダウンで選んだポジションをチップに足し、×で外す", async () => {
  const { app, cookie } = await setup();
  const headers = { cookie, "HX-Request": "true" };
  // htmx sends the dropdown's own value first; even in that order, the result must follow the chosen order (appended at the end)
  const added = await (
    await app.request("/resume/projects/positions?position_pick=Tech%20Lead&positions=EM", { headers })
  ).text();
  const em = added.indexOf('<input type="hidden" name="positions" value="EM"');
  const tl = added.indexOf('<input type="hidden" name="positions" value="Tech Lead"');
  expect(em).toBeGreaterThan(-1);
  expect(tl).toBeGreaterThan(em);
  expect(added).not.toContain("selected");
  const removed = await (
    await app.request("/resume/projects/positions?positions=EM&positions=Tech%20Lead&remove=EM", { headers })
  ).text();
  expect(removed).not.toContain('<input type="hidden" name="positions" value="EM"');
  expect(removed).toContain('<input type="hidden" name="positions" value="Tech Lead"');
});

test("同じポジションを2回選んでも1つだけ保存する", async () => {
  const { app, repos, cookie } = await setup();
  await post(app, "/resume/projects", entry({ positions: ["EM", "EM", "Staff Engineer", ""] }), { cookie });
  const resume = await repos.resumes.findByUserId((await repos.users.findByEmail("a@example.com"))?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");
  expect(p.positions).toEqual(["EM", "Staff Engineer"]);
});

test("JS が無いときは、プルダウンで選んだポジションもそのまま保存する", async () => {
  const { app, repos, cookie } = await setup();
  await post(app, "/resume/projects", entry({ positions: ["EM"], position_pick: "CTO" }), { cookie });
  const resume = await repos.resumes.findByUserId((await repos.users.findByEmail("a@example.com"))?.id ?? "");
  const [p] = await repos.resumes.listProjects(resume?.id ?? "");
  expect(p.positions).toEqual(["EM", "CTO"]);
});

test("ポジションはチップとプルダウンの値を合わせ、重複と空を除く", () => {
  const form = {
    start_year: "2023",
    start_month: "04",
    current: "on",
    company: "A",
    project_name: "P",
    positions: ["EM", "Tech Lead"],
    position_pick: "EM",
  };
  const ok = validateProjectInput(form);
  expect(ok.ok && ok.value.positions).toEqual(["EM", "Tech Lead"]);
  const empty = validateProjectInput({ ...form, positions: [], position_pick: "" });
  expect(empty.ok && empty.value.positions).toEqual([]);
});

test("部分だけを返すルートは、htmx でない要求なら編集のページへ送る", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  for (const path of ["/resume/projects", "/resume/projects/period-end", "/resume/projects/positions"]) {
    const res = await app.request(path, { headers: { cookie } });
    expect([path, res.status, res.headers.get("location")]).toEqual([path, 303, "/resume/edit"]);
  }
});

test("英語だけの職務経歴を保存できる。両方空なら 422", async () => {
  const { app, cookie } = await setup();
  const ok = await post(
    app,
    "/resume/projects",
    entry({ company: "", project_name: "", company_en: "Acme", project_name_en: "Shop" }),
    { cookie },
  );
  expect(ok.status).toBe(303);
  const bad = await post(app, "/resume/projects", entry({ company: "", project_name: "" }), { cookie });
  expect(bad.status).toBe(422);
  const html = await bad.text();
  expect(html).toContain("会社名を日本語か英語のどちらかで入力してください");
  expect(html).toContain("プロジェクト名を日本語か英語のどちらかで入力してください");
});
