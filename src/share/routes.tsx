import { Hono } from "hono";
import { currentUser, requireAuth } from "../auth/session";
import { generateToken, hashToken } from "../auth/tokens";
import type { User } from "../db/ports";
import { resolveLang } from "../i18n/lang";
import { MESSAGES } from "../i18n/messages";
import { ownResume } from "../resume/own-resume";
import type { AppEnv } from "../types";
import { Layout } from "../views/layout";
import { ResumeView } from "../views/resume-view";

type SharePageProps = { user: User; active: boolean; url?: string; error?: string };

function SharePage({ user, active, url, error }: SharePageProps) {
  return (
    <Layout title="共有リンク" user={user}>
      <p>
        <a href="/resume">← 閲覧に戻る</a>
      </p>
      <h1>共有リンク</h1>
      {error ? <p class="error">{error}</p> : null}
      <div class="card">
        <p>
          状態: <strong>{active ? "共有中" : "共有していません"}</strong>
        </p>
        {url ? (
          <div>
            <p>このリンクを知っている人は、ログインなしで経歴書を閲覧できます。</p>
            <input value={url} readonly class="share-url" />
            <p class="muted">リンクはこの画面でしか表示されません。見失ったら作り直してください。</p>
          </div>
        ) : null}
        <div class="buttons">
          <form method="post" action="/resume/share" class="inline">
            <button type="submit" class="primary">
              {active ? "作り直す（今のリンクは使えなくなります）" : "作る"}
            </button>
          </form>
          {active ? (
            <form method="post" action="/resume/share/delete" class="inline">
              <button type="submit">止める</button>
            </form>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}

export function shareRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use("/resume/share", requireAuth);
  routes.use("/resume/share/*", requireAuth);

  routes.get("/resume/share", async (c) => {
    const resume = await ownResume(c);
    const link = resume ? await c.var.repos.shareLinks.findByResumeId(resume.id) : null;
    return c.html(<SharePage user={currentUser(c)} active={!!link} />);
  });

  routes.post("/resume/share", async (c) => {
    const resume = await ownResume(c);
    if (!resume || (!resume.fullName.ja && !resume.fullName.en)) {
      return c.html(<SharePage user={currentUser(c)} active={false} error="先に経歴書を作ってください" />, 422);
    }
    const token = generateToken();
    await c.var.repos.shareLinks.replace(resume.id, hashToken(token));
    const url = `${new URL(c.req.url).origin}/r/${token}`;
    c.header("Cache-Control", "no-store");
    return c.html(<SharePage user={currentUser(c)} active url={url} />);
  });

  routes.post("/resume/share/delete", async (c) => {
    const resume = await ownResume(c);
    if (resume) await c.var.repos.shareLinks.delete(resume.id);
    return c.redirect("/resume/share", 303);
  });

  routes.get("/r/:token", async (c) => {
    const { shareLinks, resumes } = c.var.repos;
    const link = await shareLinks.findByTokenHash(hashToken(c.req.param("token")));
    const resume = link ? await resumes.findById(link.resumeId) : null;
    if (!resume) return c.notFound();
    c.header("X-Robots-Tag", "noindex");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Cache-Control", "no-store");
    c.header("Vary", "Accept-Language");
    const lang = resolveLang({
      query: c.req.query("lang"),
      acceptLanguage: c.req.header("Accept-Language"),
      hasName: { ja: !!resume.fullName.ja, en: !!resume.fullName.en },
    });
    return c.html(
      <Layout title={MESSAGES[lang].pageTitle(resume.fullName[lang])} lang={lang} noindex>
        <ResumeView resume={resume} projects={await resumes.listProjects(resume.id)} lang={lang} />
      </Layout>,
    );
  });

  return routes;
}
