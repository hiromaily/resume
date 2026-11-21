import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTranslator } from "../src/translate";
import { buildClaudeArgs, createClaudeCliTranslator, type Runner } from "../src/translate/claude-cli";
import { TranslationError } from "../src/translate/ports";

const outer = (result: string) => JSON.stringify({ type: "result", is_error: false, result });
const fake =
  (stdout: string, exitCode = 0): Runner =>
  async () => ({ exitCode, stdout, stderr: "SECRET 山田" });

describe("claude-cli translator", () => {
  test("result の JSON を取り出し、cmd と stdin を渡す", async () => {
    const calls: { cmd: string[]; stdin: string }[] = [];
    const run: Runner = async (cmd, opts) => {
      calls.push({ cmd, stdin: opts.stdin });
      return { exitCode: 0, stdout: outer('{"full_name":"Taro Yamada"}'), stderr: "" };
    };
    const t = createClaudeCliTranslator({ run });
    expect(await t.translate({ full_name: "山田 太郎" }, "ja", "en")).toEqual({ full_name: "Taro Yamada" });
    expect(calls[0]?.cmd).toEqual(buildClaudeArgs("claude"));
    expect(calls[0]?.cmd.join(" ")).not.toContain("山田");
    expect(calls[0]?.stdin).toContain("山田 太郎");
    expect(calls[0]?.stdin).toContain("English");
  });

  test("コードの囲い付きでも取り出せる", async () => {
    const t = createClaudeCliTranslator({ run: fake(outer('```json\n{"a":["x","y"]}\n```')) });
    expect(await t.translate({ a: ["あ", "い"] }, "ja", "en")).toEqual({ a: ["x", "y"] });
  });

  test("終了コードが 1 なら TranslationError（stderr は message に入れない）", async () => {
    const t = createClaudeCliTranslator({ run: fake("", 1) });
    const err = await t.translate({ a: "あ" }, "ja", "en").catch((e) => e);
    expect(err).toBeInstanceOf(TranslationError);
    expect(err.message).not.toContain("SECRET");
  });

  test("stdout が JSON でなければ TranslationError", async () => {
    const t = createClaudeCliTranslator({ run: fake("not json") });
    await expect(t.translate({ a: "あ" }, "ja", "en")).rejects.toBeInstanceOf(TranslationError);
  });

  test("result が JSON でなければ TranslationError", async () => {
    const t = createClaudeCliTranslator({ run: fake(outer("sorry")) });
    await expect(t.translate({ a: "あ" }, "ja", "en")).rejects.toBeInstanceOf(TranslationError);
  });

  test("キーが足りなければ TranslationError", async () => {
    const t = createClaudeCliTranslator({ run: fake(outer('{"a":"x"}')) });
    await expect(t.translate({ a: "あ", b: "い" }, "ja", "en")).rejects.toBeInstanceOf(TranslationError);
  });

  test("run が TranslationError を投げたらそのまま", async () => {
    const run: Runner = async () => {
      throw new TranslationError("timeout");
    };
    const t = createClaudeCliTranslator({ run });
    await expect(t.translate({ a: "あ" }, "ja", "en")).rejects.toThrow("timeout");
  });

  test("既定の runner は時間切れで子プロセスを止めて TranslationError", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-timeout-"));
    try {
      const script = join(dir, "slow.sh");
      writeFileSync(script, "#!/bin/sh\nsleep 5\n", { mode: 0o755 });
      const t = createClaudeCliTranslator({ command: script, timeoutMs: 200 });
      const started = Date.now();
      const err = await t.translate({ a: "あ" }, "ja", "en").catch((e) => e);
      expect(err).toBeInstanceOf(TranslationError);
      expect(err.message).toContain("timeout");
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("createTranslator が claude-cli を選べる", () => {
    expect(createTranslator({ translator: "claude-cli" })).not.toBeNull();
  });
});
