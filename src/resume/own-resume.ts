import type { Context } from "hono";
import { currentUser } from "../auth/session";
import type { Resume } from "../db/ports";
import type { AppEnv } from "../types";

/** The logged-in user's resume (null if none yet). Call after requireAuth */
export function ownResume(c: Context<AppEnv>): Promise<Resume | null> {
  return c.var.repos.resumes.findByUserId(currentUser(c).id);
}
