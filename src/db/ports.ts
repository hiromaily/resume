import type { Localized } from "../i18n/lang";
import type { Position } from "../resume/positions";

export type User = { id: string; email: string; passwordHash: string; createdAt: string };
export type Session = { id: string; userId: string; tokenHash: string; expiresAt: string; createdAt: string };
export type ResumeInput = {
  fullName: Localized<string>;
  skills: string[];
  certifications: Localized<string[]>;
  selfPr: Localized<string>;
};
export type Resume = ResumeInput & { id: string; userId: string; updatedAt: string };
export type ProjectInput = {
  startYm: string;
  endYm: string | null;
  company: Localized<string>;
  projectName: Localized<string>;
  duties: Localized<string>;
  technologies: string[];
  positions: Position[];
};
export type Project = ProjectInput & { id: string; resumeId: string; createdAt: string };
export type ShareLink = { id: string; resumeId: string; tokenHash: string; createdAt: string };

export interface UserRepository {
  /** Throws DuplicateEmailError on a duplicate email */
  create(email: string, passwordHash: string): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

export interface SessionRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
}

export interface ResumeRepository {
  findByUserId(userId: string): Promise<Resume | null>;
  findById(id: string): Promise<Resume | null>;
  upsert(userId: string, input: ResumeInput): Promise<Resume>;
  /** Creates an empty resume if none exists. Never rewrites an existing resume (must not overwrite even when called concurrently) */
  ensureForUser(userId: string): Promise<Resume>;
  /** Ordered by start_ym descending, then newest created first */
  listProjects(resumeId: string): Promise<Project[]>;
  findProject(resumeId: string, projectId: string): Promise<Project | null>;
  createProject(resumeId: string, input: ProjectInput): Promise<Project>;
  updateProject(resumeId: string, projectId: string, input: ProjectInput): Promise<Project | null>;
  deleteProject(resumeId: string, projectId: string): Promise<boolean>;
}

export interface ShareLinkRepository {
  findByResumeId(resumeId: string): Promise<ShareLink | null>;
  findByTokenHash(tokenHash: string): Promise<ShareLink | null>;
  /** One per resume. Replaces the existing link */
  replace(resumeId: string, tokenHash: string): Promise<ShareLink>;
  delete(resumeId: string): Promise<void>;
}

export type Repositories = {
  users: UserRepository;
  sessions: SessionRepository;
  resumes: ResumeRepository;
  shareLinks: ShareLinkRepository;
  close(): void;
};

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = "DuplicateEmailError";
  }
}
