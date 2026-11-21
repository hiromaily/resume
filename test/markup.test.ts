import { expect, test } from "bun:test";
import { post, signupAndLogin, testApp } from "./helpers";

// Putting a <form> inside a <p> makes the browser close the <p> early, breaking the button layout
const formInsideP = /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<form\b/;

test("編集の画面と共有の画面で、<p> の中に <form> を置かない", async () => {
  const { app } = testApp();
  const { cookie } = await signupAndLogin(app);
  await post(app, "/resume/edit", { full_name: "A" }, { cookie });
  await post(
    app,
    "/resume/projects",
    { start_year: "2023", start_month: "04", current: "on", company: "A", project_name: "P" },
    { cookie },
  );
  await post(app, "/resume/share", {}, { cookie });
  for (const path of ["/resume/edit", "/resume/share"]) {
    const html = await (await app.request(path, { headers: { cookie } })).text();
    expect(html).not.toMatch(formInsideP);
  }
});
