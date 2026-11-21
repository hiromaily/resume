import { beforeEach, describe, expect, test } from "bun:test";
import { DuplicateEmailError, type ProjectInput, type Repositories } from "../src/db/ports";

/**
 * Tests for the repository contract (src/db/ports.ts).
 * When you add another DB implementation, run these by passing a function that creates it (test/db.test.ts).
 */
export function repositoryContract(name: string, create: () => Repositories) {
  describe(name, () => {
    let repos: Repositories;
    beforeEach(() => {
      repos = create();
    });

    const project = (startYm: string, company = "A"): ProjectInput => ({
      startYm,
      endYm: null,
      company: { ja: company, en: "" },
      projectName: { ja: `P ${startYm}`, en: "" },
      duties: { ja: "", en: "" },
      technologies: ["TypeScript"],
      positions: ["EM"],
    });

    describe("users", () => {
      test("作成したユーザーをメールアドレスで引ける", async () => {
        const u = await repos.users.create("a@example.com", "hash");
        expect((await repos.users.findByEmail("a@example.com"))?.id).toBe(u.id);
        expect((await repos.users.findById(u.id))?.email).toBe("a@example.com");
      });

      test("同じメールアドレスの2回目は DuplicateEmailError", async () => {
        await repos.users.create("a@example.com", "hash");
        await expect(repos.users.create("a@example.com", "hash")).rejects.toBeInstanceOf(DuplicateEmailError);
      });
    });

    test("sessions: 作成・取得・削除", async () => {
      const u = await repos.users.create("a@example.com", "hash");
      const s = await repos.sessions.create(u.id, "th", new Date("2026-11-07T00:00:00Z"));
      expect((await repos.sessions.findByTokenHash("th"))?.id).toBe(s.id);
      await repos.sessions.delete(s.id);
      expect(await repos.sessions.findByTokenHash("th")).toBeNull();
    });

    describe("resumes", () => {
      test("upsert を2回しても1行で、値は後のもの。配列は往復で保たれる", async () => {
        const u = await repos.users.create("a@example.com", "hash");
        const first = await repos.resumes.upsert(u.id, {
          fullName: { ja: "A", en: "" },
          skills: ["x"],
          certifications: { ja: [], en: [] },
          selfPr: { ja: "", en: "" },
        });
        const second = await repos.resumes.upsert(u.id, {
          fullName: { ja: "B", en: "" },
          skills: ["設計", "マネジメント"],
          certifications: { ja: ["AWS SAP"], en: [] },
          selfPr: { ja: "pr", en: "" },
        });
        expect(second.id).toBe(first.id);
        const got = await repos.resumes.findByUserId(u.id);
        expect(got?.fullName.ja).toBe("B");
        expect(got?.skills).toEqual(["設計", "マネジメント"]);
        expect(got?.certifications.ja).toEqual(["AWS SAP"]);
      });

      test("listProjects は start_ym の降順、同じなら後に作ったものが先", async () => {
        const u = await repos.users.create("a@example.com", "hash");
        const r = await repos.resumes.ensureForUser(u.id);
        await repos.resumes.createProject(r.id, project("2021-01"));
        const earlier = await repos.resumes.createProject(r.id, project("2023-04"));
        const later = await repos.resumes.createProject(r.id, project("2023-04"));
        const list = await repos.resumes.listProjects(r.id);
        expect(list.map((p) => p.id)).toEqual([later.id, earlier.id, list[2].id]);
        expect(list[2].startYm).toBe("2021-01");
        expect(list[0].positions).toEqual(["EM"]);
        expect(list[0].technologies).toEqual(["TypeScript"]);
      });

      test("別の resumeId では更新も削除もできない", async () => {
        const a = await repos.resumes.ensureForUser((await repos.users.create("a@example.com", "h")).id);
        const b = await repos.resumes.ensureForUser((await repos.users.create("b@example.com", "h")).id);
        const p = await repos.resumes.createProject(a.id, project("2021-01"));
        expect(await repos.resumes.updateProject(b.id, p.id, project("2022-01", "X"))).toBeNull();
        expect(await repos.resumes.deleteProject(b.id, p.id)).toBe(false);
        expect((await repos.resumes.findProject(a.id, p.id))?.company.ja).toBe("A");
      });
    });

    test("言語ごとの本文が往復で保たれる", async () => {
      const u = await repos.users.create("l@example.com", "h");
      const r = await repos.resumes.upsert(u.id, {
        fullName: { ja: "山田 太郎", en: "Taro Yamada" },
        skills: ["Go"],
        certifications: { ja: ["基本情報技術者"], en: ["FE"] },
        selfPr: { ja: "", en: "PR" },
      });
      expect(r.fullName).toEqual({ ja: "山田 太郎", en: "Taro Yamada" });
      expect(r.certifications.en).toEqual(["FE"]);
      expect(r.selfPr).toEqual({ ja: "", en: "PR" });
      const p = await repos.resumes.createProject(r.id, { ...project("2023-04"), company: { ja: "", en: "Acme" } });
      expect((await repos.resumes.findProject(r.id, p.id))?.company).toEqual({ ja: "", en: "Acme" });
    });

    test("ensureForUser で作った経歴書は両方の言語が空", async () => {
      const r = await repos.resumes.ensureForUser((await repos.users.create("m@example.com", "h")).id);
      expect(r.fullName).toEqual({ ja: "", en: "" });
      expect(r.certifications).toEqual({ ja: [], en: [] });
      expect(r.selfPr).toEqual({ ja: "", en: "" });
    });

    test("shareLinks.replace は古いハッシュを無効にする", async () => {
      const r = await repos.resumes.ensureForUser((await repos.users.create("a@example.com", "h")).id);
      await repos.shareLinks.replace(r.id, "h1");
      await repos.shareLinks.replace(r.id, "h2");
      expect(await repos.shareLinks.findByTokenHash("h1")).toBeNull();
      expect((await repos.shareLinks.findByTokenHash("h2"))?.resumeId).toBe(r.id);
      await repos.shareLinks.delete(r.id);
      expect(await repos.shareLinks.findByResumeId(r.id)).toBeNull();
    });

    test("ensureForUser は既存の経歴書を書き換えない", async () => {
      const u = await repos.users.create("e@example.com", "h");
      await repos.resumes.upsert(u.id, {
        fullName: { ja: "A", en: "" },
        skills: ["x"],
        certifications: { ja: [], en: [] },
        selfPr: { ja: "pr", en: "" },
      });
      const r = await repos.resumes.ensureForUser(u.id);
      expect(r.fullName.ja).toBe("A");
      expect(r.skills).toEqual(["x"]);
    });
  });
}
