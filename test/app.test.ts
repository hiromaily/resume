import { expect, test } from "bun:test";
import { testApp } from "./helpers";

test("GET / はログインしていなければ /login へ送る", async () => {
  const { app } = testApp();
  const res = await app.request("/");
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/login");
});

test("htmx を自分のサーバーから配る", async () => {
  const res = await testApp().app.request("/static/htmx.min.js");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("javascript");
});

test("CSP は self だけを許す", async () => {
  const res = await testApp().app.request("/login");
  expect(res.headers.get("content-security-policy")).toContain("script-src 'self'");
});

test("CSS は毎回サーバーに確かめさせる（直した CSS がキャッシュで隠れない）", async () => {
  const res = await testApp().app.request("/static/app.css");
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-cache");
});

test("CSS の URL には中身の版が付く（古いキャッシュの CSS を使わせない）", async () => {
  const html = await (await testApp().app.request("/login")).text();
  const href = html.match(/href="(\/static\/app\.css[^"]*)"/)?.[1] ?? "";
  expect(href).toMatch(/^\/static\/app\.css\?v=[0-9a-z]+$/);
  expect((await testApp().app.request(href)).status).toBe(200);
});
