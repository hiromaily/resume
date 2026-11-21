import { expect, test } from "bun:test";
import { resolveIcon, suggestIcons } from "../src/icons";
import { applyPick } from "../src/views/chip-input";
import { post, signupAndLogin, testApp } from "./helpers";

test("技術名からアイコンを引く", () => {
  expect(resolveIcon("TypeScript")?.slug).toBe("typescript");
  expect(resolveIcon("Node.js")?.slug).toBe("nodedotjs");
  expect(resolveIcon("C++")?.slug).toBe("cplusplus");
  expect(resolveIcon("社内フレームワーク")).toBeNull();
});

test("前方一致を先に出す", () => {
  expect(suggestIcons("type")[0].slug).toBe("typescript");
});

test("アイコンの SVG をブランドの色で返す", async () => {
  const res = await testApp().app.request("/icons/typescript.svg");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("image/svg+xml");
  expect(await res.text()).toContain('fill="#3178C6"');
});

test("無いアイコンは 404", async () => {
  expect((await testApp().app.request("/icons/nope.svg")).status).toBe(404);
});

test("経歴書ではアイコンがあれば画像、無ければ文字のバッジ", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  await post(
    app,
    "/resume/projects",
    {
      start_year: "2023",
      start_month: "04",
      current: "on",
      company: "A",
      project_name: "P",
      technologies: "TypeScript, 社内フレームワーク",
    },
    { cookie },
  );
  const html = await (await app.request("/resume", { headers: { cookie } })).text();
  expect(html).toContain('src="/icons/typescript.svg"');
  expect(html).toContain("社内フレームワーク");
});

test("入力の最後の語で候補を出す", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  const res = await app.request(`/chips/technologies/suggest?technologies_query=${encodeURIComponent("Go, Type")}`, {
    headers: { cookie },
  });
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("TypeScript");
});

test("よくある別名でもアイコンを引ける", () => {
  expect(resolveIcon("Golang")?.slug).toBe("go");
  expect(resolveIcon("k8s")?.slug).toBe("kubernetes");
  expect(resolveIcon("Postgres")?.slug).toBe("postgresql");
  expect(resolveIcon("Node")?.slug).toBe("nodedotjs");
  expect(resolveIcon("JS")?.slug).toBe("javascript");
  expect(resolveIcon("TS")?.slug).toBe("typescript");
});

test("別名で打っても候補に出る", () => {
  expect(suggestIcons("golang")[0]?.slug).toBe("go");
});

test("候補を選ぶと選んだ技術に足し、×で外せる。大文字・小文字の違う重複は足さない", () => {
  expect(applyPick(["TypeScript"], { pick: "React" })).toEqual(["TypeScript", "React"]);
  expect(applyPick(["TypeScript"], { pick: "typescript" })).toEqual(["TypeScript"]);
  expect(applyPick(["TypeScript", "React"], { remove: "TypeScript" })).toEqual(["React"]);
});

async function login() {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  return { app, headers: { cookie, "HX-Request": "true" } };
}

test("候補はクリックできるボタンで、選んだ名前を送る", async () => {
  const { app, headers } = await login();
  const html = await (await app.request("/chips/technologies/suggest?technologies_query=Rea", { headers })).text();
  expect(html).toContain('hx-get="/chips/technologies/pick"');
  expect(html).toContain('hx-vals="{&quot;pick&quot;:&quot;React&quot;}"');
});

test("候補をクリックすると、チップに足して入力欄を空にした部分を返す", async () => {
  const { app, headers } = await login();
  const html = await (
    await app.request("/chips/technologies/pick?technologies=TypeScript&technologies_query=Rea&pick=React", { headers })
  ).text();
  expect(html).toContain('<input type="hidden" name="technologies" value="TypeScript"');
  expect(html).toContain('<input type="hidden" name="technologies" value="React"');
  expect(html).toMatch(/<input id="technologies" name="technologies_query" value=""/);
  expect(html).toContain('<ul class="suggest"></ul>');
});

test("×を押すと、その技術を外した部分を返す", async () => {
  const { app, headers } = await login();
  const html = await (
    await app.request("/chips/technologies/pick?technologies=TypeScript&technologies=React&remove=TypeScript", {
      headers,
    })
  ).text();
  expect(html).not.toContain('value="TypeScript"');
  expect(html).toContain('value="React"');
});

test("アイコンの無い技術も、打った語を候補に出す", async () => {
  const { app, headers } = await login();
  const html = await (await app.request("/chips/technologies/suggest?technologies_query=AWS", { headers })).text();
  expect(html).toContain('hx-vals="{&quot;pick&quot;:&quot;AWS&quot;}"');
});
