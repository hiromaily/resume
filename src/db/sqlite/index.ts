import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  DuplicateEmailError,
  type Project,
  type ProjectInput,
  type Repositories,
  type Resume,
  type ResumeInput,
  type Session,
  type ShareLink,
  type User,
} from "../ports";
import { ADDED_COLUMNS, SCHEMA } from "./schema";

type Row = Record<string, string | null>;

const nowIso = () => new Date().toISOString();

const toUser = (r: Row): User => ({
  id: r.id as string,
  email: r.email as string,
  passwordHash: r.password_hash as string,
  createdAt: r.created_at as string,
});

const toSession = (r: Row): Session => ({
  id: r.id as string,
  userId: r.user_id as string,
  tokenHash: r.token_hash as string,
  expiresAt: r.expires_at as string,
  createdAt: r.created_at as string,
});

const toResume = (r: Row): Resume => ({
  id: r.id as string,
  userId: r.user_id as string,
  fullName: { ja: r.full_name as string, en: r.full_name_en as string },
  skills: JSON.parse(r.skills as string),
  certifications: { ja: JSON.parse(r.certifications as string), en: JSON.parse(r.certifications_en as string) },
  selfPr: { ja: r.self_pr as string, en: r.self_pr_en as string },
  updatedAt: r.updated_at as string,
});

const toProject = (r: Row): Project => ({
  id: r.id as string,
  resumeId: r.resume_id as string,
  startYm: r.start_ym as string,
  endYm: r.end_ym,
  company: { ja: r.company as string, en: r.company_en as string },
  projectName: { ja: r.project_name as string, en: r.project_name_en as string },
  duties: { ja: r.duties as string, en: r.duties_en as string },
  technologies: JSON.parse(r.technologies as string),
  positions: JSON.parse(r.positions as string),
  createdAt: r.created_at as string,
});

const toShareLink = (r: Row): ShareLink => ({
  id: r.id as string,
  resumeId: r.resume_id as string,
  tokenHash: r.token_hash as string,
  createdAt: r.created_at as string,
});

export function createSqliteRepositories(path: string): Repositories {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { strict: true });
  db.run("PRAGMA foreign_keys = ON");
  if (path !== ":memory:") db.run("PRAGMA journal_mode = WAL");
  db.run(SCHEMA);
  // Add missing columns to an old DB (does nothing if all columns exist)
  for (const { table, column, ddl } of ADDED_COLUMNS) {
    const cols = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }

  /** Fetches one row and converts it (null if none) */
  const one = <T>(sql: string, params: Record<string, string | null>, to: (r: Row) => T): T | null => {
    const r = db.query(sql).get(params) as Row | null;
    return r ? to(r) : null;
  };

  const resumes: Repositories["resumes"] = {
    async findByUserId(userId) {
      return one("SELECT * FROM resumes WHERE user_id = $userId", { userId }, toResume);
    },
    async findById(id) {
      return one("SELECT * FROM resumes WHERE id = $id", { id }, toResume);
    },
    async upsert(userId, input: ResumeInput) {
      db.query(
        `INSERT INTO resumes (id, user_id, full_name, full_name_en, skills, certifications, certifications_en, self_pr, self_pr_en, updated_at)
         VALUES ($id, $userId, $fullName, $fullNameEn, $skills, $certifications, $certificationsEn, $selfPr, $selfPrEn, $updatedAt)
         ON CONFLICT(user_id) DO UPDATE SET
           full_name = excluded.full_name, full_name_en = excluded.full_name_en, skills = excluded.skills,
           certifications = excluded.certifications, certifications_en = excluded.certifications_en,
           self_pr = excluded.self_pr, self_pr_en = excluded.self_pr_en,
           updated_at = excluded.updated_at`,
      ).run({
        id: crypto.randomUUID(),
        userId,
        fullName: input.fullName.ja,
        fullNameEn: input.fullName.en,
        skills: JSON.stringify(input.skills),
        certifications: JSON.stringify(input.certifications.ja),
        certificationsEn: JSON.stringify(input.certifications.en),
        selfPr: input.selfPr.ja,
        selfPrEn: input.selfPr.en,
        updatedAt: nowIso(),
      });
      return (await resumes.findByUserId(userId)) as Resume;
    },
    async ensureForUser(userId) {
      // Do "create if missing" in a single statement. Looking up then creating could, on an async DB, overwrite a concurrent save with empty values
      db.query(
        `INSERT INTO resumes (id, user_id, full_name, full_name_en, skills, certifications, certifications_en, self_pr, self_pr_en, updated_at)
         VALUES ($id, $userId, '', '', '[]', '[]', '[]', '', '', $updatedAt)
         ON CONFLICT(user_id) DO NOTHING`,
      ).run({ id: crypto.randomUUID(), userId, updatedAt: nowIso() });
      return (await resumes.findByUserId(userId)) as Resume;
    },
    async listProjects(resumeId) {
      const rows = db
        .query("SELECT * FROM projects WHERE resume_id = $resumeId ORDER BY start_ym DESC, created_at DESC, rowid DESC")
        .all({ resumeId }) as Row[];
      return rows.map(toProject);
    },
    async findProject(resumeId, projectId) {
      return one(
        "SELECT * FROM projects WHERE id = $projectId AND resume_id = $resumeId",
        { resumeId, projectId },
        toProject,
      );
    },
    async createProject(resumeId, input) {
      const id = crypto.randomUUID();
      db.query(
        `INSERT INTO projects (id, resume_id, start_ym, end_ym, company, company_en, project_name, project_name_en, duties, duties_en, technologies, positions, created_at)
         VALUES ($id, $resumeId, $startYm, $endYm, $company, $companyEn, $projectName, $projectNameEn, $duties, $dutiesEn, $technologies, $positions, $createdAt)`,
      ).run({ id, resumeId, ...projectParams(input), createdAt: nowIso() });
      return (await resumes.findProject(resumeId, id)) as Project;
    },
    async updateProject(resumeId, projectId, input) {
      const { changes } = db
        .query(
          `UPDATE projects SET start_ym = $startYm, end_ym = $endYm, company = $company, company_en = $companyEn,
             project_name = $projectName, project_name_en = $projectNameEn, duties = $duties, duties_en = $dutiesEn,
             technologies = $technologies, positions = $positions
           WHERE id = $projectId AND resume_id = $resumeId`,
        )
        .run({ projectId, resumeId, ...projectParams(input) });
      return changes > 0 ? resumes.findProject(resumeId, projectId) : null;
    },
    async deleteProject(resumeId, projectId) {
      const { changes } = db
        .query("DELETE FROM projects WHERE id = $projectId AND resume_id = $resumeId")
        .run({ projectId, resumeId });
      return changes > 0;
    },
  };

  const shareLinks: Repositories["shareLinks"] = {
    async findByResumeId(resumeId) {
      return one("SELECT * FROM share_links WHERE resume_id = $resumeId", { resumeId }, toShareLink);
    },
    async findByTokenHash(tokenHash) {
      return one("SELECT * FROM share_links WHERE token_hash = $tokenHash", { tokenHash }, toShareLink);
    },
    async replace(resumeId, tokenHash) {
      db.query(
        `INSERT INTO share_links (id, resume_id, token_hash, created_at) VALUES ($id, $resumeId, $tokenHash, $createdAt)
         ON CONFLICT(resume_id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at`,
      ).run({ id: crypto.randomUUID(), resumeId, tokenHash, createdAt: nowIso() });
      return (await shareLinks.findByResumeId(resumeId)) as ShareLink;
    },
    async delete(resumeId) {
      db.query("DELETE FROM share_links WHERE resume_id = $resumeId").run({ resumeId });
    },
  };

  return {
    users: {
      async create(email, passwordHash) {
        const user: User = { id: crypto.randomUUID(), email, passwordHash, createdAt: nowIso() };
        try {
          db.query(
            "INSERT INTO users (id, email, password_hash, created_at) VALUES ($id, $email, $passwordHash, $createdAt)",
          ).run(user);
        } catch (e) {
          if (String(e).includes("UNIQUE constraint failed: users.email")) throw new DuplicateEmailError(email);
          throw e;
        }
        return user;
      },
      async findByEmail(email) {
        return one("SELECT * FROM users WHERE email = $email", { email }, toUser);
      },
      async findById(id) {
        return one("SELECT * FROM users WHERE id = $id", { id }, toUser);
      },
    },
    sessions: {
      async create(userId, tokenHash, expiresAt) {
        const s: Session = {
          id: crypto.randomUUID(),
          userId,
          tokenHash,
          expiresAt: expiresAt.toISOString(),
          createdAt: nowIso(),
        };
        db.query(
          "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES ($id, $userId, $tokenHash, $expiresAt, $createdAt)",
        ).run(s);
        return s;
      },
      async findByTokenHash(tokenHash) {
        return one("SELECT * FROM sessions WHERE token_hash = $tokenHash", { tokenHash }, toSession);
      },
      async delete(id) {
        db.query("DELETE FROM sessions WHERE id = $id").run({ id });
      },
    },
    resumes,
    shareLinks,
    close: () => db.close(),
  };
}

function projectParams(input: ProjectInput) {
  return {
    startYm: input.startYm,
    endYm: input.endYm,
    company: input.company.ja,
    companyEn: input.company.en,
    projectName: input.projectName.ja,
    projectNameEn: input.projectName.en,
    duties: input.duties.ja,
    dutiesEn: input.duties.en,
    technologies: JSON.stringify(input.technologies),
    positions: JSON.stringify(input.positions),
  };
}
