import { expect, test } from "bun:test";
import { otherLang, resolveLang } from "../src/i18n/lang";
import { MESSAGES } from "../src/i18n/messages";

const both = { ja: true, en: true };

test("resolveLang: クエリが最優先で、英語が空でも従う", () => {
  expect(resolveLang({ query: "en", acceptLanguage: "ja", hasName: { ja: true, en: false } })).toBe("en");
});

test("resolveLang: 不正なクエリは無視する", () => {
  expect(resolveLang({ query: "fr", acceptLanguage: undefined, hasName: both })).toBe("ja");
});

test("resolveLang: Accept-Language を見る", () => {
  expect(resolveLang({ query: undefined, acceptLanguage: "en-US,en;q=0.9,ja;q=0.8", hasName: both })).toBe("en");
  expect(resolveLang({ query: undefined, acceptLanguage: "ja;q=0.1,en;q=0.9", hasName: both })).toBe("en");
});

test("resolveLang: 英語の氏名が無ければ英語にしない", () => {
  expect(resolveLang({ query: undefined, acceptLanguage: "en-US,en;q=0.9", hasName: { ja: true, en: false } })).toBe(
    "ja",
  );
});

test("resolveLang: 氏名がある言語に倒す", () => {
  expect(resolveLang({ query: undefined, acceptLanguage: "ja,en;q=0.5", hasName: { ja: false, en: true } })).toBe("en");
});

test("resolveLang: 壊れた値でも落ちない", () => {
  expect(resolveLang({ query: undefined, acceptLanguage: ";;,q=", hasName: { ja: false, en: false } })).toBe("ja");
});

test("MESSAGES と otherLang", () => {
  expect(MESSAGES.ja.present).toBe("現在");
  expect(MESSAGES.en.present).toBe("Present");
  expect(MESSAGES.ja.projects).toBe("職務経歴");
  expect(MESSAGES.en.projects).toBe("Work Experience");
  expect(MESSAGES.ja.pageTitle("山田")).toBe("山田 の職務経歴書");
  expect(MESSAGES.ja.pageTitle("")).toBe("職務経歴書");
  expect(MESSAGES.en.pageTitle("Yamada")).toBe("Yamada — Résumé");
  expect(MESSAGES.en.pageTitle("")).toBe("Résumé");
  expect(otherLang("ja")).toBe("en");
  expect(otherLang("en")).toBe("ja");
});
