import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";
import { createTranslator } from "../src/translate";
import { assertSameShape, TranslationError } from "../src/translate/ports";
import { fakeTranslator } from "./fake-translator";

describe("createTranslator", () => {
  test("未設定なら null（翻訳は無効）", () => {
    expect(createTranslator({ translator: undefined })).toBeNull();
  });
  test("未対応の名前は起動時に落とす", () => {
    expect(() => createTranslator({ translator: "deepl" })).toThrow("Unsupported TRANSLATOR: deepl");
  });
  test("TRANSLATOR の空文字は未設定と同じ", () => {
    expect(loadConfig({ TRANSLATOR: "" }).translator).toBeUndefined();
    expect(loadConfig({ TRANSLATOR: "claude-cli" }).translator).toBe("claude-cli");
  });
});

describe("assertSameShape", () => {
  test("同じ形ならそのまま返す", () => {
    expect(assertSameShape({ a: "x", b: ["1", "2"] }, { a: "X", b: ["一", "二"] })).toEqual({
      a: "X",
      b: ["一", "二"],
    });
  });
  test("形が違えば TranslationError", () => {
    expect(() => assertSameShape({ a: "x" }, { a: "X", extra: "y" })).toThrow(TranslationError);
    expect(() => assertSameShape({ a: "x", b: "y" }, { a: "X" })).toThrow(TranslationError);
    expect(() => assertSameShape({ b: ["1", "2"] }, { b: ["一"] })).toThrow(TranslationError);
    expect(() => assertSameShape({ a: "x" }, { a: 1 })).toThrow(TranslationError);
    expect(() => assertSameShape({ a: "x" }, { a: ["x"] })).toThrow(TranslationError);
    expect(() => assertSameShape({ b: ["1"] }, { b: [1] })).toThrow(TranslationError);
    expect(() => assertSameShape({ a: "x" }, "not an object")).toThrow(TranslationError);
    expect(() => assertSameShape({ a: "x" }, null)).toThrow(TranslationError);
    expect(() => assertSameShape({ a: "x" }, [])).toThrow(TranslationError);
  });
});

describe("fakeTranslator", () => {
  test("[to] を前に付け、呼び出しを記録する", async () => {
    const t = fakeTranslator();
    const out = await t.translate({ a: "x", b: ["1", "2"] }, "ja", "en");
    expect(out).toEqual({ a: "[en] x", b: ["[en] 1", "[en] 2"] });
    expect(t.calls).toEqual([{ texts: { a: "x", b: ["1", "2"] }, from: "ja", to: "en" }]);
  });
  test("fail なら TranslationError", async () => {
    await expect(fakeTranslator({ fail: true }).translate({ a: "x" }, "ja", "en")).rejects.toThrow(TranslationError);
  });
});
