export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  skills TEXT NOT NULL,
  certifications TEXT NOT NULL,
  self_pr TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
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
);
CREATE INDEX IF NOT EXISTS projects_resume_id ON projects(resume_id);
CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL UNIQUE REFERENCES resumes(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
`;

/**
 * Columns added at startup to an existing DB (CREATE TABLE IF NOT EXISTS in SCHEMA does not add columns).
 * English text lives in *_en columns (Japanese in the original columns). Only missing columns are added with ALTER TABLE.
 */
export const ADDED_COLUMNS: { table: string; column: string; ddl: string }[] = [
  { table: "resumes", column: "full_name_en", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "resumes", column: "certifications_en", ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "resumes", column: "self_pr_en", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "projects", column: "company_en", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "projects", column: "project_name_en", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "projects", column: "duties_en", ddl: "TEXT NOT NULL DEFAULT ''" },
];
