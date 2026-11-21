import type { Context } from "hono";
import { Hono } from "hono";
import { currentUser, requireAuth } from "../auth/session";
import { htmxOnly, isHtmx } from "../html";
import { isLang, LANG_NAMES, type Lang, resolveLang } from "../i18n/lang";
import { TranslationError } from "../translate/ports";
import type { AppEnv } from "../types";
import {
  type DraftState,
  PeriodEnd,
  ProjectForm,
  type ProjectFormState,
  ProjectsSection,
  projectToValues,
  ResumeBasicsForm,
  resumeToValues,
} from "../views/forms";
import { Layout } from "../views/layout";
import { PositionInput } from "../views/position-input";
import { ResumeView } from "../views/resume-view";
import { applyDraft, pickSource } from "./draft";
import { ownResume } from "./own-resume";
import { normalizePositions } from "./positions";
import {
  type FieldErrors,
  type FormValues,
  fieldName,
  PROJECT_TEXT_FIELDS,
  projectFormValues,
  RESUME_TEXT_FIELDS,
  resumeFormValues,
  validateProjectInput,
  validateResumeInput,
} from "./validation";

const canDraft = (c: Context<AppEnv>) => c.var.translator !== null;

/** The `from` and `to` of a draft request (null unless both are languages) */
function draftLangs(body: Record<string, unknown>): { from: Lang; to: Lang } | null {
  const { from, to } = body;
  return isLang(from) && isLang(to) ? { from, to } : null;
}

/**
 * Creates a draft. Returns the values with the `to` language fields filled with translations from the `from` language (does not save).
 * On failure, returns the submitted values unchanged with a message in `errors.draft`
 */
async function makeDraft(
  c: Context<AppEnv>,
  fields: readonly string[],
  values: FormValues,
  { from, to }: { from: Lang; to: Lang },
): Promise<{ values: FormValues; errors: FieldErrors; draft: DraftState }> {
  const translator = c.var.translator;
  if (!translator) throw new Error("translator is disabled");
  const failed = (message: string) => ({ values, errors: { draft: message }, draft: { from, to, filled: [] } });
  if (from === to) return failed("訳す元と訳す先に別の言語を選んでください");
  const source = pickSource(values, fields, from);
  if (Object.keys(source).length === 0) return failed(`訳す元（${LANG_NAMES[from]}）が空です`);
  try {
    const translated = await translator.translate(source, from, to);
    const filled = Object.keys(translated).map((f) => fieldName(f, to));
    return { values: applyDraft(values, translated, to), errors: {}, draft: { from, to, filled } };
  } catch (e) {
    if (!(e instanceof TranslationError)) throw e;
    return failed("下書きを作れませんでした。時間をおいてもう一度試してください");
  }
}

async function renderEditPage(
  c: Context<AppEnv>,
  opts: { basics?: { values: FormValues; errors: FieldErrors; draft?: DraftState }; project?: ProjectFormState } = {},
  status: 200 | 422 = 200,
) {
  const user = currentUser(c);
  const resume = await ownResume(c);
  const basics = opts.basics ?? { values: resumeToValues(resume), errors: {} };
  const projects = resume ? await c.var.repos.resumes.listProjects(resume.id) : [];
  return c.html(
    <Layout title="経歴書の編集" user={user}>
      <p>
        <a href="/resume">← 閲覧に戻る</a>
      </p>
      <ResumeBasicsForm values={basics.values} errors={basics.errors} draft={basics.draft} canDraft={canDraft(c)} />
      <ProjectsSection projects={projects} form={opts.project} canDraft={canDraft(c)} />
    </Layout>,
    status,
  );
}

export function resumeRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use("/resume", requireAuth);
  routes.use("/resume/*", requireAuth);

  routes.get("/resume", async (c) => {
    const { resumes } = c.var.repos;
    const resume = await ownResume(c);
    const lang = resolveLang({
      query: c.req.query("lang"),
      acceptLanguage: c.req.header("Accept-Language"),
      hasName: { ja: !!resume?.fullName.ja, en: !!resume?.fullName.en },
    });
    return c.html(
      <Layout title="職務経歴書" user={currentUser(c)} lang={lang}>
        <nav class="actions">
          <a href="/resume/edit">編集する</a>
          <a href="/resume/share">共有リンク</a>
        </nav>
        {resume ? (
          <ResumeView resume={resume} projects={await resumes.listProjects(resume.id)} lang={lang} />
        ) : (
          <p class="card">
            まだ経歴書がありません。<a href="/resume/edit">作成する</a>
          </p>
        )}
      </Layout>,
    );
  });

  routes.get("/resume/edit", (c) => renderEditPage(c));

  routes.post("/resume/edit", async (c) => {
    const result = validateResumeInput(await c.req.parseBody({ all: true }));
    if (!result.ok) return renderEditPage(c, { basics: result }, 422);
    await c.var.repos.resumes.upsert(currentUser(c).id, result.value);
    return c.redirect("/resume/edit", 303);
  });

  routes.post("/resume/edit/draft", async (c) => {
    if (!c.var.translator) return c.notFound();
    const body = await c.req.parseBody({ all: true });
    const langs = draftLangs(body);
    if (!langs) return c.text("from and to must be ja or en", 400);
    const draft = await makeDraft(c, RESUME_TEXT_FIELDS, resumeFormValues(body), langs);
    const status = Object.keys(draft.errors).length > 0 ? 422 : 200;
    if (isHtmx(c)) return c.html(<ResumeBasicsForm {...draft} canDraft />, status);
    return renderEditPage(c, { basics: draft }, status);
  });

  /** Returns the list fragment for htmx, otherwise the whole edit page */
  const respond = async (c: Context<AppEnv>, resumeId: string, form?: ProjectFormState, status: 200 | 422 = 200) => {
    if (!isHtmx(c)) {
      if (status === 200 && !form) return c.redirect("/resume/edit", 303);
      return renderEditPage(c, { project: form }, status);
    }
    const projects = await c.var.repos.resumes.listProjects(resumeId);
    return c.html(<ProjectsSection projects={projects} form={form} canDraft={canDraft(c)} />, status);
  };

  const partialOfEditPage = htmxOnly("/resume/edit");

  routes.get("/resume/projects", partialOfEditPage, async (c) => {
    const resume = await ownResume(c);
    return c.html(
      <ProjectsSection
        projects={resume ? await c.var.repos.resumes.listProjects(resume.id) : []}
        canDraft={canDraft(c)}
      />,
    );
  });

  routes.get("/resume/projects/period-end", partialOfEditPage, (c) => c.html(<PeriodEnd values={c.req.query()} />));

  routes.get("/resume/projects/positions", partialOfEditPage, (c) => {
    const remove = c.req.query("remove");
    const picked = [...(c.req.queries("positions") ?? []), c.req.query("position_pick") ?? ""];
    const selected = normalizePositions(picked).filter((p) => p !== remove);
    return c.html(<PositionInput selected={selected} />);
  });

  routes.post("/resume/projects", async (c) => {
    // A resume is created only when adding a project
    const resume = await c.var.repos.resumes.ensureForUser(currentUser(c).id);
    const result = validateProjectInput(await c.req.parseBody({ all: true }));
    if (!result.ok) return respond(c, resume.id, result, 422);
    await c.var.repos.resumes.createProject(resume.id, result.value);
    return respond(c, resume.id);
  });

  /** Draft for a project. Handles both the add form (no projectId) and an existing project */
  const projectDraft = async (c: Context<AppEnv>, projectId?: string) => {
    if (!c.var.translator) return c.notFound();
    if (projectId) {
      const resume = await ownResume(c);
      if (!resume || !(await c.var.repos.resumes.findProject(resume.id, projectId))) return c.notFound();
    }
    const body = await c.req.parseBody({ all: true });
    const langs = draftLangs(body);
    if (!langs) return c.text("from and to must be ja or en", 400);
    const draft = await makeDraft(c, PROJECT_TEXT_FIELDS, projectFormValues(body), langs);
    const form = { projectId, ...draft };
    const status = Object.keys(draft.errors).length > 0 ? 422 : 200;
    if (isHtmx(c)) return c.html(<ProjectForm {...form} canDraft />, status);
    return renderEditPage(c, { project: form }, status);
  };

  // Register before `/resume/projects/:id` (so "draft" is not read as an ID)
  routes.post("/resume/projects/draft", (c) => projectDraft(c));
  routes.post("/resume/projects/:id/draft", (c) => projectDraft(c, c.req.param("id")));

  routes.get("/resume/projects/:id/edit", async (c) => {
    const resume = await ownResume(c);
    const project = resume ? await c.var.repos.resumes.findProject(resume.id, c.req.param("id")) : null;
    if (!project) return c.notFound();
    const form = { projectId: project.id, values: projectToValues(project), errors: {} };
    if (isHtmx(c)) return c.html(<ProjectForm {...form} canDraft={canDraft(c)} />);
    return renderEditPage(c, { project: form });
  });

  routes.post("/resume/projects/:id", async (c) => {
    const resume = await ownResume(c);
    const projectId = c.req.param("id");
    if (!resume || !(await c.var.repos.resumes.findProject(resume.id, projectId))) return c.notFound();
    const result = validateProjectInput(await c.req.parseBody({ all: true }));
    if (!result.ok) return respond(c, resume.id, { projectId, ...result }, 422);
    await c.var.repos.resumes.updateProject(resume.id, projectId, result.value);
    return respond(c, resume.id);
  });

  routes.post("/resume/projects/:id/delete", async (c) => {
    const resume = await ownResume(c);
    if (!resume || !(await c.var.repos.resumes.deleteProject(resume.id, c.req.param("id")))) return c.notFound();
    return respond(c, resume.id);
  });

  return routes;
}
