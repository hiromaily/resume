import type { Project, Resume } from "../db/ports";
import { LANG_NAMES, LANGS, type Lang } from "../i18n/lang";
import { normalizePositions } from "../resume/positions";
import { type FieldErrors, type FormValues, list, str } from "../resume/validation";
import { ChipInput } from "./chip-input";
import { PositionInput } from "./position-input";
import { ProjectCard } from "./resume-view";

export const FieldError = ({ errors, name }: { errors: FieldErrors; name: string }) =>
  errors[name] ? <p class="error">{errors[name]}</p> : null;

export const resumeToValues = (r: Resume | null): FormValues => ({
  full_name: r?.fullName.ja ?? "",
  full_name_en: r?.fullName.en ?? "",
  skills: r?.skills ?? [],
  certifications: r?.certifications.ja ?? [],
  certifications_en: r?.certifications.en ?? [],
  self_pr: r?.selfPr.ja ?? "",
  self_pr_en: r?.selfPr.en ?? "",
});

/** The result of a draft request: the chosen languages and the fields that got translations (form field names) */
export type DraftState = { from: Lang; to: Lang; filled: string[] };

/** The marker for fields filled by a draft */
const drafted = (draft: DraftState | undefined, name: string) => (draft?.filled.includes(name) ? "drafted" : undefined);

function LangSelect({ name, label, selected }: { name: "from" | "to"; label: string; selected: Lang }) {
  return (
    <select name={name} aria-label={label}>
      {LANGS.map((l) => (
        <option value={l} selected={l === selected}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </select>
  );
}

/**
 * The draft bar at the top of the form (only when translation is enabled). Languages are picked from dropdowns, so there is one button however many languages there are.
 * `formaction` lets it submit without JS. With htmx, passing `hx` replaces the form with the returned fragment.
 * While translating, the form gets htmx-request (hx-indicator), and CSS changes the button text and blocks interaction
 */
function DraftBar({ action, draft, hx = false }: { action: string; draft?: DraftState; hx?: boolean }) {
  const htmx = hx
    ? {
        "hx-post": action,
        "hx-target": "closest form",
        "hx-swap": "outerHTML",
        "hx-indicator": "closest form",
        "hx-disabled-elt": "this",
      }
    : {};
  return (
    <div class="draft-bar">
      <span class="draft-title">✨ AI で翻訳の下書き</span>
      <LangSelect name="from" label="訳す元の言語" selected={draft?.from ?? "ja"} />
      <span>から</span>
      <LangSelect name="to" label="訳す先の言語" selected={draft?.to ?? "en"} />
      <span>へ</span>
      <button type="submit" class="draft-go" formaction={action} {...htmx}>
        <span class="idle">下書きを作る</span>
        <span class="busy">
          <span class="spinner" aria-hidden="true"></span>訳しています…（10 秒ほど）
        </span>
      </button>
      <span class="muted">下書きは保存されません。確かめて直してから保存してください。</span>
    </div>
  );
}

/** Notice that a draft was filled in (only when it was) */
function DraftNotice({ draft }: { draft?: DraftState }) {
  if (!draft || draft.filled.length === 0) return null;
  return (
    <p class="draft-done" role="status">
      ✓ 下書きを入れました（{LANG_NAMES[draft.from]} → {LANG_NAMES[draft.to]}）。確かめて直してから保存してください
    </p>
  );
}

/**
 * An invisible save button that makes save the default button pressed by Enter (the form's first submit).
 * Since the draft bar is at the top of the form, without this Enter would start a translation
 */
const DefaultSave = () => (
  <button type="submit" class="default-submit" tabindex={-1}>
    保存
  </button>
);

export function ResumeBasicsForm({
  values,
  errors,
  draft,
  canDraft = false,
}: {
  values: FormValues;
  errors: FieldErrors;
  draft?: DraftState;
  canDraft?: boolean;
}) {
  return (
    <form method="post" action="/resume/edit" class="card">
      <h2>基本の項目</h2>
      {canDraft ? <DefaultSave /> : null}
      {canDraft ? <DraftBar action="/resume/edit/draft" draft={draft} hx /> : null}
      <FieldError errors={errors} name="draft" />
      <DraftNotice draft={draft} />
      <label for="full_name">氏名（日本語）</label>
      <input
        id="full_name"
        name="full_name"
        value={str(values.full_name)}
        maxlength={100}
        class={drafted(draft, "full_name")}
      />
      <FieldError errors={errors} name="full_name" />
      <label for="full_name_en">氏名（英語）</label>
      <input
        id="full_name_en"
        name="full_name_en"
        value={str(values.full_name_en)}
        maxlength={100}
        class={drafted(draft, "full_name_en")}
      />
      <FieldError errors={errors} name="full_name_en" />
      <label for="skills">スキル</label>
      <ChipInput field="skills" selected={list(values.skills)} />
      <FieldError errors={errors} name="skills" />
      <label for="certifications">資格（日本語）</label>
      <ChipInput field="certifications" selected={list(values.certifications)} />
      <FieldError errors={errors} name="certifications" />
      <label for="certifications_en">資格（英語）</label>
      <ChipInput field="certifications_en" selected={list(values.certifications_en)} />
      <FieldError errors={errors} name="certifications_en" />
      <label for="self_pr">自己PR（日本語）</label>
      <textarea id="self_pr" name="self_pr" class={drafted(draft, "self_pr")}>
        {str(values.self_pr)}
      </textarea>
      <FieldError errors={errors} name="self_pr" />
      <label for="self_pr_en">自己PR（英語）</label>
      <textarea id="self_pr_en" name="self_pr_en" class={drafted(draft, "self_pr_en")}>
        {str(values.self_pr_en)}
      </textarea>
      <FieldError errors={errors} name="self_pr_en" />
      <p>
        <button type="submit" class="primary">
          保存
        </button>
      </p>
    </form>
  );
}

const FIRST_YEAR = 1970;
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

/** Year and month dropdowns */
function YearMonthSelect({
  prefix,
  values,
  disabled = false,
}: {
  prefix: "start" | "end";
  values: FormValues;
  disabled?: boolean;
}) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => String(thisYear - i));
  const year = str(values[`${prefix}_year`]);
  const month = str(values[`${prefix}_month`]);
  return (
    <div class="ym">
      <select
        id={`${prefix}_year`}
        name={`${prefix}_year`}
        aria-label={prefix === "start" ? "開始の年" : "終了の年"}
        disabled={disabled}
      >
        <option value="">年</option>
        {years.map((y) => (
          <option value={y} selected={y === year}>
            {y}
          </option>
        ))}
      </select>
      <span>年</span>
      <select
        id={`${prefix}_month`}
        name={`${prefix}_month`}
        aria-label={prefix === "start" ? "開始の月" : "終了の月"}
        disabled={disabled}
      >
        <option value="">月</option>
        {MONTHS.map((m) => (
          <option value={m} selected={m === month}>
            {m}
          </option>
        ))}
      </select>
      <span>月</span>
    </div>
  );
}

/**
 * End year, end month and "currently employed". Toggling the checkbox re-fetches this fragment via htmx and disables the end inputs.
 * This avoids custom JS (CSP). Without JS, the server ignores the end inputs when the box is checked
 */
export function PeriodEnd({ values }: { values: FormValues }) {
  const current = str(values.current) === "on";
  return (
    <span class="period-end">
      <YearMonthSelect prefix="end" values={values} disabled={current} />
      <label class="check">
        <input
          type="checkbox"
          name="current"
          value="on"
          checked={current}
          hx-get="/resume/projects/period-end"
          hx-trigger="change"
          hx-target="closest .period-end"
          hx-swap="outerHTML"
          hx-include="closest .period-end"
        />{" "}
        就業中
      </label>
    </span>
  );
}

export type ProjectFormState = { projectId?: string; values: FormValues; errors: FieldErrors; draft?: DraftState };

export const projectToValues = (p: Project): FormValues => ({
  start_year: p.startYm.slice(0, 4),
  start_month: p.startYm.slice(5, 7),
  current: p.endYm ? "" : "on",
  end_year: p.endYm?.slice(0, 4) ?? "",
  end_month: p.endYm?.slice(5, 7) ?? "",
  company: p.company.ja,
  company_en: p.company.en,
  project_name: p.projectName.ja,
  project_name_en: p.projectName.en,
  duties: p.duties.ja,
  duties_en: p.duties.en,
  technologies: p.technologies,
  positions: p.positions,
});

export function ProjectForm({
  projectId,
  values,
  errors,
  draft,
  canDraft = false,
}: ProjectFormState & { canDraft?: boolean }) {
  const action = projectId ? `/resume/projects/${projectId}` : "/resume/projects";
  const draftAction = `${action}/draft`;
  return (
    <form method="post" action={action} hx-post={action} hx-target="#projects" hx-swap="outerHTML" class="card">
      <h3>{projectId ? "職務経歴を編集" : "職務経歴を追加"}</h3>
      {canDraft ? <DefaultSave /> : null}
      {canDraft ? <DraftBar action={draftAction} draft={draft} hx /> : null}
      <FieldError errors={errors} name="draft" />
      <DraftNotice draft={draft} />
      <label for="start_year">期間</label>
      <div class="period">
        <YearMonthSelect prefix="start" values={values} />
        <span>〜</span>
        <PeriodEnd values={values} />
      </div>
      <FieldError errors={errors} name="start" />
      <FieldError errors={errors} name="end" />
      <label for="company">会社名（日本語）</label>
      <input
        id="company"
        name="company"
        value={str(values.company)}
        maxlength={100}
        class={drafted(draft, "company")}
      />
      <FieldError errors={errors} name="company" />
      <label for="company_en">会社名（英語）</label>
      <input
        id="company_en"
        name="company_en"
        value={str(values.company_en)}
        maxlength={100}
        class={drafted(draft, "company_en")}
      />
      <FieldError errors={errors} name="company_en" />
      <label for="project_name">プロジェクト名（日本語）</label>
      <input
        id="project_name"
        name="project_name"
        value={str(values.project_name)}
        maxlength={100}
        class={drafted(draft, "project_name")}
      />
      <FieldError errors={errors} name="project_name" />
      <label for="project_name_en">プロジェクト名（英語）</label>
      <input
        id="project_name_en"
        name="project_name_en"
        value={str(values.project_name_en)}
        maxlength={100}
        class={drafted(draft, "project_name_en")}
      />
      <FieldError errors={errors} name="project_name_en" />
      <label for="duties">職務内容（日本語）</label>
      <textarea id="duties" name="duties" class={drafted(draft, "duties")}>
        {str(values.duties)}
      </textarea>
      <FieldError errors={errors} name="duties" />
      <label for="duties_en">職務内容（英語）</label>
      <textarea id="duties_en" name="duties_en" class={drafted(draft, "duties_en")}>
        {str(values.duties_en)}
      </textarea>
      <FieldError errors={errors} name="duties_en" />
      <label for="technologies">利用技術</label>
      <ChipInput field="technologies" selected={list(values.technologies)} />
      <FieldError errors={errors} name="technologies" />
      <label for="positions">ポジション</label>
      <PositionInput selected={normalizePositions(list(values.positions))} />
      <FieldError errors={errors} name="positions" />
      <p class="buttons">
        <button type="submit" class="primary">
          保存
        </button>
        {projectId ? (
          <a href="/resume/edit" hx-get="/resume/projects" hx-target="#projects" hx-swap="outerHTML">
            キャンセル
          </a>
        ) : null}
      </p>
    </form>
  );
}

export function ProjectsSection({
  projects,
  form,
  canDraft = false,
}: {
  projects: Project[];
  form?: ProjectFormState;
  canDraft?: boolean;
}) {
  const editingId = form?.projectId;
  return (
    <section id="projects">
      <h2>職務経歴</h2>
      {projects.map((p) =>
        p.id === editingId && form ? (
          <ProjectForm {...form} canDraft={canDraft} />
        ) : (
          <div class="card">
            <ProjectCard project={p} lang={p.company.ja || p.projectName.ja ? "ja" : "en"} />
            <div class="buttons">
              <a
                href={`/resume/projects/${p.id}/edit`}
                hx-get={`/resume/projects/${p.id}/edit`}
                hx-target="closest .card"
                hx-swap="outerHTML"
              >
                編集
              </a>
              <form
                method="post"
                action={`/resume/projects/${p.id}/delete`}
                hx-post={`/resume/projects/${p.id}/delete`}
                hx-target="#projects"
                hx-swap="outerHTML"
                hx-confirm="この職務経歴を削除しますか？"
                class="inline"
              >
                <button type="submit">削除</button>
              </form>
            </div>
          </div>
        ),
      )}
      {editingId ? null : <ProjectForm values={form?.values ?? {}} errors={form?.errors ?? {}} canDraft={canDraft} />}
    </section>
  );
}
