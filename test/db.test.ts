import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRepositories } from "../src/db";
import { createSqliteRepositories } from "../src/db/sqlite";
import { repositoryContract } from "./repository-contract";

repositoryContract("sqlite", () => createSqliteRepositories(":memory:"));

test("未対応の DB_DRIVER はエラー", () => {
  expect(() => createRepositories({ dbDriver: "mysql", databaseUrl: "" })).toThrow("Unsupported DB_DRIVER: mysql");
});

test("古いスキーマ（*_en の無い DB）を開くと列が足され、日本語の本文は保たれる", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "resume-db-")), "old.sqlite");
  // The resumes / projects definitions before the *_en columns were added
  const old = new Database(path, { strict: true });
  old.run(
    `CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)`,
  );
  old.run(`CREATE TABLE resumes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    skills TEXT NOT NULL,
    certifications TEXT NOT NULL,
    self_pr TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  old.run(`CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    start_ym TEXT NOT NULL,
    end_ym TEXT,
    company TEXT NOT NULL,
    project_name TEXT NOT NULL,
    duties TEXT NOT NULL,
    technologies TEXT NOT NULL,
    positions TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  old.run(`INSERT INTO users VALUES ('u1', 'o@example.com', 'h', 't')`);
  old.run(`INSERT INTO resumes VALUES ('r1', 'u1', '山田', '[]', '["基本情報技術者"]', 'pr', 't')`);
  old.run(`INSERT INTO projects VALUES ('p1', 'r1', '2023-04', NULL, 'A社', 'P', '職務', '[]', '[]', 't')`);
  old.close();

  // The second time the columns already exist, so nothing is added (must not fail)
  for (let i = 0; i < 2; i++) {
    const repos = createSqliteRepositories(path);
    expect(await repos.resumes.findById("r1")).toMatchObject({
      fullName: { ja: "山田", en: "" },
      certifications: { ja: ["基本情報技術者"], en: [] },
      selfPr: { ja: "pr", en: "" },
    });
    expect(await repos.resumes.findProject("r1", "p1")).toMatchObject({
      company: { ja: "A社", en: "" },
      duties: { ja: "職務", en: "" },
    });
    repos.close();
  }
});
