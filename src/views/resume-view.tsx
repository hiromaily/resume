import type { Project, Resume } from "../db/ports";
import { LANGS, type Lang } from "../i18n/lang";
import { MESSAGES } from "../i18n/messages";
import { resolveIcon } from "../icons";
import { type Position, positionClass } from "../resume/positions";

export function formatPeriod(startYm: string, endYm: string | null, lang: Lang): string {
  const fmt = (ym: string) => ym.replace("-", "/");
  return `${fmt(startYm)} – ${endYm ? fmt(endYm) : MESSAGES[lang].present}`;
}

export function TechIcon({ name }: { name: string }) {
  const icon = resolveIcon(name);
  if (!icon) return <span class="tech tech-text">{name}</span>;
  return (
    <span class="tech" title={name}>
      <img src={`/icons/${icon.slug}.svg`} alt={name} title={name} width="18" height="18" />
      {name}
    </span>
  );
}

export function PositionBadge({ position }: { position: Position }) {
  return <span class={`pos ${positionClass(position)}`}>{position}</span>;
}

export function ProjectCard({ project, lang }: { project: Project; lang: Lang }) {
  const m = MESSAGES[lang];
  return (
    <dl class="project">
      <dt>{m.period}</dt>
      <dd>{formatPeriod(project.startYm, project.endYm, lang)}</dd>
      <dt>{m.company}</dt>
      <dd class="strong">{project.company[lang]}</dd>
      <dt>{m.projectName}</dt>
      <dd>{project.projectName[lang]}</dd>
      <dt>{m.duties}</dt>
      <dd class="pre">{project.duties[lang]}</dd>
      <dt>{m.technologies}</dt>
      <dd class="techs">
        {project.technologies.map((t) => (
          <TechIcon name={t} />
        ))}
      </dd>
      <dt>{m.positions}</dt>
      <dd>
        {project.positions.map((p) => (
          <PositionBadge position={p} />
        ))}
      </dd>
    </dl>
  );
}

const LANG_LABELS: Record<Lang, string> = { ja: "日本語", en: "English" };

export function LangSwitch({ current }: { current: Lang }) {
  return (
    <nav class="lang-switch" aria-label={MESSAGES[current].switchLabel}>
      {LANGS.map((l) => (
        <a href={`?lang=${l}`} aria-current={l === current ? "true" : undefined}>
          {LANG_LABELS[l]}
        </a>
      ))}
    </nav>
  );
}

export function ResumeView({ resume, projects, lang }: { resume: Resume; projects: Project[]; lang: Lang }) {
  const m = MESSAGES[lang];
  return (
    <article class="resume">
      <LangSwitch current={lang} />
      <h1>{resume.fullName[lang]}</h1>
      <section>
        <h2>{m.skills}</h2>
        <ul class="tags">
          {resume.skills.map((s) => (
            <li>
              <TechIcon name={s} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{m.certifications}</h2>
        <ul>
          {resume.certifications[lang].map((s) => (
            <li>{s}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{m.selfPr}</h2>
        <p class="pre">{resume.selfPr[lang]}</p>
      </section>
      <section>
        <h2>{m.projects}</h2>
        {projects.length === 0 ? <p class="muted">{m.noProjects}</p> : null}
        {projects.map((p) => (
          <div class="card">
            <ProjectCard project={p} lang={lang} />
          </div>
        ))}
      </section>
    </article>
  );
}
